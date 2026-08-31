import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readStudent360Sources = () =>
  Promise.all([
    readFile(new URL("../app/staff/student-360.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/staff/student-360.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/staff/staff-portal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/api-client.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../../../packages/contracts/src/index.ts", import.meta.url),
      "utf8",
    ),
  ]);

test("Student 360 is a primary staff workspace tab with all ten sections", async () => {
  const [component, , portal] = await readStudent360Sources();
  // Student 360 is its own place in the workspace, below the Task board, not a
  // replacement for the Student records directory the portal already had.
  assert.match(
    portal,
    /\{ id: "tasks", label: "Task board".*\n\s*\{ id: "student_360", label: "Student 360"/,
  );
  assert.match(portal, /view === "student_360" \? \(/);
  assert.match(portal, /<Student360Workspace\n\s*workspace=\{workspace\}\n\s*refresh=\{refresh\}/);
  for (const label of [
    "Overview",
    "Application",
    "Enrollment",
    "Financials",
    "Academics",
    "Campus Life",
    "Timeline",
    "Comments",
    "Messages",
    "Documents",
  ]) {
    assert.match(component, new RegExp(`label: "${label}"`));
  }
  assert.match(component, /role="tablist"/);
  assert.match(component, /role="tabpanel"/);
});

test("student directory exposes professional search, filters, and melt-risk sorting", async () => {
  const [component] = await readStudent360Sources();
  assert.match(component, /Search by student, program, or signal/);
  assert.match(component, />Program</);
  assert.match(component, />Stage</);
  assert.match(component, />Melt risk</);
  assert.match(component, /Highest melt risk/);
  assert.match(
    component,
    /right\.risk\.meltLikelihoodPercent - left\.risk\.meltLikelihoodPercent/,
  );
});

test("timeline can hide website movement while preserving enrollment and staff history", async () => {
  const [component, , , , contracts] = await readStudent360Sources();
  assert.match(component, /const \[showWebsite, setShowWebsite\] = useState\(true\)/);
  assert.match(component, /showWebsite \|\| event\.category !== "website"/);
  assert.match(component, /Website movements/);
  assert.match(contracts, /\| "website"/);
  assert.match(contracts, /\| "enrollment"/);
  assert.match(contracts, /\| "staff_task"/);
});

test("application, enrollment, comments, documents, and financials expose the requested evidence", async () => {
  const [component, , , client, contracts] = await readStudent360Sources();
  assert.match(component, /Readiness evidence/);
  assert.match(component, /Essays/);
  assert.match(component, /Recommendations/);
  assert.match(component, /Artifacts/);
  assert.match(component, /Enrollment checklist/);
  assert.doesNotMatch(component, /Journey checklist/);
  assert.match(component, /Staff and workflow tasks/);
  assert.match(component, /Approve document/);
  assert.match(component, /Request replacement/);
  assert.match(component, /Date\.parse\(right\.createdAt\) - Date\.parse\(left\.createdAt\)/);
  assert.match(component, /FinancialAidPanel/);
  assert.match(component, /Enrollment deposit/);
  assert.match(client, /\/v1\/staff\/students\/\$\{encodeURIComponent\(studentId\)\}\/notes/);
  assert.match(contracts, /export interface StaffStudentApplicationSnapshot/);
  assert.match(contracts, /financials: StudentFinancials/);
});

test("Student 360 uses the Audentra palette and responsive layouts rather than a green-heavy theme", async () => {
  const [, css] = await readStudent360Sources();
  assert.match(css, /--s360-blue: #2463d4/);
  assert.match(css, /--s360-navy: #102b4f/);
  assert.match(css, /--s360-coral: #d8664d/);
  assert.match(css, /--s360-amber: #b97710/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.doesNotMatch(css, /--s360-green/);
});

test("student directory and Student 360 render as separate screens", async () => {
  const [component, css] = await readStudent360Sources();
  assert.match(component, /data-mode=\{recordOpen \? "detail" : "list"\}/);
  assert.match(component, /setRecordOpen\(true\)/);
  assert.match(component, /Back to all students/);
  assert.match(css, /\.root\[data-mode="list"\] \.record/);
  assert.match(css, /\.root\[data-mode="detail"\] \.directory/);
});
