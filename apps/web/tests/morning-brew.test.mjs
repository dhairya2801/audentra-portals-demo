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
 * subtract, and no value ever appears on screen that the corpus did not hold.
 *
 * The corpus is a demo fixture rather than a live read, which makes one more
 * thing worth testing: that its numbers agree with each other. A demo whose
 * funnel widens as it narrows teaches the audience to stop reading it.
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
const loadPreferences = () => importMorningBrewModule("preferences");

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

async function brew(overrides = {}) {
  const { demoBrewSource } = await loadCorpus();
  return { ...demoBrewSource(), ...overrides };
}

const kpiById = (source, id) => source.kpis.find((kpi) => kpi.id === id);

test("the demo funnel is internally consistent", async () => {
  const source = await brew();
  const at = (id) => kpiById(source, id).value;

  // Each stage is a subset of the one before it. A demo that breaks this is
  // worse than no demo: it invites the audience to audit the numbers instead
  // of watching the product.
  assert.ok(at("applications") > at("admitted"), "more applications than admits");
  assert.ok(at("admitted") > at("accepted"), "more admits than acceptances");
  assert.ok(at("accepted") > at("deposits"), "more acceptances than deposits");
  assert.ok(at("housing_assigned") < at("deposits"), "no more beds assigned than deposits");

  // Yield is deposits over admits, to one decimal place.
  const yieldPct = Number(((at("deposits") / at("admitted")) * 100).toFixed(1));
  assert.equal(at("yield"), yieldPct);

  // Every stated share matches the two figures it sits between.
  for (const [id, numerator, denominator] of [
    ["admitted", "admitted", "applications"],
    ["accepted", "accepted", "admitted"],
    ["deposits", "deposits", "accepted"],
    ["housing_assigned", "housing_assigned", "deposits"],
  ]) {
    const kpi = kpiById(source, id);
    const share = Number(((at(numerator) / at(denominator)) * 100).toFixed(1));
    assert.equal(kpi.basisPercent, share, `${id} share`);
  }
});

test("every KPI carries comparisons the card can cycle", async () => {
  const source = await brew();
  for (const kpi of source.kpis) {
    assert.ok(kpi.comparisons.length >= 3, `${kpi.id} needs three or more comparisons`);
    const labels = kpi.comparisons.map((comparison) => comparison.label);
    assert.equal(new Set(labels).size, labels.length, `${kpi.id} repeats a window`);
    for (const comparison of kpi.comparisons) {
      assert.ok(comparison.delta, `${kpi.id} comparison needs a delta`);
      assert.ok(["up", "down", "flat"].includes(comparison.direction));
      assert.equal(typeof comparison.favorable, "boolean");
    }
  }

  // Falling is good for a queue and bad for enrolment, and the corpus has to
  // say which is which — the card colours from `favorable`, not `direction`.
  const queue = kpiById(source, "verification");
  assert.ok(queue.comparisons.every((c) => c.direction !== "down" || c.favorable));
  const deposits = kpiById(source, "deposits");
  assert.ok(deposits.comparisons.every((c) => c.direction !== "up" || c.favorable));
});

test("topics only ever subtract from the briefing", async () => {
  const { buildBrewBriefing } = await load();
  const source = await brew();
  const all = buildBrewBriefing(source, await preferences({ sources: await sources({ pulse: { detail: "deep" } }) }), "Priya Shah");
  const narrow = buildBrewBriefing(
    source,
    await preferences({ topics: ["financial_aid"], sources: await sources({ pulse: { detail: "deep" } }) }),
    "Priya Shah",
  );

  assert.ok(narrow.kpis.length < all.kpis.length);
  assert.ok(narrow.kpis.every((kpi) => kpi.topic === "financial_aid"));
  assert.ok(narrow.insights.every((item) => item.topic === "financial_aid"));

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
    "Priya Shah",
  );

  assert.deepEqual(briefing.kpis, []);
  assert.deepEqual(briefing.insights, []);
  assert.deepEqual(briefing.news, []);
  assert.deepEqual(briefing.deadlines, []);
  assert.deepEqual(briefing.requests, []);
  assert.deepEqual(briefing.priorities, []);
  assert.deepEqual(briefing.bullets, []);
  assert.deepEqual(briefing.glance, {
    requests: 0,
    requestsAwaitingReply: 0,
    deadlinesOverdue: 0,
    deadlinesThisWeek: 0,
  });
});

test("an empty corpus produces an empty briefing, not a placeholder one", async () => {
  const { buildBrewBriefing } = await load();
  const briefing = buildBrewBriefing(
    await brew({ kpis: [], insights: [], deadlines: [], requests: [], priorities: [] }),
    await preferences(),
    "Priya Shah",
  );

  assert.deepEqual(briefing.kpis, []);
  assert.deepEqual(briefing.insights, []);
  assert.deepEqual(briefing.deadlines, []);
  assert.deepEqual(briefing.priorities, []);
  // The curated feed is not the corpus, so it survives an empty one.
  assert.ok(briefing.news.length);
});

test("each source's own detail level bounds only its own section", async () => {
  const { buildBrewBriefing } = await load();
  const source = await brew();
  const glance = buildBrewBriefing(
    source,
    await preferences({ sources: await sources({ calendar: { detail: "glance" } }) }),
    "P S",
  );
  const deep = buildBrewBriefing(
    source,
    await preferences({ sources: await sources({ calendar: { detail: "deep" } }) }),
    "P S",
  );

  assert.ok(deep.deadlines.length > glance.deadlines.length);
  assert.equal(glance.requests.length, deep.requests.length);
  assert.equal(glance.kpis.length, deep.kpis.length);

  const deepIds = new Set(deep.deadlines.map((item) => item.id));
  for (const item of glance.deadlines) assert.ok(deepIds.has(item.id));

  assert.ok(deep.readTimeMinutes >= glance.readTimeMinutes);
});

test("higher-ed news is a curated feed, credited, filtered by topic and never counted", async () => {
  const { buildBrewBriefing } = await load();
  const source = await brew();
  const briefing = buildBrewBriefing(source, await preferences(), "Priya Shah");

  assert.ok(briefing.news.length);
  for (const item of briefing.news) {
    assert.ok(item.publisher, "every story is credited");
    assert.match(item.url, /^https:\/\//, "every story links out");
    assert.ok(item.publishedLabel, "every story is dated");
    assert.match(item.image, /^\/media\/news\//, "cover art is served from our own assets");
    assert.ok(item.imageAlt, "cover art is described");
  }

  const narrow = buildBrewBriefing(source, await preferences({ topics: ["student_success"] }), "P S");
  assert.ok(narrow.news.every((item) => item.topic === "student_success"));
  assert.ok(narrow.news.length < briefing.news.length);

  const off = buildBrewBriefing(
    source,
    await preferences({ sources: await sources({ news: { enabled: false } }) }),
    "P S",
  );
  assert.deepEqual(off.news, []);
});

test("an urgent request survives a topic filter that would otherwise drop it", async () => {
  const { buildBrewBriefing } = await load();
  const briefing = buildBrewBriefing(await brew(), await preferences({ topics: ["registrar"] }), "P S");

  const urgent = briefing.requests.find((request) => request.priority === "urgent");
  assert.ok(urgent, "an urgent request reaches the reader from an unfollowed topic");
  assert.equal(urgent.topic, "financial_aid");
});

test("coverage travels with the briefing and names the demo corpus", async () => {
  const { buildBrewBriefing } = await load();
  const briefing = buildBrewBriefing(await brew(), await preferences(), "P S");
  assert.ok(briefing.coverage.notes.length);
  assert.ok(briefing.coverage.unsupported.length);
  // The page must not imply a canonical read while it is running on the corpus.
  assert.match(briefing.coverage.notes.join(" "), /demo data/i);
});

test("Edward is handed a cohort question, never a pre-written answer", async () => {
  const { buildBrewBriefing, edwardOpeningQuestion } = await load();
  const briefing = buildBrewBriefing(await brew(), await preferences(), "P S");

  const insights = edwardOpeningQuestion("insights", "today's attention list", briefing);
  assert.match(insights, /\?$/);
  assert.ok(insights.includes(briefing.insights[0].cohort.question));

  assert.equal(edwardOpeningQuestion("ask", "x", briefing, "  Who is stuck?  "), "Who is stuck?");
  assert.equal(edwardOpeningQuestion("cohort", "Which students?", briefing), "Which students?");
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
