import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

/**
 * Tests for the Morning Brew builder and the corpus it reads.
 *
 * The builder is the one place where the corpus becomes what a leader reads, so
 * the invariants asserted here are the product promises: preferences may only
 * subtract (with one stated exception), and no value ever appears on screen
 * that the corpus did not hold.
 *
 * The corpus is a demo fixture rather than a live read, which makes one more
 * thing worth testing: that its numbers agree with each other. A demo whose
 * funnel widens as it narrows, or whose progress bar disagrees with its own
 * target, teaches the audience to stop reading it.
 */

/**
 * The builder imports its sibling catalogue, so the whole flat module group is
 * transpiled into one temporary directory rather than a single data: URL —
 * a data: URL cannot resolve a relative specifier.
 */
const SOURCE_DIR = new URL("../app/staff/morning-brew/", import.meta.url);
const MODULES = ["data", "catalog", "demo-brew", "news", "preferences", "types"];

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
const loadCorpus = () => importMorningBrewModule("demo-brew");
const loadCatalog = () => importMorningBrewModule("catalog");
const loadPreferences = () => importMorningBrewModule("preferences");

async function preferences(overrides = {}) {
  const { DEFAULT_BREW_PREFERENCES } = await loadPreferences();
  return {
    ...DEFAULT_BREW_PREFERENCES,
    version: 7,
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

async function brew(overrides = {}) {
  const { demoBrewSource } = await loadCorpus();
  return { ...demoBrewSource(), ...overrides };
}

const kpiById = (source, id) => source.kpis.find((kpi) => kpi.id === id);
const ALL_TOPICS = ["financial_aid", "admissions", "enrollment", "housing", "campus_life"];

test("the demo funnel is internally consistent", async () => {
  const source = await brew();
  const at = (id) => kpiById(source, id).value;

  // Each stage is a subset of the one before it. A demo that breaks this is
  // worse than no demo: it invites the audience to audit the numbers instead
  // of watching the product.
  assert.ok(at("applications") > at("admits"), "more applications than admits");
  assert.ok(at("admits") > at("deposits"), "more admits than deposits");
  assert.ok(at("transfer-applications") < at("applications"), "transfers are part of the file");

  // Every rate is its own two figures, computed rather than typed in.
  const rate = (numerator, denominator) =>
    Number(((at(numerator) / at(denominator)) * 100).toFixed(1));
  assert.equal(kpiById(source, "deposit-rate").value, rate("deposits", "admits"));
  assert.equal(
    kpiById(source, "yield").value,
    Number(((1452 / at("admits")) * 100).toFixed(1)),
    "yield is projected enrolled over admits",
  );
  assert.ok(
    kpiById(source, "yield").value < kpiById(source, "deposit-rate").value,
    "projected enrolled cannot exceed deposits held",
  );

  // Every progress bar is its figure divided by its target, rounded once. Two
  // roundings is how a bar and the number beside it start disagreeing.
  for (const kpi of source.kpis) {
    if (kpi.target === null) {
      assert.equal(kpi.progressPercent, null, `${kpi.id} states progress without a target`);
      assert.equal(kpi.targetDisplay, null, `${kpi.id} names a target it does not hold`);
      continue;
    }
    assert.equal(
      kpi.progressPercent,
      Math.round((kpi.value / kpi.target) * 100),
      `${kpi.id} progress`,
    );
    assert.ok(kpi.dueLabel, `${kpi.id} has a target and so needs a date for it`);
  }

  // A queue is not a goal, and the corpus says so by holding no target for one.
  assert.equal(kpiById(source, "verification-queue").target, null);
});

test("every KPI carries comparisons the card can cycle", async () => {
  const source = await brew();
  for (const kpi of source.kpis) {
    assert.equal(kpi.comparisons.length, 4, `${kpi.id} needs four comparison windows`);
    const labels = kpi.comparisons.map((comparison) => comparison.label);
    assert.equal(new Set(labels).size, labels.length, `${kpi.id} repeats a window`);
    for (const comparison of kpi.comparisons) {
      assert.ok(comparison.delta, `${kpi.id} comparison needs a delta`);
      assert.ok(["up", "down", "flat"].includes(comparison.direction));
      assert.equal(typeof comparison.favorable, "boolean");
    }

    // Rates move in points and counts move in students. A rate's comparison is
    // never a percentage of a percentage, which is a number nobody can hold in
    // their head.
    const isRate = kpi.display.endsWith("%");
    for (const comparison of kpi.comparisons) {
      if (!isRate) continue;
      assert.match(comparison.delta, /pp$/, `${kpi.id} ${comparison.label} is not in points`);
      assert.equal(comparison.percent, null, `${kpi.id} ${comparison.label} doubles its reading`);
    }
  }

  // Falling is good for a queue and bad for enrolment, and the corpus has to
  // say which is which — the card colours from `favorable`, not `direction`.
  const queue = kpiById(source, "verification-queue");
  assert.ok(queue.comparisons.every((c) => c.direction !== "up" || !c.favorable));
  const deposits = kpiById(source, "deposits");
  assert.ok(deposits.comparisons.every((c) => c.direction !== "up" || c.favorable));
});

test("the three lines of a KPI meet where they are supposed to", async () => {
  const source = await brew();
  for (const kpi of source.kpis) {
    // The line and the number above it are the same measurement, so they cannot
    // be allowed to disagree.
    assert.ok(kpi.series.length >= 2, `${kpi.id} needs a series to draw`);
    assert.equal(kpi.series.at(-1), kpi.value, `${kpi.id} series ends on today`);

    // The dotted run-out leaves the solid line rather than floating beside it.
    assert.ok(kpi.forecast.length >= 2, `${kpi.id} needs a forecast to continue`);
    assert.equal(kpi.forecast[0], kpi.value, `${kpi.id} forecast starts on today`);

    // Last year is history and is known all the way across the axis.
    assert.equal(
      kpi.previousYear.length,
      kpi.series.length + kpi.forecast.length,
      `${kpi.id} previous year does not span the axis`,
    );

    // A line that is drawn has to be read, so every KPI carries the sentence
    // that reads it.
    assert.ok(kpi.trendNote, `${kpi.id} draws a trend it never explains`);
  }
});

test("a demo line wobbles and still lands on its own headline", async () => {
  const source = await brew();
  const deposits = kpiById(source, "deposits");
  // A perfectly smooth ramp reads as synthetic, so the generator wobbles. What
  // it may not do is drift off the figure printed above it.
  const steps = deposits.series.slice(1).map((value, index) => value - deposits.series[index]);
  assert.ok(new Set(steps).size > 3, "a daily count that moves by the same amount every day is a ramp");
  assert.ok(steps.some((step) => step <= 0), "a level net of withdrawals has flat or falling days");
  assert.equal(deposits.series.at(-1), deposits.value);
});

test("the brief always prints three findings, chosen by what the reader follows", async () => {
  const { buildBrewBriefing, BREW_INSIGHT_COUNT } = await load();
  const source = await brew();
  assert.ok(source.insights.length > BREW_INSIGHT_COUNT, "the pool is larger than the band");

  const wide = buildBrewBriefing(source, await preferences({ topics: ALL_TOPICS }));
  assert.equal(wide.insights.length, 3);

  const housing = buildBrewBriefing(source, await preferences({ topics: ["housing"] }));
  // Three, always. A two-card row would read as "there are only two things
  // wrong today", which is a claim about the institution rather than about the
  // reader's settings.
  assert.equal(housing.insights.length, 3);
  assert.equal(housing.insights[0].topic, "housing", "a followed topic leads the band");

  for (const insight of source.insights) {
    for (const level of ["glance", "context", "deep"]) {
      assert.ok(insight.stats[level], `${insight.id} needs figures at ${level}`);
      assert.ok(insight.recommendations[level], `${insight.id} needs a recommendation at ${level}`);
    }
    // The headline is deliberately the same sentence at every depth: a reader
    // who asked for the short brief and one who asked for the long one should
    // walk away having read the same claim.
    assert.ok(insight.summary, `${insight.id} needs a headline`);
    assert.ok(insight.projection, `${insight.id} needs the consequence under it`);
    assert.ok(insight.context && insight.deepDive, `${insight.id} needs both readings`);
    assert.notEqual(insight.context, insight.deepDive);
    assert.ok(insight.owner, `${insight.id} names the office the ask is addressed to`);
    assert.ok(
      insight.confidence > 0 && insight.confidence <= 100,
      `${insight.id} confidence is a whole percent`,
    );
    assert.ok(insight.impact.length, `${insight.id} states what it would cost`);
  }
});

test("a finding's impact figures are the arithmetic of the sentence above them", async () => {
  const source = await brew();
  const finding = source.insights.find((insight) => insight.id === "commuter-deposit-pace");
  // "82 fewer deposits ... (~$1.6M in tuition)" and the chips under it have to
  // be the same claim. $19,500 of net tuition per enrolled student is the one
  // conversion the whole brief uses.
  assert.match(finding.projection, /82 fewer deposits/);
  assert.match(finding.projection, /\$1\.6M/);
  const labels = finding.impact.map((chip) => chip.label);
  assert.ok(labels.includes("−$1.6M"), `impact chips were ${labels.join(", ")}`);
  assert.ok(labels.includes("−82 Enrolled Students"));
  assert.equal(Math.round((82 * 19500) / 100000) / 10, 1.6, "82 students is $1.6M at $19.5K each");
});

test("topics only ever subtract from the countable bands", async () => {
  const { buildBrewBriefing } = await load();
  const source = await brew();
  const all = buildBrewBriefing(source, await preferences({ topics: ALL_TOPICS }));
  const narrow = buildBrewBriefing(source, await preferences({ topics: ["financial_aid"] }));

  assert.ok(narrow.kpis.length < all.kpis.length);
  assert.ok(narrow.kpis.every((kpi) => kpi.topic === "financial_aid"));
  assert.ok(narrow.meetings.every((meeting) => meeting.topic === "financial_aid"));
  assert.ok(narrow.priorities.every((priority) => priority.topic === "financial_aid"));

  // Nothing appears in the narrowed briefing that was absent from the wide one.
  const wideIds = new Set(all.kpis.map((kpi) => kpi.id));
  for (const kpi of narrow.kpis) assert.ok(wideIds.has(kpi.id));
});

test("switched-off sections render empty rather than filled with something else", async () => {
  const { buildBrewBriefing } = await load();
  const briefing = buildBrewBriefing(
    await brew(),
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
  );

  assert.deepEqual(briefing.kpis, []);
  assert.deepEqual(briefing.insights, []);
  assert.deepEqual(briefing.news, []);
  assert.deepEqual(briefing.meetings, []);
  assert.deepEqual(briefing.requests, []);
  assert.deepEqual(briefing.priorities, []);
  assert.deepEqual(briefing.glance, {
    requests: 0,
    requestsAwaitingReply: 0,
    meetings: 0,
    meetingsHighPriority: 0,
    priorities: 0,
    prioritiesHighPriority: 0,
  });
});

test("the calendar card counts the same meetings the calendar panel prints", async () => {
  const { buildBrewBriefing } = await load();
  const source = await brew();
  for (const topics of [ALL_TOPICS, ["financial_aid"], ["housing", "campus_life"]]) {
    const briefing = buildBrewBriefing(source, await preferences({ topics }));
    assert.equal(briefing.glance.meetings, briefing.meetings.length, topics.join("+"));
    assert.equal(
      briefing.glance.meetingsHighPriority,
      briefing.meetings.filter((meeting) => meeting.priority === "high").length,
    );
  }
});

test("an empty corpus produces an empty briefing, not a placeholder one", async () => {
  const { buildBrewBriefing } = await load();
  const briefing = buildBrewBriefing(
    await brew({ kpis: [], insights: [], meetings: [], requests: [], priorities: [] }),
    await preferences(),
  );

  assert.deepEqual(briefing.kpis, []);
  assert.deepEqual(briefing.insights, []);
  assert.deepEqual(briefing.meetings, []);
  assert.deepEqual(briefing.priorities, []);
  // The curated feed is not the corpus, so it survives an empty one.
  assert.ok(briefing.news.length);
});

test("each source's own detail level bounds only its own section", async () => {
  const { buildBrewBriefing } = await load();
  const source = await brew();
  const at = async (level) =>
    buildBrewBriefing(
      source,
      await preferences({
        topics: ALL_TOPICS,
        sources: await sources({ pulse: { detail: level } }),
      }),
    );
  const glance = await at("glance");
  const deep = await at("deep");

  assert.ok(deep.kpis.length > glance.kpis.length);
  assert.equal(glance.requests.length, deep.requests.length);
  assert.equal(glance.news.length, deep.news.length);
  assert.equal(glance.meetings.length, deep.meetings.length);

  const deepIds = new Set(deep.kpis.map((kpi) => kpi.id));
  for (const kpi of glance.kpis) assert.ok(deepIds.has(kpi.id));

  assert.ok(deep.readTimeMinutes >= glance.readTimeMinutes);
});

test("the three day panels are bounded by the panel, not by the reader's level", async () => {
  const { buildBrewBriefing } = await load();
  const source = await brew();
  // Calendar, Email and Action Center sit side by side and open on four rows
  // each, holding the next five behind "View more". The level cannot shorten
  // one column without making the row of three ragged, so it no longer tries:
  // the builder hands over the whole queue and the panel decides what is shown.
  for (const level of ["glance", "context", "deep"]) {
    const briefing = buildBrewBriefing(
      source,
      await preferences({
        topics: ALL_TOPICS,
        sources: await sources({
          calendar: { detail: level },
          email: { detail: level },
          actions: { detail: level },
        }),
      }),
    );
    assert.equal(briefing.meetings.length, source.meetings.length, `meetings at ${level}`);
    assert.equal(briefing.priorities.length, source.priorities.length, `priorities at ${level}`);
    // Four rows open and five behind "View more" needs nine to hand over.
    assert.ok(briefing.meetings.length >= 9, "the calendar can fill a View more");
    assert.ok(briefing.requests.length >= 9, "the inbox can fill a View more");
    assert.ok(briefing.priorities.length >= 9, "the action center can fill a View more");
  }
});

test("higher-ed news is a curated feed, credited, and lands on a named figure", async () => {
  const { buildBrewBriefing } = await load();
  const source = await brew();
  const briefing = buildBrewBriefing(source, await preferences({ topics: ALL_TOPICS }));

  assert.equal(briefing.news.length, 4, "the rail is four across at every depth");
  for (const item of briefing.news) {
    assert.ok(item.publisher, "every story is credited");
    assert.match(item.url, /^https:\/\//, "every story links out");
    assert.ok(item.publishedLabel, "every story is dated");
    assert.match(item.image, /^\/media\/news\//, "cover art is served from our own assets");
    assert.ok(item.imageAlt, "cover art is described");
    // The one line we add says why the story is in *this* reader's brief. A
    // line that could be pasted under any story at any institution is filler.
    assert.match(item.bearing, /\d/, `"${item.bearing}" names no figure`);
    assert.ok(item.bearing.length > 60, `"${item.bearing}" is too vague to be context`);
  }

  // A reader's topics order the feed; they do not empty the rail, because four
  // slots with one card in them looks broken rather than filtered.
  const narrow = buildBrewBriefing(source, await preferences({ topics: ["housing"] }));
  assert.equal(narrow.news.length, 4);
  assert.equal(narrow.news[0].topic, "housing", "a followed topic leads the rail");

  const off = buildBrewBriefing(
    source,
    await preferences({ sources: await sources({ news: { enabled: false } }) }),
  );
  assert.deepEqual(off.news, []);
});

test("a source only ever reads at a depth it actually offers", async () => {
  const { supportedLevel, sourceById } = await loadCatalog();
  const { buildBrewBriefing, levelOf } = await load();

  // Higher Ed News answers for two depths. A third, longer reading of somebody
  // else's article would be us writing an analysis and attributing it to a
  // headline, so the source does not offer one — and a stored preference for
  // one reads at the deepest level it does offer rather than rendering blank.
  assert.deepEqual(sourceById("news").levels, ["glance", "context"]);
  assert.equal(supportedLevel("news", "deep"), "context");
  assert.equal(supportedLevel("news", "glance"), "glance");
  assert.equal(supportedLevel("pulse", "deep"), "deep");

  const stored = await preferences({ sources: await sources({ news: { detail: "deep" } }) });
  assert.equal(levelOf(stored, "news"), "context");
  // And the band still builds rather than falling over on the missing level.
  assert.equal(buildBrewBriefing(await brew(), stored).news.length, 4);
});

test("an urgent request survives a topic filter that would otherwise drop it", async () => {
  const { buildBrewBriefing } = await load();
  const briefing = buildBrewBriefing(await brew(), await preferences({ topics: ["housing"] }));

  const urgent = briefing.requests.find((request) => request.priority === "urgent");
  assert.ok(urgent, "an urgent request reaches the reader from an unfollowed topic");
  assert.notEqual(urgent.topic, "housing");
  // Everything else in the panel is either followed or urgent, and nothing else.
  assert.ok(
    briefing.requests.every(
      (request) => request.topic === "housing" || request.priority === "urgent",
    ),
  );
});

test("coverage travels with the briefing and names the demo corpus", async () => {
  const { buildBrewBriefing } = await load();
  const briefing = buildBrewBriefing(await brew(), await preferences());
  assert.ok(briefing.coverage.notes.length);
  assert.ok(briefing.coverage.unsupported.length);
  // The page must not imply a canonical read while it is running on the corpus.
  assert.match(briefing.coverage.notes.join(" "), /demo data/i);
});

test("Edward is handed a cohort question, never a pre-written answer", async () => {
  const { buildBrewBriefing, edwardOpeningQuestion, edwardKpiGreeting } = await load();
  const briefing = buildBrewBriefing(await brew(), await preferences());

  const insights = edwardOpeningQuestion("insights", "today's attention list", briefing);
  assert.match(insights, /\?$/);
  assert.ok(insights.includes(briefing.insights[0].cohort.question));

  assert.equal(edwardOpeningQuestion("ask", "x", briefing, "  Who is stuck?  "), "Who is stuck?");
  assert.equal(edwardOpeningQuestion("cohort", "Which students?", briefing), "Which students?");

  // A card that already names its subject opens with Edward asking rather than
  // answering, so the greeting is addressed to the reader and to the figure.
  assert.equal(
    edwardKpiGreeting("Vivian", "Deposit Paid"),
    "Hello Vivian, what would you like to know more about Deposit Paid?",
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
    // v6's "admissions" covered offers and deposits both, and Enrollment is
    // where the deposit half of it went.
    assert.deepEqual(loaded.topics, ["financial_aid", "admissions", "enrollment"]);
    // The old inbox and calendar switches map onto the sources that replaced
    // them, and the reader's "off" is carried forward as an "off".
    assert.equal(loaded.sources.email.enabled, false);
    assert.equal(loaded.sources.calendar.enabled, true);
    // Higher Ed News has no predecessor, so it starts on and is met in setup.
    assert.equal(loaded.sources.news.enabled, true);
    // Every source arrives with a detail level, which is the question v6 added.
    for (const source of Object.values(loaded.sources)) {
      assert.ok(["glance", "context", "deep"].includes(source.detail));
    }
    // A changed vocabulary means the reader answers the new questions again.
    assert.equal(loaded.onboardingComplete, false);
    assert.equal(loaded.version, 7);
  } finally {
    delete globalThis.window;
  }
});

test("a v6 reader keeps their sources and re-picks their topics", async () => {
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
      "audentra:morning-brew:v6:aster:staff-2",
      JSON.stringify({
        version: 6,
        topics: ["student_success", "registrar", "housing"],
        sections: { calendar: false },
        onboardingComplete: true,
      }),
    );
    const loaded = browserBrewPreferenceStore.load("aster:staff-2");
    // "student_success" became Enrollment; "registrar" has no successor, and
    // the reader is offered Campus Life as the nearest student-facing half of
    // what they were watching rather than being left with nothing.
    assert.deepEqual(loaded.topics, ["enrollment", "housing", "campus_life"]);
    assert.equal(loaded.sources.calendar.enabled, false);
    assert.equal(loaded.version, 7);
    assert.equal(loaded.onboardingComplete, false, "the topic vocabulary changed under them");
  } finally {
    delete globalThis.window;
  }
});
