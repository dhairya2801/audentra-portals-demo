import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../app/staff/", import.meta.url);
const routerSource = readFileSync(new URL("student-360.tsx", root), "utf8");
const campusSource = readFileSync(new URL("student-360-campus-life.tsx", root), "utf8");
const campusStyles = readFileSync(new URL("student-360-campus-life.module.css", root), "utf8");

test("campus life is a first-class Student 360 tab", () => {
  assert.match(routerSource, /\| "campus-life"/);
  assert.match(routerSource, /id: "campus-life", label: "Campus Life"/);
  assert.match(routerSource, /<CampusLifePanel/);
});

test("campus life covers housing, athletics, readiness, and engagement", () => {
  assert.match(campusSource, /Living on campus/);
  assert.match(campusSource, /Residence hall/);
  assert.match(campusSource, /Room assignment/);
  assert.match(campusSource, /Non-athlete/);
  assert.match(campusSource, /Move-in checklist/);
  assert.match(campusSource, /Waiting on student/);
  assert.match(campusSource, /Campus engagement/);
  assert.match(campusSource, /Campus signal brief/);
  assert.match(campusSource, /Housing preferences/);
  assert.match(campusSource, /residenceConfirmed/);
  assert.match(campusStyles, /\.readinessRing/);
  assert.match(campusStyles, /\.readinessMetric/);
  assert.match(campusStyles, /\.primaryGrid/);
});
