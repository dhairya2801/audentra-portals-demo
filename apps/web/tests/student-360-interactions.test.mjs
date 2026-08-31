import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(resolve(testDirectory, "../app/staff/student-360.tsx"), "utf8");
const styleSource = readFileSync(resolve(testDirectory, "../app/staff/student-360.module.css"), "utf8");
const overviewSource = readFileSync(resolve(testDirectory, "../app/staff/student-360-overview.tsx"), "utf8");

test("overview metrics navigate to their related Student 360 tabs", () => {
  assert.match(overviewSource, /onNavigate\("application"\)/);
  assert.match(overviewSource, /onNavigate\("enrollment"\)/);
  assert.match(overviewSource, /onNavigate\("documents"\)/);
  assert.match(overviewSource, /onNavigate\("financials"\)/);
});

test("timeline events expose actor attribution on hover and keyboard focus", () => {
  assert.match(componentSource, /data-tooltip=\{`\$\{event\.actorName/);
  assert.match(componentSource, /className=\{styles\.timelineEventButton\}/);
  assert.match(componentSource, /onClick=\{\(\) => onOpen\(event\)\}/);
  assert.match(styleSource, /\.timelineMark::after/);
  assert.match(styleSource, /\.timelineEventButton:focus-visible \.timelineMark::after/);
});

test("timeline activity deep-links to related Student 360 records", () => {
  assert.match(componentSource, /const timelineDestinations/);
  assert.match(componentSource, /document: "documents"/);
  assert.match(componentSource, /note: "notes"/);
  assert.match(componentSource, /focusEvent=\{timelineFocus/);
  assert.match(componentSource, /focusedDocument\?\.id/);
  assert.match(componentSource, /commentsStyles\.highlighted/);
  assert.match(componentSource, /Opened from timeline/);
});

test("application evidence and student documents open seeded previews", () => {
  assert.match(componentSource, /function EvidencePreviewDialog/);
  assert.match(componentSource, /className=\{styles\.evidenceItem\}/);
  assert.match(componentSource, /documentsStyles\.documentRow/);
  assert.match(componentSource, /student-record-sample\.pdf/);
  assert.match(componentSource, /student-record-sample-page-1\.png/);
  assert.match(componentSource, /document\.status === "placeholder" \? "Ready"/);
  assert.match(componentSource, /replace\(\/-placeholder/);
  assert.match(styleSource, /\.previewBackdrop/);
  assert.match(styleSource, /\.pdfViewport/);
});

test("enrollment progress falls back to the complete seeded enrollment record", () => {
  assert.match(componentSource, /const fallbackEnrollmentSteps = \[/);
  assert.match(componentSource, /buildEnrollmentFallback\(operation\.journey\.completedTasks\)/);
  assert.match(componentSource, /"in_review"/);
  assert.match(componentSource, /"not_started"/);
});

test("enrollment rows open contextual selections and inline completion PDFs", () => {
  assert.match(componentSource, /function RequirementDetailDialog/);
  assert.match(componentSource, /function InlinePdfViewer/);
  assert.match(componentSource, /className=\{styles\.requirementPreviewButton\}/);
  assert.match(componentSource, /Open completion details for/);
  assert.doesNotMatch(componentSource, /Open supporting PDF/);
  assert.match(componentSource, /Student selected/);
  assert.match(componentSource, /On-campus housing/);
  assert.match(componentSource, /enrollment-deposit-invoice\.pdf/);
  assert.match(componentSource, /official-transcript\.pdf/);
  assert.match(styleSource, /\.requirementDialog/);
  assert.match(styleSource, /\.selectionEvidence/);
  assert.match(styleSource, /\.requirementPdf \.pdfViewport/);
  assert.match(styleSource, /\.requirementPreviewButton:focus-visible/);
});

test("student 360 uses enrollment terminology consistently", () => {
  assert.match(componentSource, /label: "Enrollment"/);
  assert.match(componentSource, />Enrollment checklist</);
  assert.doesNotMatch(componentSource, /Enrollment Progress/);
  assert.doesNotMatch(componentSource, />Journey checklist</);
});

test("student 360 navigation separates functional and global areas", () => {
  const applicationIndex = componentSource.indexOf('{ id: "application", label: "Application" }');
  const enrollmentIndex = componentSource.indexOf('{ id: "enrollment", label: "Enrollment" }');
  const financialsIndex = componentSource.indexOf('{ id: "financials", label: "Financials" }');
  const timelineIndex = componentSource.indexOf('{ id: "timeline", label: "Timeline" }');
  const commentsIndex = componentSource.indexOf('{ id: "notes", label: "Comments" }');
  const messagesIndex = componentSource.indexOf('{ id: "messages", label: "Messages" }');
  const documentsIndex = componentSource.indexOf('{ id: "documents", label: "Documents" }');

  assert.ok(applicationIndex < enrollmentIndex);
  assert.ok(enrollmentIndex < financialsIndex);
  assert.ok(financialsIndex < timelineIndex);
  assert.ok(timelineIndex < commentsIndex);
  assert.ok(commentsIndex < messagesIndex);
  assert.ok(messagesIndex < documentsIndex);
});

test("student 360 navigation fits staff widths and scrolls on mobile", () => {
  assert.match(styleSource, /\.tabs button \{[\s\S]*flex: 1 1 0;[\s\S]*min-width: 0;/);
  assert.match(styleSource, /@media \(max-width: 760px\)[\s\S]*\.tabs button \{[\s\S]*flex: 0 0 auto;[\s\S]*min-width: max-content;/);
});

test("Student 360 removes provenance chrome and opens connected work in Task Board", () => {
  assert.doesNotMatch(componentSource, /Canonical student record/);
  assert.match(componentSource, /className=\{styles\.taskPreviewButton\}/);
  assert.match(componentSource, /onOpenWorkItem\(task\.id\)/);
  assert.match(componentSource, /aria-label=\{`Open task \$\{task\.key\}`\}/);
  assert.doesNotMatch(componentSource, /aria-labelledby="connected-task-title"/);
  assert.doesNotMatch(componentSource, /Close task details/);
});

test("melt score and risk badge share the same semantic color scale", () => {
  for (const band of ["Critical", "High", "Medium", "Low"]) {
    assert.match(styleSource, new RegExp(`\\.riskDial\\.risk${band} strong`));
    assert.match(styleSource, new RegExp(`\\.riskBadge\\.risk${band}`));
  }
});
