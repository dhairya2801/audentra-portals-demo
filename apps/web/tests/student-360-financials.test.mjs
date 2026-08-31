import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../app/staff/", import.meta.url);
const financialsSource = readFileSync(new URL("student-360-financials.tsx", root), "utf8");
const financialsStyles = readFileSync(new URL("student-360-financials.module.css", root), "utf8");

test("financials uses complete financial-aid concepts and terminology", () => {
  assert.match(financialsSource, /Financial Aid Package/);
  assert.match(financialsSource, /Total cost of attendance/);
  assert.match(financialsSource, /Tuition and fees/);
  assert.match(financialsSource, /Housing and dining/);
  assert.match(financialsSource, /Books and other costs/);
  assert.match(financialsSource, /Covered by aid/);
  assert.match(financialsSource, /Borrowed through loans/);
  assert.match(financialsSource, /Federal Work-Study/);
  assert.doesNotMatch(financialsSource, /Funding package/);
});

test("financials provides visual breakdowns and safe synthetic fallback", () => {
  assert.match(financialsSource, /Cost breakdown chart/);
  assert.match(financialsSource, /Aid breakdown chart/);
  assert.match(financialsSource, /Synthetic planning data for design review/);
  assert.match(financialsSource, /No financial-aid award was issued/);
  assert.match(financialsStyles, /\.costDonut/);
  assert.match(financialsStyles, /\.aidDonut/);
  assert.match(financialsStyles, /\.coverageTrack/);
  assert.match(financialsStyles, /\.donutMetric/);
  assert.match(financialsStyles, /\.coverageMetric/);
});
