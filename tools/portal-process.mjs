import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { connect } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDirectory, "..");
const runtimeDirectory = process.env.PORTAL_RUNTIME_DIRECTORY
  ? resolve(process.env.PORTAL_RUNTIME_DIRECTORY)
  : workspaceRoot;
const pidFile = resolve(runtimeDirectory, ".portal-dev.pid");
const stdoutFile = resolve(runtimeDirectory, ".portal-dev.stdout.log");
const stderrFile = resolve(runtimeDirectory, ".portal-dev.stderr.log");
const runner = resolve(workspaceRoot, "tools", "run-student-portal.mjs");
const apiPort = readPort(process.env.DEMO_API_PORT ?? "4000", "DEMO_API_PORT");
const webPort = readPort(process.env.WEB_PORT ?? "3000", "WEB_PORT");
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://localhost:${webPort}`;
const webProbeUrls = [
  `http://127.0.0.1:${webPort}`,
  `http://[::1]:${webPort}`,
  webUrl,
];
const command = process.argv[2]?.trim().toLowerCase();

if (command === "start") {
  await start();
} else if (command === "stop") {
  await stop();
} else if (command === "status") {
  await status();
} else {
  process.stderr.write(
    "Usage: node tools/portal-process.mjs <start|stop|status>\n",
  );
  process.exitCode = 2;
}

async function start() {
  const existing = readProcessRecord();
  if (existing && recordIsRunning(existing)) {
    const ready = await portalReady();
    process.stdout.write(
      ready
        ? `Student portal is already ready (${describeRecord(existing)}).\n`
        : `Student portal process is already starting (${describeRecord(existing)}).\n`,
    );
    return;
  }
  if (existing) removePidFile();

  if (await portalReady()) {
    const adopted = adoptRunningPortal();
    process.stdout.write(
      adopted
        ? `Recovered the already-running student portal (${describeRecord(adopted)}).\n`
        : `Student portal is already ready at ${webUrl}; no duplicate was started.\n`,
    );
    return;
  }

  const occupiedPorts = [];
  if (await isPortOpen(apiPort)) occupiedPorts.push(apiPort);
  if (await isPortOpen(webPort)) occupiedPorts.push(webPort);
  if (occupiedPorts.length > 0) {
    throw new Error(
      `Cannot start the student portal because port${occupiedPorts.length === 1 ? "" : "s"} ` +
        `${occupiedPorts.join(", ")} ${occupiedPorts.length === 1 ? "is" : "are"} already in use. ` +
        "The launcher did not start a partial or fallback instance.",
    );
  }

  const childPid = launchBackgroundRunner();
  writeFileSync(
    pidFile,
    `${JSON.stringify({
      pid: childPid,
      startedAt: new Date().toISOString(),
    })}\n`,
    "utf8",
  );

  process.stdout.write(
    `Student portal started in the background (PID ${childPid}). Logs: ${stdoutFile}\n`,
  );
}

function launchBackgroundRunner() {
  if (process.platform === "win32") {
    writeFileSync(stdoutFile, "", "utf8");
    writeFileSync(stderrFile, "", "utf8");
    const startCommand = [
      "$portal = Start-Process",
      "-FilePath $env:VV_PORTAL_NODE",
      "-ArgumentList @($env:VV_PORTAL_RUNNER)",
      "-WorkingDirectory $env:VV_PORTAL_WORKSPACE",
      "-WindowStyle Hidden",
      "-PassThru;",
      "[Console]::Out.Write($portal.Id)",
    ].join(" ");
    const result = spawnSync(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        startCommand,
      ],
      {
        cwd: workspaceRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          VV_PORTAL_NODE: process.execPath,
          VV_PORTAL_RUNNER: runner,
          VV_PORTAL_WORKSPACE: workspaceRoot,
          PORTAL_STDOUT_FILE: stdoutFile,
          PORTAL_STDERR_FILE: stderrFile,
        },
        windowsHide: true,
      },
    );
    const pid = normalizePid(result.stdout?.trim());
    if (result.status !== 0 || !pid) {
      throw new Error(
        result.stderr?.trim() ||
          "Windows could not start the student portal background process.",
      );
    }
    return pid;
  }

  const stdout = openSync(stdoutFile, "w");
  const stderr = openSync(stderrFile, "w");
  const child = spawn(process.execPath, [runner], {
    cwd: workspaceRoot,
    detached: true,
    env: process.env,
    stdio: ["ignore", stdout, stderr],
  });
  child.unref();
  closeSync(stdout);
  closeSync(stderr);
  return child.pid;
}

async function stop() {
  let record = readProcessRecord();
  if (!record || !recordIsRunning(record)) {
    if (record) removePidFile();
    record = await recoverRunningPortal();
  }

  if (!record) {
    process.stdout.write("Student portal is not running.\n");
    return;
  }
  if (process.platform === "win32") {
    for (const pid of recordPids(record)) {
      if (!isRunning(pid)) continue;
      const result = spawnSync(
        "taskkill.exe",
        ["/PID", String(pid), "/T", "/F"],
        { encoding: "utf8", windowsHide: true },
      );
      if (result.status !== 0 && isRunning(pid)) {
        throw new Error(
          result.stderr?.trim() ||
            `Could not stop student portal PID ${pid}.`,
        );
      }
    }
  } else {
    process.kill(-record.pid, "SIGTERM");
    const gracefulDeadline = Date.now() + 3_000;
    while (isRunning(record.pid) && Date.now() < gracefulDeadline) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
    if (isRunning(record.pid)) process.kill(-record.pid, "SIGKILL");
  }
  removePidFile();
  process.stdout.write(`Stopped student portal (${describeRecord(record)}).\n`);
}

async function status() {
  let record = readProcessRecord();
  if (record && !recordIsRunning(record)) {
    removePidFile();
    record = null;
  }
  const ready = await portalReady();
  if (!record && ready) record = adoptRunningPortal();
  const running = Boolean(record && recordIsRunning(record));
  process.stdout.write(
    `${JSON.stringify({
      running: running || ready,
      ready,
      pid: running ? (record.pid ?? record.ownedPids?.[0] ?? null) : null,
      webUrl: ready ? webUrl : null,
      apiUrl: ready ? apiUrl : null,
    })}\n`,
  );
  if (!ready) process.exitCode = 1;
}

function readProcessRecord() {
  if (!existsSync(pidFile)) return null;
  try {
    const value = JSON.parse(readFileSync(pidFile, "utf8"));
    const pid = normalizePid(value?.pid);
    const ownedPids = Array.isArray(value?.ownedPids)
      ? [...new Set(value.ownedPids.map(normalizePid).filter(Boolean))]
      : [];
    if (!pid && ownedPids.length === 0) return null;
    return { ...value, pid, ownedPids };
  } catch {
    return null;
  }
}

function removePidFile() {
  rmSync(pidFile, { force: true });
}

function isRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function portalReady() {
  const [api, web] = await Promise.all([
    demoApiReady(),
    studentWebReady(),
  ]);
  return api && web;
}

async function demoApiReady() {
  try {
    const response = await fetch(`${apiUrl}/health/ready`, {
      signal: AbortSignal.timeout(1_000),
    });
    if (!response.ok) return false;
    const body = await response.json();
    return body?.status === "ready" && body?.service === "vv-demo-api";
  } catch {
    return false;
  }
}

async function studentWebReady() {
  for (const probeUrl of webProbeUrls) {
    try {
      const response = await fetch(`${probeUrl}/`, {
        redirect: "manual",
        // The first vinext request may include a short route compilation.
        signal: AbortSignal.timeout(3_000),
      });
      if (response.status < 200 || response.status >= 500) continue;
      const body = await response.text();
      if (body.includes("<title>Student Portal |")) return true;
    } catch {
      // Try the other loopback family before reporting the web app unavailable.
    }
  }
  return false;
}

async function isPortOpen(port) {
  if (await isPortOpenAt("127.0.0.1", port)) return true;
  return isPortOpenAt("::1", port);
}

function isPortOpenAt(host, port) {
  return new Promise((resolveResult) => {
    const socket = connect({ host, port });
    const finish = (open) => {
      socket.destroy();
      resolveResult(open);
    };
    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function recoverRunningPortal() {
  const [apiRecognized, webRecognized] = await Promise.all([
    demoApiReady(),
    studentWebReady(),
  ]);
  const recognizedPorts = [
    ...(apiRecognized ? [apiPort] : []),
    ...(webRecognized ? [webPort] : []),
  ];
  if (recognizedPorts.length === 0) return null;
  return adoptRunningPortal(recognizedPorts);
}

function adoptRunningPortal(ports = [apiPort, webPort]) {
  if (process.platform !== "win32") return null;
  const ownedPids = listenerPidsForPorts(ports);
  if (ownedPids.length === 0) return null;
  const record = {
    pid: null,
    ownedPids,
    adopted: true,
    startedAt: new Date().toISOString(),
  };
  writeFileSync(pidFile, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

function listenerPidsForPorts(ports) {
  const result = spawnSync("netstat.exe", ["-ano", "-p", "tcp"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) return [];
  const targetPorts = new Set(ports);
  const pids = new Set();
  for (const line of result.stdout.split(/\r?\n/)) {
    const columns = line.trim().split(/\s+/);
    if (columns.length < 5 || columns[0].toUpperCase() !== "TCP") continue;
    if (columns[3].toUpperCase() !== "LISTENING") continue;
    const portMatch = columns[1].match(/:(\d+)$/);
    const pid = normalizePid(columns.at(-1));
    if (portMatch && targetPorts.has(Number(portMatch[1])) && pid) {
      pids.add(pid);
    }
  }
  return [...pids];
}

function normalizePid(value) {
  const pid = Number(value);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function recordPids(record) {
  return [...new Set([record.pid, ...(record.ownedPids ?? [])].filter(Boolean))];
}

function recordIsRunning(record) {
  return recordPids(record).some(isRunning);
}

function describeRecord(record) {
  const pids = recordPids(record);
  return `PID${pids.length === 1 ? "" : "s"} ${pids.join(", ")}`;
}

function readPort(value, name) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return port;
}
