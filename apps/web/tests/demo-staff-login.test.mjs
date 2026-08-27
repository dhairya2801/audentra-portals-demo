/**
 * "Log in as staff" — the developer sign-in for the demo university's staff.
 *
 * As with the student panel, the gate defaults closed outside development,
 * follows the student flag when it is set, and the grouping puts the people
 * who can actually be opened first. The gate that matters is the platform's.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  const source = await readFile(new URL("../app/lib/demo-staff-login.ts", import.meta.url), "utf8");
  return importTypeScriptModule(source);
}

test("the staff demo sign-in is on in development and off everywhere else", async () => {
  const { demoStaffLoginEnabled } = await demoModule();
  assert.equal(demoStaffLoginEnabled({ NODE_ENV: "development" }), true);
  assert.equal(demoStaffLoginEnabled({ NODE_ENV: "production" }), false);
  assert.equal(demoStaffLoginEnabled({}), false);
});

test("the staff flag wins, then the student flag, then the environment", async () => {
  const { demoStaffLoginEnabled } = await demoModule();
  assert.equal(demoStaffLoginEnabled({ NEXT_PUBLIC_DEMO_STAFF_LOGIN_ENABLED: "true", NODE_ENV: "production" }), true);
  assert.equal(demoStaffLoginEnabled({ NEXT_PUBLIC_DEMO_STAFF_LOGIN_ENABLED: "false", NEXT_PUBLIC_DEMO_STUDENT_LOGIN_ENABLED: "true", NODE_ENV: "development" }), false);
  assert.equal(demoStaffLoginEnabled({ NEXT_PUBLIC_DEMO_STUDENT_LOGIN_ENABLED: "true", NODE_ENV: "production" }), true);
  assert.equal(demoStaffLoginEnabled({ NEXT_PUBLIC_DEMO_STUDENT_LOGIN_ENABLED: "false", NODE_ENV: "development" }), false);
});

test("the directory groups by component with openable people first", async () => {
  const { groupDemoStaff } = await demoModule();
  const entries = [
    { component: "Academic Advising", name: "Quentin Zephyrine", roleCode: "academic_adviser", employmentStatus: "departed", canSignIn: false, directReports: 0 },
    { component: "Academic Advising", name: "Ada Ashgrove", roleCode: "academic_adviser", employmentStatus: "active", canSignIn: true, directReports: 0 },
    { component: "Admissions", name: "Hollis Zaragoza", roleCode: "director", employmentStatus: "active", canSignIn: true, directReports: 9 },
  ];
  const all = groupDemoStaff(entries, "all");
  assert.deepEqual(all.map((g) => g.component), ["Academic Advising", "Admissions"]);
  assert.deepEqual(all[0].people.map((p) => p.name), ["Ada Ashgrove", "Quentin Zephyrine"]);
  assert.deepEqual(groupDemoStaff(entries, "away").flatMap((g) => g.people.map((p) => p.name)), ["Quentin Zephyrine"]);
  assert.deepEqual(groupDemoStaff(entries, "leaders").flatMap((g) => g.people.map((p) => p.name)), ["Hollis Zaragoza"]);
  assert.deepEqual(groupDemoStaff(entries, "advisers").flatMap((g) => g.people.map((p) => p.name)), ["Ada Ashgrove", "Quentin Zephyrine"]);
});

test("a restricted deployment lists its staff personas without search or filters", async () => {
  const source = await readFile(new URL("../app/staff/demo-staff-login.tsx", import.meta.url), "utf8");
  assert.match(source, /const personas = await getDemoPersonas\(signal\)/);
  assert.match(source, /if \(personas\.restricted\) \{\s*return \{ restricted: true, items: personas\.staff/);
  // Search and filter controls only exist for the open directory.
  assert.match(source, /\{restricted \? null : \(\s*<div className="staff-demo-login__controls">/);
  assert.match(source, /restricted \? "Demo access" : "Development only"/);
  // Either way, opening a person posts the platform's sign-in-as route, which
  // enforces the allowlist server-side.
  assert.match(source, /signInDemoStaff\(\{ staffRef: entry\.id \}\)/);
});
