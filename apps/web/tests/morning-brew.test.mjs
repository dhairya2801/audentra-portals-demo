import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

/**
 * Contract-rendering tests for the Morning Brew builder.
 *
 * The builder is the one place where the canonical payload becomes what a
 * leader reads, so the invariants asserted here are the product promises:
 * preferences may only subtract, absent facts stay absent, and no value ever
 * appears on screen that the API did not send.
 */

/**
 * The builder imports its sibling catalogue, so the whole flat module group is
 * transpiled into one temporary directory rather than a single data: URL —
 * a data: URL cannot resolve a relative specifier.
 */
const SOURCE_DIR = new URL("../app/staff/morning-brew/", import.meta.url);
const MODULES = ["data", "catalog", "news", "preferences", "types"];

let compiledDir = null;

async function compileMorningBrew() {
  if (compiledDir) return compiledDir;
  const directory = await mkdtemp(join(tmpdir(), "audentra-brew-"));
  for (const name of MODULES) {
    const source = await readFile(new URL(`${name}.ts`, SOURCE_DIR), "utf8");
    const compiled = ts
      .transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      })
      .outputText.replace(/from "\.\/([a-z-]+)"/g, 'from "./$1.mjs"');
    await writeFile(join(directory, `${name}.mjs`), compiled, "utf8");
  }
  compiledDir = directory;
  return directory;
}

async function importMorningBrewModule(name) {
  const directory = await compileMorningBrew();
  return import(pathToFileURL(join(directory, `${name}.mjs`)).href);
}

const load = () => importMorningBrewModule("data");
const loadPreferences = () => importMorningBrewModule("preferences");

function cohort(overrides = {}) {
  return {
    key: "deposit_paid",
    label: "students with a posted deposit",
    filter: { depositState: "paid" },
    clauses: ["deposit state = paid"],
    question: "Which students have paid their enrollment deposit?",
    ...overrides,
  };
}

function metric(overrides = {}) {
  return {
    id: "deposits",
    topic: "admissions",
    label: "Deposit paid",
    icon: "$",
    format: "int",
    definition: "Students with a succeeded enrollment-deposit payment.",
    source: "canonical_postgres",
    cohort: cohort(),
    frames: [
      {
        windowId: "now",
        value: 8,
        window: "Deposit posted",
        basisLabel: "of accepted students (11)",
        basisValue: 11,
        basisPercent: 72.7,
        note: "Students with a succeeded enrollment-deposit payment.",
        unavailable: false,
        change: {
          value: 4,
          label: "+4",
          direction: "up",
          favorable: true,
          comparison: "in the last 24 hours",
          basis: "payment_transaction.created_at",
        },
      },
      {
        windowId: "day",
        value: 4,
        window: "Posted in the last 24 hours",
        basisLabel: "of 8 total",
        basisValue: 8,
        basisPercent: 50,
        note: "A succeeded enrollment-deposit payment is written once.",
        unavailable: false,
        change: null,
      },
    ],
    segments: [],
    ...overrides,
  };
}

function brew(overrides = {}) {
  return {
    generatedAt: "2026-08-16T11:30:00.000Z",
    window: {
      id: "day",
      hours: 24,
      label: "the last 24 hours",
      since: "2026-08-15T11:30:00.000Z",
      basis: "A rolling window ending at read time.",
    },
    windows: [
      { id: "now", label: "Now", short: "NOW", description: "Canonical state at read time" },
      { id: "day", label: "Last 24 hours", short: "24H", description: "Timestamped events" },
    ],
    population: { students: 14, cohorts: { roster: 14, deposit_paid: 8 } },
    synthesis: {
      headline: "4 deposits posted in the last 24 hours.",
      bullets: ["3 deposited students have an overdue requirement."],
      source: "deterministic",
      basis: "Composed from the counted cohorts in this payload.",
    },
    metrics: [metric()],
    changes: [
      {
        id: "deposits_posted",
        topic: "admissions",
        title: "Enrollment deposits posted",
        count: 4,
        metric: "4 deposits posted",
        detail: "4 deposits posted in the last 24 hours.",
        tone: "positive",
        occurredAt: "2026-08-16T09:15:00.000Z",
        destination: "students",
        basis: "payment_transaction.created_at",
        basisNote: "Written once, when it posts.",
        exact: true,
      },
      {
        id: "offers_accepted",
        topic: "admissions",
        title: "Admission offers accepted",
        count: 0,
        metric: "0 offers accepted",
        detail: "Nothing recorded in the last 24 hours.",
        tone: "neutral",
        occurredAt: null,
        destination: "students",
        basis: "admission_offer.accepted_at",
        basisNote: "Set once and never rewritten.",
        exact: true,
      },
    ],
    attention: [
      {
        id: "deposited-overdue",
        topic: "student_success",
        label: "Enrollment Operations",
        title: "Deposited students with overdue requirements",
        severity: "high",
        summary: "3 deposited students with an overdue requirement.",
        scope: "3 of 14 students on the roster",
        impactLabel: "Affected students",
        impact: [{ label: "3 students", tone: "negative" }],
        recommendedAction: "Clear the overdue requirements first.",
        priorityLevel: "High",
        destination: "students",
        cohort: cohort({ key: "deposited_overdue" }),
        detail: {
          narrative: ["They already committed money."],
          drivers: [],
          breakdown: [],
          breakdownNote: null,
          actions: [],
          students: [],
          studentsNote: null,
          evidence: [],
        },
      },
      {
        id: "housing-blocked",
        topic: "housing",
        label: "Housing",
        title: "Students blocked on housing",
        severity: "medium",
        summary: "2 students whose housing step is blocked.",
        scope: "2 of 14 students on the roster",
        impactLabel: "Affected students",
        impact: [{ label: "2 students", tone: "negative" }],
        recommendedAction: "Clear the prerequisite.",
        priorityLevel: "Medium",
        destination: "campus_life",
        cohort: cohort({ key: "housing_blocked" }),
        detail: {
          narrative: [],
          drivers: [],
          breakdown: [],
          breakdownNote: null,
          actions: [],
          students: [],
          studentsNote: null,
          evidence: [],
        },
      },
    ],
    priorities: [
      {
        id: "urgent-work",
        topic: "student_success",
        title: "Urgent or escalated Action Center items",
        count: 2,
        level: "High",
        icon: "⚑",
        detail: "2 urgent of 3 open items.",
        linkLabel: "Open the Action Center",
        destination: "tasks",
        window: "Today",
        breakdown: [{ label: "Open items", value: "3" }],
        steps: ["Assign the unassigned items first."],
      },
    ],
    deadlines: [
      {
        id: "requirement:official_transcript:overdue",
        kind: "requirement",
        code: "official_transcript",
        title: "Submit your official transcript",
        dueAt: "2026-07-29T00:00:00.000Z",
        latestDueAt: "2026-07-29T00:00:00.000Z",
        bucket: "overdue",
        relativeLabel: "18d overdue",
        students: 6,
        priority: "high",
        detail: "6 students past this date.",
        destination: "students",
      },
      {
        id: "requirement:housing_preference:this_week",
        kind: "requirement",
        code: "housing_preference",
        title: "Choose your housing preference",
        dueAt: "2026-08-20T00:00:00.000Z",
        latestDueAt: "2026-08-21T00:00:00.000Z",
        bucket: "this_week",
        relativeLabel: "from in 4d",
        students: 3,
        priority: "medium",
        detail: "3 students due, due dates staggered.",
        destination: "students",
      },
    ],
    requests: {
      items: [
        {
          id: "inq-1",
          subject: "Deposit receipt",
          summary: "I paid but the portal still shows unpaid.",
          status: "new",
          priority: "high",
          topicCode: "payments",
          studentName: "Maya Kim",
          programName: "Health Sciences",
          assigneeName: null,
          createdAt: "2026-08-15T18:00:00.000Z",
          lastMessageAt: "2026-08-15T18:00:00.000Z",
          waitingHours: 17,
          waitingLabel: "17h ago",
          destination: "messages",
        },
      ],
      total: 1,
      awaitingFirstReply: 1,
      unassigned: 1,
    },
    staffWork: {
      openItems: 3,
      urgent: 2,
      escalated: 0,
      overdue: 0,
      unassigned: 1,
      assignedToMe: 1,
    },
    staffCapacity: staffCapacity(),
    engagementScan: { available: false, snapshots: 0, lastProjectedAt: null },
    coverage: {
      source: "canonical_postgres",
      notes: ["Every figure is a count of canonical PostgreSQL rows."],
      unsupported: [{ metric: "Yield forecasts", reason: "No validated model exists." }],
    },
    ...overrides,
  };
}

function staffCapacity(overrides = {}) {
  return {
    available: true,
    summary: {
      staff: 88,
      active: 86,
      onLeave: 1,
      departed: 1,
      awayNow: 6,
      overCap: 1,
      fallingBehind: 0,
      spareCapacity: 1,
      itemsOwnedByUnavailable: 110,
      staleItems: 0,
      unassignedItems: 0,
      acceptedWithoutAdviser: 0,
      depositedWithoutAdviser: 0,
      studentsWithDepartedAdviser: 4,
      studentsWithAdviserOnLeave: 3,
      signalKinds: ["departed_with_caseload", "on_leave_with_caseload", "spare_capacity"],
      signalsTotal: 3,
    },
    signals: [
      {
        id: "departed:staff-7",
        kind: "departed_with_caseload",
        severity: "critical",
        title: "Jordan Lee departed with 62 open items",
        detail: "62 open items are still assigned to a departed adviser.",
        count: 62,
        action: "Reassign the caseload.",
        staff: { id: "staff-7", name: "Jordan Lee", title: null, component: "Registrar", employmentStatus: "departed" },
        component: "Registrar",
        destination: "tasks",
        boardQuery: { assignee: "staff-7", status: "open" },
      },
      {
        id: "spare:staff-2",
        kind: "spare_capacity",
        severity: "positive",
        title: "Sam Ortiz has room for more",
        detail: "3 open items against a cap of 20.",
        count: 3,
        action: "Route new work here.",
        staff: { id: "staff-2", name: "Sam Ortiz", title: null, component: "Admissions", employmentStatus: "active" },
        component: "Admissions",
        destination: "tasks",
        boardQuery: null,
      },
    ],
    signalsOmitted: 0,
    components: [
      {
        component: "Registrar",
        open: 140,
        overdue: 30,
        unassigned: 4,
        stale: 9,
        urgent: 2,
        ownerRisk: 62,
        oldestOverdueDays: 41,
      },
    ],
    basis: "Counted from staff_member, staff_absence, and staff_work_item at read time.",
    ...overrides,
  };
}

async function preferences(overrides = {}) {
  const { DEFAULT_BREW_PREFERENCES } = await loadPreferences();
  return {
    ...DEFAULT_BREW_PREFERENCES,
    version: 6,
    updatedAt: "",
    onboardingComplete: true,
    ...overrides,
  };
}

/** Per-source overrides, merged over the defaults: `{ news: { enabled: false } }`. */
async function sources(overrides = {}) {
  const { DEFAULT_BREW_PREFERENCES } = await loadPreferences();
  return Object.fromEntries(
    Object.entries(DEFAULT_BREW_PREFERENCES.sources).map(([id, source]) => [
      id,
      { ...source, ...(overrides[id] ?? {}) },
    ]),
  );
}

test("the briefing renders only values the API sent", async () => {
  const { buildBrewBriefing } = await load();
  const briefing = buildBrewBriefing(brew(), await preferences(), "Priya Shah");

  assert.equal(briefing.greetingName, "Priya");
  assert.equal(briefing.students, 14);
  assert.equal(briefing.deck, "4 deposits posted in the last 24 hours.");
  assert.equal(briefing.windowLabel, "the last 24 hours");

  const kpi = briefing.kpis[0];
  assert.equal(kpi.frames.now.numeric, 8);
  assert.equal(kpi.frames.now.basisPercent, 72.7);
  assert.equal(kpi.frames.now.delta, "+4");
  assert.equal(kpi.frames.day.numeric, 4);
  // The share bar replaced a "% to target"; there is no target to render.
  assert.equal("target" in kpi.frames.now, false);
  assert.equal(kpi.cohort.question, "Which students have paid their enrollment deposit?");
});

test("comparison windows come from the API, never from a fixed list", async () => {
  const { buildBrewBriefing } = await load();
  const narrowed = brew({
    windows: [{ id: "now", label: "Now", short: "NOW", description: "State at read time" }],
  });
  const briefing = buildBrewBriefing(narrowed, await preferences(), "Priya Shah");
  assert.deepEqual(
    briefing.timeframes.map((frame) => frame.id),
    ["now"],
  );
});

test("a metric with no reconstructable change reports that, not a number", async () => {
  const { buildBrewBriefing } = await load();
  const untracked = brew({
    metrics: [
      metric({
        frames: [
          metric().frames[0],
          {
            windowId: "day",
            value: 8,
            window: "No 24-hour change is reconstructable",
            basisLabel: null,
            basisValue: null,
            basisPercent: null,
            note: "This is a state count.",
            unavailable: true,
            change: null,
          },
        ],
      }),
    ],
  });
  const briefing = buildBrewBriefing(untracked, await preferences(), "Priya Shah");
  const day = briefing.kpis[0].frames.day;
  assert.equal(day.unavailable, true);
  assert.equal(day.delta, null);
  assert.equal(day.comparison, null);
});

test("topics only ever subtract from the briefing", async () => {
  const { buildBrewBriefing } = await load();
  const source = brew();
  const all = buildBrewBriefing(
    source,
    await preferences({ topics: ["admissions", "student_success", "housing", "registrar"] }),
    "Priya Shah",
  );
  const narrow = buildBrewBriefing(
    source,
    await preferences({ topics: ["student_success"] }),
    "Priya Shah",
  );

  assert.equal(all.insights.length, 2);
  assert.equal(narrow.insights.length, 1);
  assert.equal(narrow.insights[0].topic, "student_success");
  // The admissions KPI is gone entirely rather than substituted.
  assert.equal(all.kpis.length, 1);
  assert.equal(narrow.kpis.length, 0);
  // Nothing appears in the narrowed briefing that was absent from the wide one.
  const wideIds = new Set(all.insights.map((item) => item.id));
  for (const item of narrow.insights) assert.ok(wideIds.has(item.id));
});

test("switched-off sections render empty rather than filled with something else", async () => {
  const { buildBrewBriefing } = await load();
  const briefing = buildBrewBriefing(
    brew(),
    await preferences({
      sources: await sources({
        pulse: { enabled: false },
        news: { enabled: false },
        calendar: { enabled: false },
        email: { enabled: false },
        actions: { enabled: false },
        intelligence: { enabled: false },
      }),
    }),
    "Priya Shah",
  );

  assert.deepEqual(briefing.kpis, []);
  assert.deepEqual(briefing.insights, []);
  assert.deepEqual(briefing.news, []);
  assert.deepEqual(briefing.deadlines, []);
  assert.deepEqual(briefing.requests, []);
  assert.deepEqual(briefing.priorities, []);
  assert.deepEqual(briefing.bullets, []);
  assert.equal(briefing.glance.requests, 0);
  assert.equal(briefing.glance.deadlinesOverdue, 0);
});

test("an empty tenant produces an empty briefing, not a placeholder one", async () => {
  const { buildBrewBriefing } = await load();
  const empty = brew({
    population: { students: 0, cohorts: {} },
    metrics: [],
    changes: [],
    attention: [],
    priorities: [],
    deadlines: [],
    requests: { items: [], total: 0, awaitingFirstReply: 0, unassigned: 0 },
    synthesis: {
      headline: "No students are on the roster for this tenant yet.",
      bullets: [],
      source: "deterministic",
      basis: "Composed from the counted cohorts in this payload.",
    },
  });
  const briefing = buildBrewBriefing(empty, await preferences(), "Priya Shah");

  assert.equal(briefing.students, 0);
  assert.deepEqual(briefing.kpis, []);
  assert.deepEqual(briefing.insights, []);
  assert.deepEqual(briefing.deadlines, []);
  assert.deepEqual(briefing.requests, []);
  assert.equal(briefing.deck, "No students are on the roster for this tenant yet.");
});

test("each source's own detail level bounds only its own section", async () => {
  const { buildBrewBriefing } = await load();
  const glance = buildBrewBriefing(
    brew(),
    await preferences({ sources: await sources({ calendar: { detail: "glance" } }) }),
    "P S",
  );
  const deep = buildBrewBriefing(
    brew(),
    await preferences({ sources: await sources({ calendar: { detail: "deep" } }) }),
    "P S",
  );

  // Asking for more Calendar lengthens the Calendar section and nothing else.
  assert.ok(deep.deadlines.length >= glance.deadlines.length);
  assert.equal(glance.deadlines.length, Math.min(3, deep.deadlines.length));
  assert.equal(glance.requests.length, deep.requests.length);
  assert.equal(glance.kpis.length, deep.kpis.length);

  // Nothing appears at depth that was absent at a glance.
  const deepIds = new Set(deep.deadlines.map((item) => item.id));
  for (const item of glance.deadlines) assert.ok(deepIds.has(item.id));

  // The read-time estimate describes what is on the page, not a setting.
  assert.ok(deep.readTimeMinutes >= glance.readTimeMinutes);
});

test("higher-ed news is a curated feed, filtered by topic and never counted", async () => {
  const { buildBrewBriefing } = await load();
  const briefing = buildBrewBriefing(brew(), await preferences(), "Priya Shah");

  assert.ok(briefing.news.length);
  for (const item of briefing.news) {
    assert.ok(item.publisher, "every story is credited");
    assert.match(item.url, /^https:\/\//, "every story links out");
    assert.ok(item.publishedLabel, "every story is dated");
  }

  // It answers to the topic filter like every other section.
  const narrow = buildBrewBriefing(brew(), await preferences({ topics: ["housing"] }), "P S");
  assert.ok(narrow.news.every((item) => item.topic === "housing"));
  assert.ok(narrow.news.length < briefing.news.length);

  // Switched off, it is empty rather than replaced by something else.
  const off = buildBrewBriefing(
    brew(),
    await preferences({ sources: await sources({ news: { enabled: false } }) }),
    "P S",
  );
  assert.deepEqual(off.news, []);
});

test("deadlines and requests are routed to the topic that owns them", async () => {
  const { buildBrewBriefing } = await load();
  const briefing = buildBrewBriefing(
    brew(),
    await preferences({ topics: ["registrar", "housing", "admissions"] }),
    "Priya Shah",
  );

  const transcript = briefing.deadlines.find((item) => item.code === "official_transcript");
  const housing = briefing.deadlines.find((item) => item.code === "housing_preference");
  assert.equal(transcript.topic, "registrar");
  assert.equal(housing.topic, "housing");
  assert.equal(housing.relativeLabel, "from in 4d");
  assert.equal(briefing.requests[0].topic, "admissions");
});

test("an urgent request survives a topic filter that would otherwise drop it", async () => {
  const { buildBrewBriefing } = await load();
  const urgent = brew();
  urgent.requests.items[0].priority = "urgent";
  urgent.requests.items[0].topicCode = "support";
  const briefing = buildBrewBriefing(
    urgent,
    await preferences({ topics: ["housing"] }),
    "Priya Shah",
  );
  assert.equal(briefing.requests.length, 1);
});

test("coverage travels with the briefing so the page can state its limits", async () => {
  const { buildBrewBriefing } = await load();
  const briefing = buildBrewBriefing(brew(), await preferences(), "Priya Shah");
  assert.deepEqual(briefing.coverage.unsupported, [
    { metric: "Yield forecasts", reason: "No validated model exists." },
  ]);
  assert.equal(briefing.engagementScanAvailable, false);
});

test("priorities carry the board query and an absent activity signal is surfaced", async () => {
  const { buildBrewBriefing } = await load();
  const source = brew();
  source.priorities[0].boardQuery = { status: "open", priority: "urgent" };
  source.engagementScan = { available: true, snapshots: 12, lastProjectedAt: "2026-08-16T09:00:00.000Z", activityEvents30d: 0, activitySignal: false };
  const briefing = buildBrewBriefing(source, await preferences(), "Priya Shah");
  assert.deepEqual(briefing.priorities[0].boardQuery, { status: "open", priority: "urgent" });
  assert.equal(briefing.engagementActivitySignal, false);
  // Absent on the wire means "not asserted false", so the note stays quiet.
  const legacy = buildBrewBriefing(brew(), await preferences(), "Priya Shah");
  assert.equal(legacy.engagementActivitySignal, true);
  assert.equal(legacy.priorities[0].boardQuery, null);
});

test("Edward is handed a cohort question, never a pre-written answer", async () => {
  const { buildBrewBriefing, edwardOpeningQuestion } = await load();
  const briefing = buildBrewBriefing(brew(), await preferences(), "Priya Shah");

  assert.equal(
    edwardOpeningQuestion("cohort", "Which deposited students are overdue?", briefing),
    "Which deposited students are overdue?",
  );
  assert.match(edwardOpeningQuestion("insights", "today", briefing), /Which students/);
  assert.equal(
    edwardOpeningQuestion("ask", "this briefing", briefing, "  what changed?  "),
    "what changed?",
  );
});

test("legacy preferences carry topics forward and re-run setup", async () => {
  const { browserBrewPreferenceStore } = await loadPreferences();
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    },
  };
  try {
    store.set(
      "audentra:morning-brew:v4:aster:staff-1",
      JSON.stringify({
        version: 4,
        topics: ["financial_aid", "admissions"],
        include: { inbox: false, calendar: true, numbers: true, signals: true, movements: true },
      }),
    );
    const loaded = browserBrewPreferenceStore.load("aster:staff-1");
    assert.deepEqual(loaded.topics, ["financial_aid", "admissions"]);
    // The old inbox and calendar switches map onto the sources that replaced
    // them, and the reader's "off" is carried forward as an "off".
    assert.equal(loaded.sources.email.enabled, false);
    assert.equal(loaded.sources.calendar.enabled, true);
    // Higher-ed news has no predecessor, so it starts on and is met in setup.
    assert.equal(loaded.sources.news.enabled, true);
    // Every source arrives with a detail level, which is the question v6 adds.
    for (const source of Object.values(loaded.sources)) {
      assert.ok(["glance", "context", "deep"].includes(source.detail));
    }
    // A changed vocabulary means the reader answers the new questions again.
    assert.equal(loaded.onboardingComplete, false);
    assert.equal(loaded.version, 6);
  } finally {
    delete globalThis.window;
  }
});
