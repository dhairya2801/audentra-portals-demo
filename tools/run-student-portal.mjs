import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];
let stopping = false;

function start(name, args, environment = {}) {
  const child = spawn(npmCommand, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...environment },
    stdio: "inherit",
  });
  children.push(child);

  child.once("error", (error) => {
    process.stderr.write(`${name} failed to start: ${error.message}\n`);
    stop(1);
  });
  child.once("exit", (code, signal) => {
    if (stopping) return;
    const reason = signal ? `signal ${signal}` : `exit code ${code ?? 1}`;
    process.stderr.write(`${name} stopped unexpectedly (${reason})\n`);
    stop(code ?? 1);
  });
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(exitCode), 250).unref();
}

process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));

start(
  "demo API",
  ["--prefix", "tools/demo-api", "run", "start"],
  { PORT: process.env.DEMO_API_PORT ?? "4000" },
);
start(
  "student portal",
  ["--prefix", "apps/web", "run", "dev", "--workspaces=false"],
  {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000",
  },
);
