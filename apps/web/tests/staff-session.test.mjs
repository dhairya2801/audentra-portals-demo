import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

function moduleUrl(source) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
}

test("staff transport cannot fall back to a development actor after sign-out", async () => {
  let source = await readFile(new URL("../app/lib/api-client.ts", import.meta.url), "utf8");
  for (const [specifier, file] of [
    ["./parent-portal-routes", "../app/lib/parent-portal-routes.ts"],
    ["../staff/task-board-utils", "../app/staff/task-board-utils.ts"],
  ]) {
    const dependency = moduleUrl(await readFile(new URL(file, import.meta.url), "utf8"));
    source = source.replace(`from "${specifier}";`, `from ${JSON.stringify(dependency)};`);
  }
  const client = await import(moduleUrl(source));
  let authenticated = false;
  const requests = [];
  const originalFetch = globalThis.fetch;
  // Model the local backend's dangerous-to-send browser fallback: without a
  // cookie, the development staff header still authenticates a default actor.
  globalThis.fetch = async (url, init) => {
    const headers = new Headers(init.headers);
    requests.push({ init, headers });
    if (url.endsWith("/sign-in-as")) authenticated = true;
    if (url.endsWith("/sign-out")) authenticated = false;
    if (url.includes("/v1/staff/") && !authenticated && !headers.has("x-demo-actor-type")) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in" } }, { status: 401 });
    }
    return Response.json({});
  };
  try {
    await assert.rejects(client.getStaffOperationsWorkspace(), { status: 401 });
    await client.signInDemoStaff({ staffRef: "selected-staff" });
    await client.getStaffOperationsWorkspace();
    await client.getStaffMe();
    await client.getStaffFinancialPlan("student");
    await client.signOutStaff();
    await assert.rejects(client.getStaffOperationsWorkspace(), { status: 401 });
    await assert.rejects(client.getStaffMe(), { status: 401 });
    for (const { init, headers } of requests) {
      assert.equal(init.credentials, "include");
      assert.equal(headers.has("x-demo-actor-type"), false);
      assert.equal(headers.has("x-demo-actor-id"), false);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
