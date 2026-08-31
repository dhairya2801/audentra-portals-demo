import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSources = () =>
  Promise.all([
    readFile(new URL("../app/staff/student-360-demo-record.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/staff/student-360.tsx", import.meta.url), "utf8"),
  ]);

test("Student 360 completes a record the platform did not fully serve", async () => {
  const [demo, component] = await readSources();
  // The record loader passes every fetched record through the completion, so a
  // deployment whose API predates 0053_student_360_records.sql still renders
  // the application, timeline, comments and ledger panels.
  assert.match(component, /withDemoStudent360Fields\(\s*await getStaffStudentRecord/);
  assert.match(demo, /export function withDemoStudent360Fields/);
  for (const field of ["application", "timeline", "notes", "financials"]) {
    assert.match(demo, new RegExp(`record\\.${field} \\?\\?`));
  }
});

test("a served field is never overwritten by the demo completion", async () => {
  const [demo] = await readSources();
  // Every field is written with `??`, and a record carrying all four returns
  // untouched — a migrated platform always shows its own records.
  assert.match(demo, /if \(!missing\) return record;/);
  assert.doesNotMatch(demo, /record\.(application|timeline|notes|financials) = [^=]/);
});

test("the completion is deterministic, so one student reads the same twice", async () => {
  const [demo] = await readSources();
  assert.match(demo, /function seedOf\(value: string\): number/);
  assert.match(demo, /seedOf\(operation\.id\)/);
  assert.doesNotMatch(demo, /Math\.random/);
});

test("a comment the platform will not take still joins the stream", async () => {
  const [demo, component] = await readSources();
  assert.match(demo, /export function demoComposedNote/);
  assert.match(component, /const \[localNotes, setLocalNotes\] = useState<StaffStudentNote\[\]>\(\[\]\)/);
  assert.match(component, /Comment added to the student record for this session\./);
  assert.match(component, /\[\.\.\.localNotes, \.\.\.record\.notes\.items\]/);
});
