import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "../..");
const testDirectory = await mkdtemp(join(tmpdir(), "vv-browser-e2e-"));
const apiPort = process.env.E2E_API_PORT?.trim() || "41817";
const webPort = process.env.E2E_WEB_PORT?.trim() || "31817";
const portal = spawn(process.execPath, ["tools/run-student-portal.mjs"], {
  cwd: workspaceRoot,
  env: {
    ...process.env,
    NODE_ENV: "development",
    DEMO_API_PORT: apiPort,
    DEMO_API_HOST: "::1",
    WEB_PORT: webPort,
    DEMO_API_DATA_FILE: join(testDirectory, "state.json"),
    DOCUMENT_UPLOAD_DIR: join(testDirectory, "uploads"),
    DEMO_API_ORIGINS:
      `http://127.0.0.1:${webPort},http://localhost:${webPort}`,
    NEXT_PUBLIC_API_BASE_URL: `http://localhost:${apiPort}`,
    NEXT_PUBLIC_SITE_URL: `http://localhost:${webPort}`,
    VV_E2E_DOCUMENT_AI: "deterministic",
    VV_E2E_COMPLETED_STUDENT: "true",
  },
  stdio: "inherit",
});

let stopping = false;
async function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  if (portal.exitCode === null && portal.signalCode === null) {
    portal.kill("SIGTERM");
  }
  await rm(testDirectory, { recursive: true, force: true });
  process.exit(exitCode);
}

portal.once("error", (error) => {
  process.stderr.write(`Browser test portal failed to start: ${error.message}\n`);
  void stop(1);
});
portal.once("exit", (code, signal) => {
  if (stopping) return;
  const reason = signal ? `signal ${signal}` : `exit code ${code ?? 1}`;
  process.stderr.write(`Browser test portal stopped unexpectedly (${reason})\n`);
  void stop(code ?? 1);
});

process.once("SIGINT", () => void stop(0));
process.once("SIGTERM", () => void stop(0));
