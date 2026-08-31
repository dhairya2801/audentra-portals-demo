import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../app/staff/", import.meta.url);
const enrollmentSource = readFileSync(new URL("student-360.tsx", root), "utf8");
const enrollmentStyles = readFileSync(new URL("student-360-enrollment.module.css", root), "utf8");

test("enrollment checklist uses collapsible student-style status groups", () => {
  assert.match(enrollmentSource, /Needs staff review/);
  assert.match(enrollmentSource, /To dos/);
  assert.match(enrollmentSource, /Blocked or rejected/);
  assert.match(enrollmentSource, /Completed/);
  assert.doesNotMatch(enrollmentStyles, /\.actionLegend/);
});

test("enrollment shows completion and contextual AI insight states", () => {
  assert.match(enrollmentSource, /Enrollment checklist \$\{completionPercent\} percent complete/);
  assert.match(enrollmentSource, /AI enrollment insight/);
  assert.match(enrollmentSource, /Enrollment requirements are ready/);
  assert.match(enrollmentSource, /Enrollment needs coordinated follow-up/);
  assert.match(enrollmentSource, /may slow the enrollment process/);
  assert.match(enrollmentSource, /Connected work/);
  assert.match(enrollmentStyles, /\.completionRing/);
  assert.match(enrollmentStyles, /\.insightCard/);
});
