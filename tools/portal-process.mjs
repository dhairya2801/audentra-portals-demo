import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const workspaceRoot = process.cwd();
const pidFile = resolve(workspaceRoot, ".portal-dev.pid");
const stdoutFile = resolve(workspaceRoot, ".portal-dev.stdout.log");
const stderrFile = resolve(workspaceRoot, ".portal-dev.stderr.log");
const runner = resolve(workspaceRoot, "tools", "run-student-portal.mjs");
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
  if (existing && isRunning(existing.pid)) {
    const ready = await portalReady();
    process.stdout.write(
      ready
        ? `Student portal is already ready (PID ${existing.pid}).\n`
        : `Student portal process is already starting (PID ${existing.pid}).\n`,
    );
    return;
  }
  removePidFile();

  const stdout = openSync(stdoutFile, "w");
  const stderr = openSync(stderrFile, "w");
  const child = spawn(process.execPath, [runner], {
    cwd: workspaceRoot,
    detached: true,
    env: process.env,
    stdio: ["ignore", stdout, stderr],
    windowsHide: true,
  });
  child.unref();
  closeSync(stdout);
  closeSync(stderr);
  writeFileSync(
    pidFile,
    `${JSON.stringify({
      pid: child.pid,
      startedAt: new Date().toISOString(),
    })}\n`,
    "utf8",
  );

  process.stdout.write(
    `Student portal started in the background (PID ${child.pid}). Logs: ${stdoutFile}\n`,
  );
}

async function stop() {
  const record = readProcessRecord();
  if (!record) {
    process.stdout.write("Student portal is not managed by a PID file.\n");
    return;
  }
  if (!isRunning(record.pid)) {
    removePidFile();
    process.stdout.write("Removed a stale student portal PID file.\n");
    return;
  }

  if (process.platform === "win32") {
    // Kill the tree while its recorded root still exists. Sending SIGTERM
    // first lets the root exit before taskkill can discover detached children,
    // leaving the web/API listeners orphaned.
    const result = spawnSync(
      "taskkill.exe",
      ["/PID", String(record.pid), "/T", "/F"],
      { encoding: "utf8", windowsHide: true },
    );
    if (result.status !== 0) {
      throw new Error(
        result.stderr?.trim() ||
          `Could not stop student portal PID ${record.pid}.`,
      );
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
  process.stdout.write(`Stopped student portal PID ${record.pid}.\n`);
}

async function status() {
  const record = readProcessRecord();
  const running = Boolean(record && isRunning(record.pid));
  const ready = running && (await portalReady());
  process.stdout.write(
    `${JSON.stringify({
      running,
      ready,
      pid: running ? record.pid : null,
      webUrl: ready ? "http://localhost:3000" : null,
      apiUrl: ready ? "http://localhost:4000" : null,
    })}\n`,
  );
  if (!running && record) removePidFile();
  if (!ready) process.exitCode = 1;
}

function readProcessRecord() {
  if (!existsSync(pidFile)) return null;
  try {
    const value = JSON.parse(readFileSync(pidFile, "utf8"));
    return Number.isInteger(value?.pid) && value.pid > 0 ? value : null;
  } catch {
    return null;
  }
}

function removePidFile() {
  rmSync(pidFile, { force: true });
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function portalReady() {
  try {
    const [api, web] = await Promise.all([
      fetch("http://127.0.0.1:4000/health/ready", {
        signal: AbortSignal.timeout(1_000),
      }),
      fetch("http://localhost:3000/", {
        redirect: "manual",
        // The first vinext request may include a short route compilation.
        // Keep status truthful without turning startup into a long foreground wait.
        signal: AbortSignal.timeout(3_000),
      }),
    ]);
    return api.ok && web.status >= 200 && web.status < 500;
  } catch {
    return false;
  }
}
