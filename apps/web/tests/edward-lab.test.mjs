/**
 * Edward Lab — developer trace dashboard.
 *
 * Covers the gating rules, requestId → trace association (bounded retry),
 * trace summarization (grounded / rejection / dependency rounds / failures),
 * the server-side proxy's credential boundary, and — against the production
 * build — that the Lab page and its proxy routes are dead without the
 * explicit flag and that no worker credential reaches client assets.
 */

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

function importTypeScriptModule(source) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  return import(moduleUrl);
}

async function labModule() {
  const source = await readFile(
    new URL("../app/lib/edward-lab.ts", import.meta.url),
    "utf8",
  );
  return importTypeScriptModule(source);
}

async function renderBuiltWorker(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-lab`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

/* --- gating --------------------------------------------------------------- */

test("edward lab is enabled in development and gated everywhere else", async () => {
  const { edwardLabEnabled } = await labModule();
  assert.equal(edwardLabEnabled({ NODE_ENV: "development" }), true);
  assert.equal(edwardLabEnabled({ NODE_ENV: "production" }), false);
  assert.equal(edwardLabEnabled({ NODE_ENV: "test" }), false);
  assert.equal(
    edwardLabEnabled({ NODE_ENV: "production", NEXT_PUBLIC_EDWARD_DEBUG_ENABLED: "true" }),
    true,
  );
  assert.equal(
    edwardLabEnabled({ NODE_ENV: "development", NEXT_PUBLIC_EDWARD_DEBUG_ENABLED: "false" }),
    false,
  );
});

test("production build serves neither the lab page nor its proxy routes", async () => {
  // The production build ran without NEXT_PUBLIC_EDWARD_DEBUG_ENABLED, so the
  // page must be a 404 and the proxy handlers must refuse before contacting
  // any upstream.
  const page = await renderBuiltWorker("/dev/edward");
  assert.equal(page.status, 404);

  const proxyList = await renderBuiltWorker("/api/edward-lab/traces");
  assert.equal(proxyList.status, 404);
  const proxyDetail = await renderBuiltWorker("/api/edward-lab/traces/some-trace-id");
  assert.equal(proxyDetail.status, 404);
  const personas = await renderBuiltWorker("/api/edward-lab/personas");
  assert.equal(personas.status, 404);
});

/* --- credential boundary --------------------------------------------------- */

test("no worker credential or internal trace path leaks into client assets", async () => {
  const assetsDir = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDir);
  for (const file of files) {
    if (!/\.(js|css)$/.test(file)) continue;
    const content = await readFile(new URL(file, assetsDir), "utf8");
    assert.doesNotMatch(
      content,
      /local-development-document-worker-token/,
      `${file} must not embed the local worker token`,
    );
    assert.doesNotMatch(
      content,
      /x-vv-worker-token/i,
      `${file} must not carry the internal auth header`,
    );
    assert.doesNotMatch(
      content,
      /\/internal\/assistant\/traces/,
      `${file} must reach traces only via the same-origin lab proxy`,
    );
  }
});

test("the proxy holds the credential server-side and never via NEXT_PUBLIC vars", async () => {
  const source = await readFile(
    new URL("../app/api/edward-lab/upstream.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /x-vv-worker-token/);
  assert.match(source, /EDWARD_LAB_WORKER_TOKEN/);
  assert.doesNotMatch(source, /NEXT_PUBLIC[A-Z_]*TOKEN/);
  // The client component talks only to the same-origin proxy.
  const client = await readFile(
    new URL("../app/components/edward-lab.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(client, /internal\/assistant/);
  assert.doesNotMatch(client, /x-vv-worker-token/i);
  assert.doesNotMatch(client, /EDWARD_LAB_WORKER_TOKEN/);
  assert.match(client, /\/api\/edward-lab\//);
});

/* --- requestId → trace association ---------------------------------------- */

test("fetchTraceWithRetry retries a race-y 404 within its bound and then succeeds", async () => {
  const { fetchTraceWithRetry } = await labModule();
  const calls = [];
  const trace = { traceId: "abc", toolCalls: [] };
  const fetchImpl = async (url) => {
    calls.push(url);
    if (calls.length < 3) return { status: 404, json: async () => ({}) };
    return { status: 200, json: async () => trace };
  };
  const result = await fetchTraceWithRetry("abc", fetchImpl, {
    attempts: 4,
    sleep: async () => {},
  });
  assert.deepEqual(result, trace);
  assert.equal(calls.length, 3);
  assert.match(calls[0], /\/api\/edward-lab\/traces\/abc$/);
});

test("fetchTraceWithRetry gives up after the bounded attempts (missing trace)", async () => {
  const { fetchTraceWithRetry } = await labModule();
  let calls = 0;
  const result = await fetchTraceWithRetry(
    "missing",
    async () => {
      calls += 1;
      return { status: 404, json: async () => ({}) };
    },
    { attempts: 3, sleep: async () => {} },
  );
  assert.equal(result, null);
  assert.equal(calls, 3);
});

test("fetchTraceWithRetry does not retry non-404 backend errors", async () => {
  const { fetchTraceWithRetry } = await labModule();
  let calls = 0;
  const result = await fetchTraceWithRetry(
    "boom",
    async () => {
      calls += 1;
      return { status: 502, json: async () => ({}) };
    },
    { attempts: 4, sleep: async () => {} },
  );
  assert.equal(result, null);
  assert.equal(calls, 1);
});

/* --- summarization --------------------------------------------------------- */

const groundedTrace = {
  traceId: "t1",
  path: "pipeline",
  responseSource: "model_prose",
  durationMs: 1420,
  classification: { requestType: "housing_eligibility", source: "deterministic" },
  toolCalls: [
    { tool: "getStudentHousingEligibility", status: "available", round: "initial", durationMs: 82 },
    { tool: "getEnrollmentHolds", status: "available", round: "initial", durationMs: 63 },
    { tool: "getStudentAccountSummary", status: "available", round: "dependency", durationMs: 91 },
  ],
  secondRead: {
    triggeredBy: [{ gate: "enrollment_deposit_posted", tool: "getStudentAccountSummary" }],
    tools: ["getStudentAccountSummary"],
  },
  modelCalls: [
    {
      operation: "assistant_composer",
      attempt: 1,
      outcome: "accepted",
      durationMs: 744,
      usage: { promptTokens: 1102, completionTokens: 143, totalTokens: 1245 },
    },
  ],
  failureCodes: [],
};

test("summarizeTrace reports a grounded turn with dependency reads and tokens", async () => {
  const { summarizeTrace, dependencyTriggerFor } = await labModule();
  const summary = summarizeTrace(groundedTrace);
  assert.equal(summary.status, "grounded");
  assert.equal(summary.toolCount, 3);
  assert.equal(summary.dependencyToolCount, 1);
  assert.equal(summary.modelCallCount, 1);
  assert.equal(summary.totalTokens, 1245);
  assert.equal(summary.requestType, "housing_eligibility");
  assert.equal(
    dependencyTriggerFor(groundedTrace, "getStudentAccountSummary"),
    "enrollment_deposit_posted",
  );
  assert.equal(dependencyTriggerFor(groundedTrace, "getEnrollmentHolds"), null);
});

test("summarizeTrace surfaces grounding rejection and deterministic fallback", async () => {
  const { summarizeTrace } = await labModule();
  const summary = summarizeTrace({
    traceId: "t2",
    path: "pipeline",
    responseSource: "deterministic",
    modelCalls: [
      {
        operation: "assistant_composer",
        attempt: 1,
        outcome: "guard_rejected",
        detail: "invented_causation",
        durationMs: 700,
      },
      {
        operation: "assistant_composer",
        attempt: 2,
        outcome: "guard_rejected",
        detail: "invented_causation",
        durationMs: 650,
      },
    ],
    failureCodes: ["written_answer_rejected:invented_causation"],
  });
  assert.equal(summary.status, "fallback");
  assert.equal(summary.guardRejections.length, 2);
  assert.deepEqual(summary.failureCodes, ["written_answer_rejected:invented_causation"]);
});

test("summarizeTrace distinguishes safety gates, replays, and errors", async () => {
  const { summarizeTrace } = await labModule();
  assert.equal(summarizeTrace({ traceId: "a", path: "pre_pipeline_safety_gate" }).status, "safety_gate");
  assert.equal(summarizeTrace({ traceId: "b", path: "idempotent_replay" }).status, "replay");
  assert.equal(summarizeTrace({ traceId: "c", error: "boom" }).status, "error");
  assert.equal(summarizeTrace({ traceId: "d", path: "pipeline" }).status, "deterministic");
});

test("evidence tone highlights blockers without inventing semantics", async () => {
  const { evidenceTone } = await labModule();
  assert.equal(evidenceTone("Blocker: Enrollment deposit not posted — cleared by: pay"), "warn");
  assert.equal(evidenceTone("Housing gate (open): Upload an identity document"), "warn");
  assert.equal(evidenceTone("Completed checklist step: Verify your profile"), "done");
  assert.equal(evidenceTone("Financial aid is incomplete"), "neutral");
});

/* --- component seams -------------------------------------------------------- */

test("the real chat component exposes the dev-only turn observer", async () => {
  const source = await readFile(
    new URL("../app/components/edward-assistant.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /onTurn\?: \(turn: EdwardTurnEvent\) => void/);
  assert.match(source, /onTurn\?\.\(\{\s*question: normalized,\s*response,/);
  // The observer also reports failed turns so the Lab shows them.
  assert.match(source, /onTurn\?\.\(\{\s*question: normalized,\s*response: null,/);
});

test("the lab timeline lets prior turns re-select their trace", async () => {
  const source = await readFile(
    new URL("../app/components/edward-lab.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Conversation timeline/);
  assert.match(source, /selectTrace\(turn.requestId\)/);
  // Switching persona resets the conversation surface entirely.
  assert.match(source, /setTurns\(\[\]\)/);
  assert.match(source, /setChatEpoch/);
});

test("the inspector renders tools, grounding, evidence, and raw JSON sections", async () => {
  const source = await readFile(
    new URL("../app/components/edward-trace-inspector.tsx", import.meta.url),
    "utf8",
  );
  for (const marker of [
    "Tool reads",
    "Model calls",
    "Grounding guard",
    "Evidence Edward reasoned from",
    "Latency",
    "Conversation context",
    "Raw trace",
    "dependency",
    "Triggered by",
  ]) {
    assert.ok(source.includes(marker), `inspector must render "${marker}"`);
  }
});

/* --- normal vs deterministic comparison ------------------------------------ */

function traceFixture(overrides = {}) {
  return {
    traceId: "t",
    executionMode: "default",
    classification: { requestType: "enrollment_checklist" },
    toolSelectionSource: "deterministic",
    selectedTools: ["getEnrollmentChecklist"],
    toolCalls: [
      { tool: "getEnrollmentChecklist", status: "ok", round: "initial" },
      { tool: "getAccountBalance", status: "ok", round: "dependency" },
    ],
    evidence: ["Open checklist step: Final transcript"],
    modelCalls: [
      {
        operation: "assistant_composer",
        attempt: 1,
        durationMs: 900,
        outcome: "accepted",
        model: "gpt-4o-mini",
        usage: { promptTokens: 1000, completionTokens: 100, totalTokens: 1100 },
      },
    ],
    responseSource: "model_prose",
    provider: "openai",
    model: "gpt-4o-mini",
    failureCodes: [],
    durationMs: 1400,
    ...overrides,
  };
}

function sideFixture(mode, overrides = {}) {
  return {
    mode,
    requestId: `req-${mode}`,
    message: "You still owe your final transcript.",
    blocks: [{ type: "text" }, { type: "checklist" }],
    trace: traceFixture({ executionMode: mode }),
    latencyMs: 1500.4,
    error: null,
    ...overrides,
  };
}

test("comparison facts read only what the trace recorded", async () => {
  const { comparisonFacts } = await labModule();
  const facts = comparisonFacts(sideFixture("default"));
  assert.equal(facts.modeConfirmed, true);
  assert.equal(facts.requestType, "enrollment_checklist");
  assert.deepEqual(facts.executedTools, ["getEnrollmentChecklist", "getAccountBalance"]);
  assert.equal(facts.toolCallCount, 2);
  assert.equal(facts.dependencyToolCount, 1);
  assert.equal(facts.evidenceCount, 1);
  assert.deepEqual(facts.blockTypes, ["text", "checklist"]);
  assert.equal(facts.modelCallCount, 1);
  assert.equal(facts.totalTokens, 1100);
  assert.equal(facts.serverDurationMs, 1400);
  assert.equal(facts.clientLatencyMs, 1500);
  assert.equal(facts.unsupported, false);
});

test("a run whose mode the platform did not confirm is never presented as proven", async () => {
  const { comparisonFacts } = await labModule();
  // No trace at all: the Lab cannot claim a zero-LLM turn happened.
  const missing = comparisonFacts(sideFixture("deterministic", { trace: null }));
  assert.equal(missing.modeConfirmed, false);
  assert.equal(missing.modelCallCount, 0);

  // A trace that reports the *other* mode (an ignored header) is also unconfirmed.
  const ignored = comparisonFacts(
    sideFixture("deterministic", { trace: traceFixture({ executionMode: "default" }) }),
  );
  assert.equal(ignored.modeConfirmed, false);
});

test("deterministic facts report zero model calls, zero tokens, and zero cost", async () => {
  const { comparisonFacts } = await labModule();
  const facts = comparisonFacts(
    sideFixture("deterministic", {
      trace: traceFixture({
        executionMode: "deterministic",
        modelCalls: [],
        responseSource: "deterministic",
        provider: "guided",
        model: null,
        durationMs: 40,
      }),
    }),
  );
  assert.equal(facts.modeConfirmed, true);
  assert.equal(facts.modelCallCount, 0);
  assert.equal(facts.totalTokens, 0);
  assert.equal(facts.estimatedCostUsd, 0);
  assert.equal(facts.responseSource, "deterministic");
  assert.equal(facts.provider, "guided");
});

test("model cost is estimated only for priced models, never guessed", async () => {
  const { estimateModelCostUsd } = await labModule();
  assert.equal(estimateModelCostUsd(traceFixture({ modelCalls: [] })), 0);
  const priced = estimateModelCostUsd(traceFixture());
  assert.ok(priced > 0 && priced < 0.001, `unexpected estimate ${priced}`);
  const unpriced = estimateModelCostUsd(
    traceFixture({
      modelCalls: [
        {
          operation: "assistant_composer",
          attempt: 1,
          durationMs: 1,
          outcome: "accepted",
          model: "some-unlisted-model",
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        },
      ],
    }),
  );
  assert.equal(unpriced, null);
});

test("the delta names what actually differs between the two runs", async () => {
  const { comparisonDelta, comparisonFacts } = await labModule();
  const normal = comparisonFacts(sideFixture("default"));
  const deterministic = comparisonFacts(
    sideFixture("deterministic", {
      message: "Final transcript: still required.",
      trace: traceFixture({
        executionMode: "deterministic",
        modelCalls: [],
        provider: "guided",
        model: null,
        responseSource: "deterministic",
        durationMs: 45,
        toolCalls: [{ tool: "getEnrollmentChecklist", status: "ok", round: "initial" }],
      }),
    }),
  );
  const delta = comparisonDelta(
    normal,
    deterministic,
    "You still owe your final transcript.",
    "Final transcript: still required.",
  );
  assert.equal(delta.sameMessage, false);
  assert.equal(delta.sameRequestType, true);
  assert.equal(delta.sameTools, false);
  assert.deepEqual(delta.toolsOnlyInNormal, ["getAccountBalance"]);
  assert.deepEqual(delta.toolsOnlyInDeterministic, []);
  assert.equal(delta.serverDurationDeltaMs, 45 - 1400);
  assert.equal(delta.tokensSaved, 1100);
  assert.ok(delta.costSavedUsd > 0);
  assert.deepEqual(delta.unverified, []);
});

test("the experiment set covers every comparison category the study needs", async () => {
  const { COMPARISON_EXPERIMENTS } = await labModule();
  const categories = COMPARISON_EXPERIMENTS.map((item) => item.category);
  assert.deepEqual(categories, [
    "Direct simple",
    "Direct financial",
    "Cross-domain",
    "Aggregation",
    "Ambiguous",
    "Multi-intent",
    "Follow-up",
    "Unsupported",
  ]);
  // A follow-up is only meaningful with prior context, and both runs must get it.
  const followUp = COMPARISON_EXPERIMENTS.find((item) => item.category === "Follow-up");
  assert.ok(followUp.history.length > 0);
});

/* --- the mode header is a lab control, not a default ----------------------- */

test("askEdward sends the mode header only when the lab explicitly asks for it", async () => {
  const { EDWARD_EXECUTION_MODE_HEADER } = await labModule();
  const source = await readFile(
    new URL("../app/lib/api-client.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /\.\.\.\(options\.executionMode\s*\?\s*\{\s*\[EDWARD_EXECUTION_MODE_HEADER\]: options\.executionMode\s*\}\s*:\s*\{\}\)/,
  );
  // The client declares the header itself so it carries no runtime dependency
  // on Lab code; the two declarations must not drift apart.
  assert.match(
    source,
    new RegExp(
      `const EDWARD_EXECUTION_MODE_HEADER = "${EDWARD_EXECUTION_MODE_HEADER}";`,
    ),
  );
  // Lab types may be imported, Lab runtime values may not.
  assert.match(source, /import type \{ EdwardExecutionMode \} from "\.\/edward-lab";/);
  // No other call site may pin a mode.
  const callers = await readdir(new URL("../app/components/", import.meta.url));
  for (const file of callers) {
    if (!file.endsWith(".tsx") || file === "edward-lab-compare.tsx") continue;
    const content = await readFile(
      new URL(`../app/components/${file}`, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      content,
      /executionMode/,
      `${file} must not pin an Edward execution mode`,
    );
  }
});

test("the comparison panel runs both modes over identical, unpersisted state", async () => {
  const source = await readFile(
    new URL("../app/components/edward-lab-compare.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /const MODES: readonly EdwardExecutionMode\[\] = \["default", "deterministic"\]/);
  // Conversation-less turns: no conversationId and no clientMessageId, so the
  // platform never persists an exchange between the two runs.
  assert.doesNotMatch(source, /conversationId/);
  assert.doesNotMatch(source, /clientMessageId/);
  // Both runs get the same fixed page context and the same replayed history.
  assert.match(source, /pageContext: PAGE_CONTEXT/);
  assert.match(source, /history\.length > 0 \? \{ history \} : \{\}/);
  // Traces are read through the shared same-origin proxy helper, never by
  // reaching the platform's worker-token endpoints from the browser.
  assert.match(source, /fetchTraceWithRetry\(requestId, labFetch\)/);
  assert.doesNotMatch(source, /internal\/assistant/);
  assert.doesNotMatch(source, /x-vv-worker-token/i);
});
