import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  closeSync,
  existsSync,
  openSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDirectory, "..");
const environmentFile = resolve(workspaceRoot, ".env");
const apiEntrypoint = resolve(
  workspaceRoot,
  "tools",
  "demo-api",
  "src",
  "server.js",
);
const webEntrypoint = resolve(
  workspaceRoot,
  "apps",
  "web",
  "scripts",
  "build.mjs",
);
const children = [];
let stopping = false;

if (existsSync(environmentFile)) {
  process.loadEnvFile(environmentFile);
}

const configuredUploadDirectory = process.env.DOCUMENT_UPLOAD_DIR?.trim();
const absoluteUploadDirectory = configuredUploadDirectory
  ? resolve(workspaceRoot, configuredUploadDirectory)
  : undefined;
const stdoutFile = process.env.PORTAL_STDOUT_FILE?.trim();
const stderrFile = process.env.PORTAL_STDERR_FILE?.trim();
const childStdout = stdoutFile ? openSync(stdoutFile, "a") : "inherit";
const childStderr = stderrFile ? openSync(stderrFile, "a") : "inherit";

function start(name, entrypoint, args = [], environment = {}) {
  const child = spawn(process.execPath, [entrypoint, ...args], {
    cwd: workspaceRoot,
    env: { ...process.env, ...environment },
    stdio: ["ignore", childStdout, childStderr],
    windowsHide: true,
  });
  children.push(child);

  child.once("error", (error) => {
    writeRuntimeError(`${name} failed to start: ${error.message}\n`);
    stop(1);
  });
  child.once("exit", (code, signal) => {
    if (stopping) return;
    const reason = signal ? `signal ${signal}` : `exit code ${code ?? 1}`;
    writeRuntimeError(`${name} stopped unexpectedly (${reason})\n`);
    stop(code ?? 1);
  });
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      stopProcessTree(child);
    }
  }
  setTimeout(() => process.exit(exitCode), 250).unref();
}

function stopProcessTree(child) {
  if (!Number.isInteger(child.pid)) return;
  if (process.platform === "win32") {
    spawnSync(
      "taskkill.exe",
      ["/PID", String(child.pid), "/T", "/F"],
      { stdio: "ignore", windowsHide: true },
    );
    return;
  }
  child.kill("SIGTERM");
}

function writeRuntimeError(message) {
  if (stderrFile) {
    appendFileSync(stderrFile, message, "utf8");
    return;
  }
  process.stderr.write(message);
}

process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));

start(
  "demo API",
  apiEntrypoint,
  [],
  {
    PORT: process.env.DEMO_API_PORT ?? "4000",
    ...(absoluteUploadDirectory
      ? { DOCUMENT_UPLOAD_DIR: absoluteUploadDirectory }
      : {}),
  },
);
start(
  "student portal",
  webEntrypoint,
  [
    "dev",
    "--host",
    process.env.WEB_HOST ?? "127.0.0.1",
    "--port",
    process.env.WEB_PORT ?? "3000",
    "--strictPort",
  ],
  {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000",
  },
);

if (typeof childStdout === "number") closeSync(childStdout);
if (typeof childStderr === "number") closeSync(childStderr);
