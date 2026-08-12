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
