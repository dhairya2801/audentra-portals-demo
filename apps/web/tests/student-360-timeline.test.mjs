import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../app/staff/", import.meta.url);
const timelineSource = readFileSync(new URL("student-360.tsx", root), "utf8");
const timelineStyles = readFileSync(new URL("student-360-timeline.module.css", root), "utf8");

test("timeline provides an interactive session replay with outcomes and handoffs", () => {
  assert.match(timelineSource, /Human-readable history/);
  assert.match(timelineSource, /Activity replay/);
  assert.match(timelineSource, /Student checked Financial Aid and Student Health/);
  assert.match(timelineSource, /Session activity path/);
  assert.match(timelineSource, /Meaningful outcome/);
  assert.match(timelineSource, /Observed signal/);
  assert.match(timelineSource, /Suggested handoff/);
  assert.doesNotMatch(timelineSource, /Demo intent inference/);
  assert.match(timelineStyles, /\.replayWorkspace/);
  assert.match(timelineStyles, /\.sessionRail/);
  assert.match(timelineStyles, /\.path/);
});

test("timeline keeps filters, attribution, and deep-link controls", () => {
  assert.match(timelineSource, /Website movements/);
  assert.match(timelineSource, /Search activity/);
  assert.match(timelineSource, /data-tooltip/);
  assert.match(timelineSource, /onClick=\{\(\) => onOpen\(event\)\}/);
  assert.match(timelineSource, /event\.category === "note" \? "Comment"/);
});
