import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const workspaceRoot = resolve(import.meta.dirname, "../..");
const processScript = resolve(workspaceRoot, "tools", "portal-process.mjs");
const runnerScript = resolve(workspaceRoot, "tools", "run-student-portal.mjs");

test("the portal runner uses direct Node children and a strict web port", async () => {
  const source = await readFile(runnerScript, "utf8");

  assert.doesNotMatch(source, /npm\.cmd|npm\.ps1|shell:\s*true/);
  assert.match(source, /spawn\(process\.execPath/);
  assert.match(source, /"--strictPort"/);
  assert.match(source, /taskkill\.exe/);
});

test("the Windows background launcher hands off through Start-Process", async () => {
  const source = await readFile(processScript, "utf8");

  assert.match(source, /\$portal = Start-Process/);
  assert.match(source, /PORTAL_STDOUT_FILE/);
  assert.doesNotMatch(source, /-RedirectStandardOutput/);
  assert.doesNotMatch(source, /-RedirectStandardError/);
});

test("start recognizes a healthy portal instead of launching a duplicate", async () => {
  const runtimeDirectory = await mkdtemp(join(tmpdir(), "vv-portal-ready-"));
  const api = await listen((request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ready", service: "vv-demo-api" }));
  });
  const web = await listen((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<html><head><title>Student Portal | Test</title></head></html>");
  });

  try {
    const result = await runPortalProcess("start", {
      DEMO_API_PORT: String(api.port),
      WEB_PORT: String(web.port),
      PORTAL_RUNTIME_DIRECTORY: runtimeDirectory,
    });

    assert.equal(result.code, 0, result.stderr);
    assert.match(
      result.stdout,
      /already-running student portal|already ready/,
    );
    assert.doesNotMatch(result.stdout, /started in the background/);
  } finally {
    await Promise.all([close(api.server), close(web.server)]);
    await rm(runtimeDirectory, { recursive: true, force: true });
  }
});

test("start fails fast when a required port belongs to another service", async () => {
  const runtimeDirectory = await mkdtemp(join(tmpdir(), "vv-portal-conflict-"));
  const conflictingServer = await listen((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("not the VV demo API");
  });
  const availableWebPort = await reservePort();

  try {
    const result = await runPortalProcess("start", {
      DEMO_API_PORT: String(conflictingServer.port),
      WEB_PORT: String(availableWebPort),
      PORTAL_RUNTIME_DIRECTORY: runtimeDirectory,
    });

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /already in use/);
    assert.match(result.stderr, /did not start a partial or fallback instance/);
  } finally {
    await close(conflictingServer.server);
    await rm(runtimeDirectory, { recursive: true, force: true });
  }
});

function runPortalProcess(command, environment) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [processScript, command], {
      cwd: workspaceRoot,
      env: { ...process.env, ...environment },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      resolveResult({ code, stdout, stderr });
    });
  });
}

function listen(handler) {
  return new Promise((resolveServer, reject) => {
    const server = createServer(handler);
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolveServer({ server, port: address.port });
    });
  });
}

async function reservePort() {
  const reservation = await listen((_request, response) => response.end());
  const port = reservation.port;
  await close(reservation.server);
  return port;
}

function close(server) {
  return new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
}
