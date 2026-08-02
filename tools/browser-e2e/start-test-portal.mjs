import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "../..");
const webEntrypoint = resolve(
  workspaceRoot,
  "apps",
  "web",
  "scripts",
  "build.mjs",
);
const webPort = process.env.E2E_WEB_PORT?.trim() || "31817";
const apiBaseUrl =
  process.env.E2E_API_BASE_URL?.trim().replace(/\/+$/, "") ||
  "http://localhost:4000";
const parentPid = process.ppid;

const web = spawn(
  process.execPath,
  [webEntrypoint, "dev", "--host", "127.0.0.1", "--port", webPort, "--strictPort"],
  {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      NODE_ENV: "development",
      NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
      NEXT_PUBLIC_SITE_URL: `http://localhost:${webPort}`,
    },
    stdio: "inherit",
    windowsHide: true,
  },
);

let stopping = false;
const parentWatch = setInterval(() => {
  try {
    process.kill(parentPid, 0);
  } catch {
    stop(0);
  }
}, 1_000);

function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  clearInterval(parentWatch);
  if (web.exitCode === null && web.signalCode === null) {
    if (process.platform === "win32" && Number.isInteger(web.pid)) {
      spawnSync("taskkill.exe", ["/PID", String(web.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      web.kill("SIGTERM");
    }
  }
  process.exit(exitCode);
}

web.once("error", (error) => {
  process.stderr.write(`Browser test web server failed to start: ${error.message}\n`);
  stop(1);
});
web.once("exit", (code, signal) => {
  if (stopping) return;
  const reason = signal ? `signal ${signal}` : `exit code ${code ?? 1}`;
  process.stderr.write(`Browser test web server stopped unexpectedly (${reason})\n`);
  stop(code ?? 1);
});

process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));
