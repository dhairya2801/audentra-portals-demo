/**
 * "Log in as demo student" — the developer sign-in for the demo campus.
 *
 * Two things are worth asserting without a browser: the gate defaults closed
 * outside development, and the reference validator accepts the two spellings
 * a demo population actually produces (SYN-000042 and a UUID) while rejecting
 * input that would only waste a round trip.
 *
 * The gate here is convenience. The one that matters is the platform route,
 * which 404s outside development and preview and resolves every reference
 * inside the authenticated tenant.
 */

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

function importTypeScriptModule(source) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  return import(moduleUrl);
}

async function demoModule() {
  const source = await readFile(
    new URL("../app/lib/demo-student-login.ts", import.meta.url),
    "utf8",
  );
  return importTypeScriptModule(source);
}

test("the demo sign-in is on in development and off everywhere else", async () => {
  const { demoStudentLoginEnabled } = await demoModule();

  assert.equal(demoStudentLoginEnabled({ NODE_ENV: "development" }), true);
  assert.equal(demoStudentLoginEnabled({ NODE_ENV: "production" }), false);
  assert.equal(demoStudentLoginEnabled({ NODE_ENV: "test" }), false);
  assert.equal(demoStudentLoginEnabled({}), false);
});

test("an explicit flag overrides the environment in both directions", async () => {
  const { demoStudentLoginEnabled } = await demoModule();

  assert.equal(
    demoStudentLoginEnabled({
      NEXT_PUBLIC_DEMO_STUDENT_LOGIN_ENABLED: "true",
      NODE_ENV: "production",
    }),
    true,
  );
  assert.equal(
    demoStudentLoginEnabled({
      NEXT_PUBLIC_DEMO_STUDENT_LOGIN_ENABLED: "false",
      NODE_ENV: "development",
    }),
    false,
  );
  assert.equal(
    demoStudentLoginEnabled({
      NEXT_PUBLIC_DEMO_STUDENT_LOGIN_ENABLED: " TRUE ",
      NODE_ENV: "production",
    }),
    true,
  );
});

test("the reference field accepts what the demo population actually issues", async () => {
  const { validateStudentReference, normalizeStudentReference } = await demoModule();

  assert.equal(validateStudentReference("SYN-000042"), null);
  assert.equal(validateStudentReference("  SYN-000042  "), null);
  assert.equal(
    validateStudentReference("ac2fa509-b4e3-402d-900b-ffb8440fc430"),
    null,
  );
  assert.equal(normalizeStudentReference("  SYN-000042 \n"), "SYN-000042");
});

test("the reference field rejects input that could not resolve", async () => {
  const { validateStudentReference } = await demoModule();

  for (const value of ["", "   ", "-leading-dash", "has space", "a".repeat(65)]) {
    assert.ok(
      validateStudentReference(value),
      `${JSON.stringify(value)} should not be accepted`,
    );
  }
  // The message names the format rather than scolding the user.
  assert.match(validateStudentReference(""), /SYN-/);
});

test("the production build ships the panel behind the gate, not enabled", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const bundle = files.find((name) => name.startsWith("sign-in-client-"));
  assert.ok(bundle, "the sign-in client bundle was not built");

  const source = await readFile(new URL(bundle, assetsDirectory), "utf8");
  assert.match(source, /Log in as demo student/);
  // Built for production, so the environment branch cannot open the panel and
  // only an explicit build-time flag can. A bundle that inlined `true` here
  // would put a student-impersonation box on a real portal.
  assert.match(source, /NODE_ENV:\s*`production`/);
  assert.doesNotMatch(source, /NODE_ENV:\s*`development`/);
});
