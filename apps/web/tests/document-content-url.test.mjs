import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadApiClient() {
  const source = await readFile(
    new URL("../app/lib/api-client.ts", import.meta.url),
    "utf8",
  );
  const parentPortalRoutes =
    "data:text/javascript,export%20const%20isParentPortalPath%3D()%3D%3Efalse%3B";
  const executable = source.replace(
    'from "./parent-portal-routes";',
    `from ${JSON.stringify(parentPortalRoutes)};`,
  );
  const compiled = ts.transpileModule(executable, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#${Date.now()}`
  );
}

test("staff document originals remain same-origin when the hosted API base is empty", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    location: { origin: "https://portal.example", pathname: "/staff" },
    sessionStorage: { getItem: () => null },
  };
  try {
    const client = await loadApiClient();
    assert.equal(
      client.getStaffDocumentContentUrl("/v1/staff/documents/doc-1/content"),
      "https://portal.example/v1/staff/documents/doc-1/content",
    );
    assert.equal(
      client.getStaffDocumentContentUrl("https://attacker.example/document"),
      "https://portal.example/",
    );
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
