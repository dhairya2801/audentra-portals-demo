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
    signals: {
      overdue: false,
      overdueDays: null,
      stale: false,
      staleDays: null,
      ageDays: 0,
      unassigned: overrides.assignee === null,
      ownerRisk: null,
      ...(overrides.signals ?? {}),
    },
    ...overrides,
    ...(overrides.signals
      ? {
          signals: {
            overdue: false,
            overdueDays: null,
            stale: false,
            staleDays: null,
            ageDays: 0,
            unassigned: false,
            ownerRisk: null,
            ...overrides.signals,
          },
        }
      : {}),
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

test("toolbar filters map onto the bounded Action Center query", async () => {
  const { emptyTaskBoardFilters, buildActionCenterQuery } = await importTypeScriptModule(
    "../app/staff/task-board-utils.ts",
  );
  assert.deepEqual(buildActionCenterQuery(emptyTaskBoardFilters), {
    status: "open",
    priority: undefined,
    component: undefined,
    assignee: undefined,
    search: undefined,
    due: undefined,
    stale: undefined,
    ownerRisk: undefined,
    sort: "priority",
    limit: 100,
    offset: 0,
  });

  const narrowed = buildActionCenterQuery(
    {
      ...emptyTaskBoardFilters,
      query: "  transcript ",
      ownership: "mine",
      priority: "high",
      status: "blocked",
      component: "Enrollment Support",
      dueWindow: "today",
      stale: true,
      ownerRisk: true,
      sort: "stale",
    },
    { limit: 25, offset: 200 },
  );
  assert.equal(narrowed.search, "transcript");
  assert.equal(narrowed.assignee, "me");
  assert.equal(narrowed.status, "blocked");
  assert.equal(narrowed.due, "today");
  assert.equal(narrowed.stale, true);
  assert.equal(narrowed.ownerRisk, true);
  assert.equal(narrowed.sort, "stale");
  assert.equal(narrowed.limit, 25);
  assert.equal(narrowed.offset, 200);

  // The ownership scope wins over a stale assignee choice; a specific person is passed by id.
  assert.equal(
    buildActionCenterQuery({ ...emptyTaskBoardFilters, ownership: "unassigned", assigneeId: "staff-9" })
      .assignee,
    "unassigned",
  );
  assert.equal(
    buildActionCenterQuery({ ...emptyTaskBoardFilters, assigneeId: "staff-9" }).assignee,
    "staff-9",
  );
});

test("query serialization omits undefined and writes booleans literally", async () => {
  const { actionCenterQueryToParams } = await importTypeScriptModule(
    "../app/staff/task-board-utils.ts",
  );
  const params = actionCenterQueryToParams({
    status: "open",
    priority: undefined,
    component: "Financial Aid",
    search: "",
    stale: true,
    ownerRisk: false,
    escalated: undefined,
    sort: "due",
    limit: 100,
    offset: 0,
  });
  assert.equal(
    params.toString(),
    "status=open&component=Financial+Aid&stale=true&ownerRisk=false&sort=due&limit=100&offset=0",
  );
});

test("a deep-linked query round-trips into toolbar state", async () => {
  const { filtersFromActionCenterQuery, buildActionCenterQuery, emptyTaskBoardFilters } =
    await importTypeScriptModule("../app/staff/task-board-utils.ts");
  const query = {
    status: "all",
    assignee: "unassigned",
    component: "Registrar",
    due: "overdue",
    ownerRisk: true,
    sort: "updated",
    limit: 50,
  };
  const filters = filtersFromActionCenterQuery(query);
  assert.equal(filters.ownership, "unassigned");
  assert.equal(filters.assigneeId, "all");
  assert.equal(filters.status, "all");
  assert.equal(filters.dueWindow, "overdue");
  assert.equal(filters.ownerRisk, true);
  assert.equal(filters.stale, false);
  assert.equal(filters.sort, "updated");
  const rebuilt = buildActionCenterQuery(filters);
  assert.equal(rebuilt.assignee, "unassigned");
  assert.equal(rebuilt.component, "Registrar");
  assert.equal(rebuilt.due, "overdue");
  assert.equal(rebuilt.ownerRisk, true);
  // A nonsense status falls back to open work rather than an unfiltered board.
  assert.equal(filtersFromActionCenterQuery({ status: "bogus" }).status, "open");
  assert.deepEqual(filtersFromActionCenterQuery(null), emptyTaskBoardFilters);
});

test("the board shows open columns by default and groups loaded items in one pass", async () => {
  const { visibleWorkStatuses, groupWorkItemsByStatus } = await importTypeScriptModule(
    "../app/staff/task-board-utils.ts",
  );
  assert.deepEqual(visibleWorkStatuses("open"), [
    "todo",
    "in_progress",
    "follow_up_required",
    "blocked",
  ]);
  assert.deepEqual(visibleWorkStatuses("closed"), ["done", "cancelled"]);
  assert.equal(visibleWorkStatuses("all").length, 6);
  assert.deepEqual(visibleWorkStatuses("done"), ["done"]);

  const grouped = groupWorkItemsByStatus([
    workItem({ key: "A", status: "todo" }),
    workItem({ key: "B", status: "blocked" }),
    workItem({ key: "C", status: "todo" }),
  ]);
  assert.deepEqual(grouped.todo.map((item) => item.key), ["A", "C"]);
  assert.deepEqual(grouped.blocked.map((item) => item.key), ["B"]);
  assert.deepEqual(grouped.done, []);
});

test("owner and availability badges are worded from the server signals", async () => {
  const { ownerRiskLabel, staffAvailabilityNote } = await importTypeScriptModule(
    "../app/staff/task-board-utils.ts",
  );
  const onLeave = {
    id: "s1",
    name: "Priya Shah",
    email: "p@example.edu",
    component: "Enrollment Support",
    employmentStatus: "on_leave",
    leaveUntil: "2026-09-15",
  };
  assert.equal(
    ownerRiskLabel(workItem({ assignee: onLeave, signals: { ownerRisk: "on_leave" } })),
    "Owner on leave until 2026-09-15",
  );
  assert.equal(
    ownerRiskLabel(workItem({ signals: { ownerRisk: "departed" } })),
    "Owner departed",
  );
  assert.equal(
    ownerRiskLabel(
      workItem({
        assignee: { ...onLeave, employmentStatus: "active", leaveUntil: null, awayUntil: "2026-08-30T00:00:00.000Z" },
        signals: { ownerRisk: "away" },
      }),
    ),
    "Owner away until 2026-08-30",
  );
  assert.equal(ownerRiskLabel(workItem({ signals: { ownerRisk: null } })), null);
  assert.equal(staffAvailabilityNote(onLeave), "on leave until 2026-09-15");
  assert.equal(staffAvailabilityNote({ ...onLeave, employmentStatus: "departed" }), "departed");
  assert.equal(staffAvailabilityNote({ ...onLeave, employmentStatus: "active", leaveUntil: null }), null);
});

test("the task board pages the server instead of filtering the workspace payload", async () => {
  const [client, portal, card] = await Promise.all([
    readFile(new URL("../app/lib/api-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/staff/staff-portal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/staff/staff-action-center.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(client, /getStaffActionCenter\(\s*query: StaffActionCenterQuery = \{\}/);
  assert.match(client, /actionCenterQueryToParams\(query\)/);
  assert.match(client, /`\/v1\/staff\/action-center\$\{suffix\}`/);

  const board = portal.slice(
    portal.indexOf("function TaskBoardView("),
    portal.indexOf("function StaffDialog("),
  );
  assert.doesNotMatch(board, /filterAndSortStaffWorkItems/);
  assert.doesNotMatch(board, /workspace\.actionCenter\.items/);
  assert.match(board, /TASK_BOARD_PAGE_SIZE/);
  assert.match(board, /Showing \$\{items\.length\} of \$\{total\} tasks/);
  assert.match(board, /Load more/);
  assert.match(board, /window\.setTimeout\(\(\) => setDebouncedQuery\(filters\.query\), 300\)/);
  assert.match(board, /updateFilter\("stale", !filters\.stale\)/);
  assert.match(board, /updateFilter\("ownerRisk", !filters\.ownerRisk\)/);
  assert.match(board, /facets\?\.components/);
  assert.match(board, /facets\?\.assignees/);
  assert.match(board, /initialQuery/);
  assert.match(card, /staff-signal staff-signal--overdue/);
  assert.match(card, /staff-signal staff-signal--stale/);
  assert.match(card, /staff-signal staff-signal--owner/);
  assert.match(card, /staff-signal staff-signal--unassigned/);
  // The student directory never counts open items from a partial page.
  assert.doesNotMatch(portal, /open items<\/small>/);
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
