import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

/**
 * The staff profile's derivations — every line it prints comes from a field
 * the platform holds, rendered in the member's own zone, and nothing is
 * invented for a field the record does not carry.
 */

async function importTypeScriptModule(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const load = () => importTypeScriptModule("../app/staff/staff-profile-logic.ts");

function me(overrides = {}) {
  return {
    staff: {
      id: "staff-1",
      name: "Greta Radcliffe",
      email: "greta.radcliffe@aster.example.edu",
      component: "Financial Aid",
      title: "Financial Aid Counselor",
      roleCode: "fa_counselor",
      externalRef: "SYN-STF-FA-C06",
      employmentStatus: "active",
      leaveUntil: null,
      endedAt: null,
      active: true,
      employmentType: "full_time",
      startedAt: "2021-09-01",
      timezone: "America/Los_Angeles",
      officeLocation: "Larkin Hall 210",
      caseloadCap: null,
      studentFacing: true,
      appointmentTypes: ["financial_aid"],
      managerId: "staff-2",
      ...overrides.staff,
    },
    manager: { id: "staff-2", name: "Keziah Abernathy", title: "Director of Financial Aid", component: "Financial Aid" },
    directReports: [],
    team: [],
    caseload: {
      byRole: { primary_advisor: 0, admissions_counselor: 0, financial_aid_counselor: 541, international_adviser: 0, housing_coordinator: 0 },
      primaryAdvisees: 0,
      cap: null,
      utilization: null,
      overCap: false,
      ...overrides.caseload,
    },
    work: {
      open: 55,
      overdue: 55,
      urgent: 0,
      escalated: 55,
      staleInProgress: 1,
      completedLast7Days: 0,
      appointmentsAwaitingOutcome: 16,
      ...overrides.work,
    },
    availability: {
      bookable: true,
      reason: null,
      nextOpenSlotAt: "2026-09-02T18:30:00.000Z",
      openSlotsNext14Days: 56,
      bookedNext14Days: 9,
      weekly: [
        { weekday: 2, startMinute: 780, endMinute: 960, slotMinutes: 45, modality: "either", location: "Larkin Hall 210", appointmentTypes: ["financial_aid"] },
        { weekday: 1, startMinute: 780, endMinute: 960, slotMinutes: 45, modality: "either", location: "Larkin Hall 210", appointmentTypes: ["financial_aid"] },
        { weekday: 1, startMinute: 540, endMinute: 720, slotMinutes: 45, modality: "virtual", location: null, appointmentTypes: ["financial_aid"] },
      ],
      timeOff: [],
      ...overrides.availability,
    },
    appointmentsToday: [],
    componentSummary: null,
    generatedAt: "2026-09-02T18:08:27.831Z",
  };
}

test("identity rows are the record's fields, blank where the record is blank", async () => {
  const { identityRows } = await load();
  const rows = identityRows(me({ staff: { officeLocation: null, externalRef: null } }));
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  assert.equal(byId.name.value, "Greta Radcliffe");
  assert.equal(byId.component.value, "Financial Aid");
  assert.equal(byId.email.value, "greta.radcliffe@aster.example.edu");
  assert.equal(byId.office.value, null);
  assert.equal(byId.office.blank, "No office location on record");
  assert.equal(byId["staff-id"].value, null);
  assert.equal(byId.manager.value, "Keziah Abernathy · Director of Financial Aid");
  assert.equal(byId.employment.value, "Full-time · Active");
  assert.equal(byId.started.value, "Sep 1, 2021");
  assert.equal(byId["appointment-types"].value, "Financial aid");
  assert.ok(!rows.some((row) => /phone/i.test(row.label)), "the record has no phone column, so no phone row");
});

test("times are rendered in the member's own zone, never a fixed one", async () => {
  const { whenIn, clockIn, dateIn, minuteLabel, weeklySchedule } = await load();
  assert.equal(whenIn("2026-09-02T18:30:00.000Z", "America/Los_Angeles"), "Wed, Sep 2, 11:30 AM");
  assert.equal(whenIn("2026-09-02T18:30:00.000Z", "America/New_York"), "Wed, Sep 2, 2:30 PM");
  assert.equal(clockIn("2026-09-02T18:30:00.000Z", "Asia/Kolkata"), "12:00 AM");
  assert.equal(dateIn("2021-09-01", "Pacific/Auckland"), "Sep 1, 2021");
  assert.equal(dateIn("2026-09-02T03:30:00.000Z", "America/Los_Angeles"), "Sep 1, 2026");
  assert.equal(whenIn(null, "UTC"), null);
  assert.equal(whenIn("2026-09-02T18:30:00.000Z", "Not/AZone"), "Wed, Sep 2, 6:30 PM");
  assert.equal(minuteLabel(540), "9:00 AM");
  assert.equal(minuteLabel(780), "1:00 PM");
  const schedule = weeklySchedule(me().availability.weekly);
  assert.deepEqual(
    schedule.map((day) => [day.label, day.windows.map((window) => `${window.start}–${window.end}`)]),
    [
      ["Monday", ["9:00 AM–12:00 PM", "1:00 PM–4:00 PM"]],
      ["Tuesday", ["1:00 PM–4:00 PM"]],
    ],
  );
  assert.equal(schedule[0].windows[0].modality, "Virtual");
  assert.equal(schedule[0].windows[1].location, "Larkin Hall 210");
  assert.deepEqual(weeklySchedule(undefined), []);
});

test("gaps and responsibilities come only from real fields", async () => {
  const { profileGaps, responsibilities } = await load();
  assert.deepEqual(profileGaps(me({ work: { staleInProgress: 0, appointmentsAwaitingOutcome: 0 } })), []);
  const gaps = profileGaps(
    me({
      staff: { employmentStatus: "on_leave", leaveUntil: "2026-10-01" },
      caseload: { primaryAdvisees: 126, cap: 110, utilization: 1.145, overCap: true },
      availability: { openSlotsNext14Days: 0 },
    }),
  );
  assert.match(gaps[0].text, /on leave until Oct 1, 2026/);
  assert.match(gaps[1].text, /over its cap: 126 primary advisees against 110/);
  assert.ok(!gaps.some((gap) => /no open appointment slot/.test(gap.text)), "a person on leave is not also told about slots");
  const lines = responsibilities(me());
  assert.deepEqual(lines, [
    "Financial Aid Counselor in Financial Aid.",
    "Financial aid counselor to 541 students.",
    "Takes financial aid appointments · 56 open slots in the next 14 days.",
  ]);
  const notFacing = responsibilities(me({ staff: { studentFacing: false, appointmentTypes: [] }, caseload: { byRole: {} } }));
  assert.deepEqual(notFacing, [
    "Financial Aid Counselor in Financial Aid.",
    "Not student-facing: no students are assigned to you and nothing is bookable.",
  ]);
});

test("the caseload meter and work rows carry the board filter for exactly those items", async () => {
  const { caseloadMeter, caseloadByRole, workRows } = await load();
  assert.deepEqual(caseloadMeter(me()), { primaryAdvisees: 0, cap: null, percent: null, utilizationPercent: null, overCap: false });
  assert.deepEqual(caseloadMeter(me({ caseload: { primaryAdvisees: 126, cap: 110, utilization: 1.145, overCap: true } })), {
    primaryAdvisees: 126,
    cap: 110,
    percent: 100,
    utilizationPercent: 115,
    overCap: true,
  });
  assert.deepEqual(caseloadByRole(me()), [{ role: "financial_aid_counselor", label: "Financial aid counselor", count: 541 }]);
  const rows = workRows(me().work);
  assert.deepEqual(rows.find((row) => row.id === "overdue").query, { assignee: "me", status: "open", due: "overdue" });
  assert.deepEqual(rows.find((row) => row.id === "escalated").query, { assignee: "me", status: "open", escalated: true });
  assert.deepEqual(rows.find((row) => row.id === "staleInProgress").query, { assignee: "me", status: "in_progress", stale: true });
  assert.equal(rows.find((row) => row.id === "appointmentsAwaitingOutcome").query, null);
  assert.equal(rows.find((row) => row.id === "urgent").value, 0);
});

test("appointments split on the canonical status, not on the clock alone", async () => {
  const { partitionAppointments, appointmentWindow, closeOutFailure } = await load();
  const now = Date.parse("2026-09-02T18:00:00.000Z");
  const items = [
    { id: "a", status: "scheduled", startsAt: "2026-09-02T13:45:00.000Z" },
    { id: "b", status: "scheduled", startsAt: "2026-09-03T18:00:00.000Z" },
    { id: "c", status: "completed", startsAt: "2026-08-04T13:45:00.000Z" },
    { id: "d", status: "scheduled", startsAt: "2026-08-20T13:45:00.000Z" },
    { id: "e", status: "no_show", startsAt: "2026-08-30T13:45:00.000Z" },
  ];
  const buckets = partitionAppointments(items, now);
  assert.deepEqual(buckets.awaitingOutcome.map((item) => item.id), ["a", "d"]);
  assert.deepEqual(buckets.upcoming.map((item) => item.id), ["b"]);
  assert.deepEqual(buckets.closed.map((item) => item.id), ["e", "c"]);
  const window = appointmentWindow(now);
  assert.equal(window.from, "2026-07-19T00:00:00.000Z");
  assert.equal(window.to, "2026-09-17T00:00:00.000Z");
  assert.match(closeOutFailure(403, "FORBIDDEN", "Forbidden"), /another staff member's calendar/);
  assert.match(closeOutFailure(409, "VERSION_CONFLICT", "Conflict"), /changed since the page loaded/);
  assert.equal(closeOutFailure(500, "X", "The server said no."), "The server said no.");
});

test("caseload rows filter and sort client-side over the server result", async () => {
  const { caseloadRows } = await load();
  const item = (name, overrides = {}) => ({
    role: "primary_advisor",
    assignedAt: "2026-01-01T00:00:00.000Z",
    source: "manual",
    note: null,
    student: { id: name, name, preferredName: name, externalRef: null, classYear: 2030, programName: "Biology" },
    offerStatus: "accepted",
    journeyStatus: "in_progress",
    requirements: { completed: 4, total: 8, percent: 50 },
    advising: { status: "none", lastCompletedAt: null, nextAppointmentAt: null, nextAppointmentId: null },
    work: { open: 0, overdue: 0 },
    ...overrides,
  });
  const items = [
    item("Zed", { work: { open: 2, overdue: 1 }, requirements: { completed: 1, total: 8, percent: 12 } }),
    item("Amy", { advising: { status: "completed", lastCompletedAt: "2026-08-01T00:00:00.000Z", nextAppointmentAt: null, nextAppointmentId: null } }),
    item("Bo", { role: "financial_aid_counselor", work: { open: 1, overdue: 0 }, advising: { status: "scheduled", lastCompletedAt: null, nextAppointmentAt: "2026-09-03T18:00:00.000Z", nextAppointmentId: "x" } }),
  ];
  const names = (rows) => rows.map((row) => row.student.name);
  assert.deepEqual(names(caseloadRows(items, { filter: "all", sort: "name", role: "all" })), ["Amy", "Bo", "Zed"]);
  assert.deepEqual(names(caseloadRows(items, { filter: "not_met", sort: "name", role: "all" })), ["Bo", "Zed"]);
  assert.deepEqual(names(caseloadRows(items, { filter: "open_work", sort: "open_work", role: "all" })), ["Zed", "Bo"]);
  assert.deepEqual(names(caseloadRows(items, { filter: "overdue_work", sort: "name", role: "all" })), ["Zed"]);
  assert.deepEqual(names(caseloadRows(items, { filter: "all", sort: "progress", role: "all" })), ["Zed", "Amy", "Bo"]);
  assert.deepEqual(names(caseloadRows(items, { filter: "all", sort: "next_appointment", role: "all" })), ["Bo", "Amy", "Zed"]);
  assert.deepEqual(names(caseloadRows(items, { filter: "all", sort: "name", role: "financial_aid_counselor" })), ["Bo"]);
});
