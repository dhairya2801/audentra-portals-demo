import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../app/staff/", import.meta.url);
const routerSource = readFileSync(new URL("student-360.tsx", root), "utf8");
const academicsSource = readFileSync(new URL("student-360-academics.tsx", root), "utf8");
const academicsStyles = readFileSync(new URL("student-360-academics.module.css", root), "utf8");

test("academics is a first-class Student 360 tab", () => {
  assert.match(routerSource, /\| "academics"/);
  assert.match(routerSource, /id: "academics", label: "Academics"/);
  assert.match(routerSource, /<AcademicsPanel/);
});

test("academics presents degree history, requirements, and guided planning", () => {
  assert.match(academicsSource, /Academic path/);
  assert.match(academicsSource, /Enrolled now/);
  assert.match(academicsSource, /Completed courses and external credit/);
  assert.match(academicsSource, /Transfer \+ AP/);
  assert.match(academicsSource, /Degree audit/);
  assert.match(academicsSource, /Must-take next/);
  assert.match(academicsSource, /AI-recommended electives/);
  assert.match(academicsSource, /type="range"/);
  assert.match(academicsSource, /seats &middot; Prerequisite:/);
  assert.match(academicsSource, /Prepare registration handoff/);
  assert.match(academicsStyles, /\.creditRing/);
  assert.match(academicsStyles, /\.recommendationGrid/);
});
