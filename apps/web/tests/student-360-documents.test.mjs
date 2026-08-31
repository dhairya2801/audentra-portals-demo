import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/staff/student-360.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/staff/student-360-documents.module.css", import.meta.url), "utf8");

test("documents provides full-text discovery and cross-functional controls", () => {
  assert.match(source, /Full-text search/);
  assert.match(source, /All teams/);
  assert.match(source, /All document types/);
  assert.match(source, /Student \+ institution/);
  assert.match(source, /Newest submission/);
  assert.match(source, /Group by/);
});

test("documents exposes essential metadata and a split preview without the redundant intelligence grid", () => {
  assert.match(source, /AI classified/);
  assert.match(source, /OCR/);
  assert.match(source, /Extracted metadata/);
  assert.match(source, /Financial probation letter/);
  assert.match(source, /Close document preview/);
  assert.doesNotMatch(source, /className=\{styles\.documentIcon\}>DOC/);
  assert.doesNotMatch(styles, /\.intelligenceGrid/);
  assert.match(styles, /grid-template-columns:\s*minmax\(300px, 0\.83fr\)/);
});
