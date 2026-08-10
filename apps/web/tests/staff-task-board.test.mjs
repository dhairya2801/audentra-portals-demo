import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function importTypeScriptModule(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  return import(moduleUrl);
}

function workItem(overrides = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    key: overrides.key ?? "MAN-100",
    title: overrides.title ?? "Enrollment follow-up",
    description: overrides.description ?? "Contact the student.",
    status: overrides.status ?? "todo",
    priority: overrides.priority ?? "medium",
    type: overrides.type ?? "enrollment",
    actionType: overrides.actionType ?? "enrollment_follow_up",
    component: overrides.component ?? "Enrollment Support",
    dueAt: overrides.dueAt ?? null,
    escalated: false,
    selectedChannel: null,
    attemptCount: 0,
    followUpAt: null,
    blocker: null,
    outcomeCode: null,
    resolutionCode: null,
    nextStep: null,
    terminalReason: null,
    startedAt: null,
    interactionCompletedAt: null,
    completedAt: null,
    cancelledAt: null,
    version: 1,
    createdAt: overrides.createdAt ?? "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
    assignee:
      overrides.assignee === undefined
        ? { id: "staff-me", name: "Priya Shah", email: "priya@example.edu", component: "Enrollment Support" }
        : overrides.assignee,
    student: {
      id: "student-1",
      name: overrides.studentName ?? "Taylor Nguyen",
      preferredName: "Taylor",
      programName: "Computer Science",
      classYear: 2027,
    },
    source: null,
    history: [],
    ...overrides,
  };
}

test("task board sorts by priority, due date, created time, and key", async () => {
  const { compareStaffWorkItems } = await importTypeScriptModule(
    "../app/staff/task-board-utils.ts",
  );
  const items = [
    workItem({ key: "LOW-1", priority: "low" }),
    workItem({ key: "HIGH-2", priority: "high", dueAt: "2026-08-11T12:00:00.000Z" }),
    workItem({ key: "URG-1", priority: "urgent" }),
    workItem({ key: "HIGH-1", priority: "high", dueAt: "2026-08-10T12:00:00.000Z" }),
    workItem({ key: "MED-1", priority: "medium" }),
  ];

  assert.deepEqual(items.sort(compareStaffWorkItems).map((item) => item.key), [
    "URG-1",
    "HIGH-1",
    "HIGH-2",
    "MED-1",
    "LOW-1",
  ]);
});

test("task board combines ownership, task, priority, status, team, and due filters", async () => {
  const { emptyTaskBoardFilters, filterAndSortStaffWorkItems } =
    await importTypeScriptModule("../app/staff/task-board-utils.ts");
  const now = new Date("2026-08-09T12:00:00.000Z");
  const items = [
    workItem({
      key: "MATCH-1",
      priority: "high",
      status: "todo",
      dueAt: "2026-08-09T18:00:00.000Z",
      title: "Transcript review",
    }),
    workItem({
      key: "OTHER-1",
      priority: "low",
      assignee: null,
      dueAt: "2026-08-12T18:00:00.000Z",
    }),
  ];
  const result = filterAndSortStaffWorkItems(
    items,
    {
      ...emptyTaskBoardFilters,
      query: "transcript",
      ownership: "mine",
      workType: "enrollment",
      priority: "high",
      status: "todo",
      component: "Enrollment Support",
      dueWindow: "today",
    },
    "staff-me",
    now,
  );
  assert.deepEqual(result.map((item) => item.key), ["MATCH-1"]);
});

test("create-task client and form use the canonical backend contract", async () => {
  const [contracts, client, portal] = await Promise.all([
    readFile(new URL("../../../packages/contracts/src/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/api-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/staff/staff-portal.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(contracts, /flowKind:\s*"enrollment" \| "onboarding"/);
  assert.match(contracts, /requirementId\?: string \| null/);
  assert.match(contracts, /actionType\?: StaffActionType \| null/);
  assert.match(client, /CreateStaffWorkItemInput/);
  assert.match(client, /"\/v1\/staff\/work-items"/);
  assert.doesNotMatch(client, /export interface CreateStaffWorkItemInput/);
  assert.match(portal, /name="flowKind"/);
  assert.match(portal, /name="actionType"/);
  assert.match(portal, /create-task-student-search/);
  assert.doesNotMatch(portal, /name="workType"/);
});

test("realtime client bootstraps without a replay cursor and suppresses ready events", async () => {
  const realtime = await readFile(
    new URL("../app/staff/staff-realtime.ts", import.meta.url),
    "utf8",
  );
  assert.match(realtime, /let cursor: number \| null = null/);
  assert.match(realtime, /cursor === null[\s\S]*\/v1\/staff\/events`/);
  assert.match(realtime, /\?after=\$\{encodeURIComponent/);
  assert.match(
    realtime,
    /event\.type !== "staff\.stream\.ready"\) onEvent\(event\)/,
  );
});

test("realtime banners explain the event instead of labeling every update as an inquiry", async () => {
  const portal = await readFile(
    new URL("../app/staff/staff-portal.tsx", import.meta.url),
    "utf8",
  );
  assert.match(portal, /function realtimeNoticeFor/);
  assert.match(portal, /event\.type === "staff\.ai_update\.available"/);
  assert.match(portal, /return null;/);
  assert.match(portal, /Action SLA is overdue/);
  assert.match(portal, /The due time passed, so the scheduler escalated this action/);
  assert.match(portal, /Document parsing needs human review/);
  assert.doesNotMatch(portal, /title: "New student inquiry\/update available"/);
  assert.match(portal, /<p>\{realtimeNotice\.body\}<\/p>/);
});

test("consumer requirement status supports the canonical help-requested state", async () => {
  const [contracts, styles] = await Promise.all([
    readFile(new URL("../../../packages/contracts/src/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(contracts, /\| "help_requested"/);
  assert.match(styles, /\.resource-status--help_requested/);
});
