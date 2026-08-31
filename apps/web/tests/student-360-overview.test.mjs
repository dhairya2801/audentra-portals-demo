import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../app/staff/", import.meta.url);
const overviewSource = readFileSync(new URL("student-360-overview.tsx", root), "utf8");
const overviewStyles = readFileSync(new URL("student-360-overview.module.css", root), "utf8");

test("overview is an actionable cross-functional summary", () => {
  assert.match(overviewSource, /Executive overview/);
  assert.match(overviewSource, /Student progress pipeline/);
  assert.match(overviewSource, /Cross-functional signal brief/);
  assert.match(overviewSource, /Rule-based synthesis/);
  assert.doesNotMatch(overviewSource, /Cross-functional AI insight/);
  assert.match(overviewSource, /Five functional areas summarized/);
  assert.match(overviewSource, /conic-gradient\(#5bd0c5 0 \$\{overallProgress\}%/);
  assert.match(overviewStyles, /\.pipeline/);
  assert.match(overviewStyles, /\.decisionGrid/);
});

test("melt risk anatomy explains score dimensions and comparison", () => {
  assert.match(overviewSource, /Melt Risk anatomy/);
  assert.match(overviewSource, /Communication engagement/);
  assert.match(overviewSource, /Portal and web engagement/);
  assert.match(overviewSource, /Compliance and timeliness/);
  assert.match(overviewSource, /Academic readiness/);
  assert.match(overviewSource, /Campus engagement/);
  assert.match(overviewSource, /Cohort average marker/);
  assert.match(overviewSource, /Insufficient data/);
  assert.match(overviewSource, /weight/);
  assert.match(overviewStyles, /\.scoreTrack/);
  assert.match(overviewStyles, /\.noData/);
});
