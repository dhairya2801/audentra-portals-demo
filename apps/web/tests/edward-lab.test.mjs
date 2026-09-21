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
  const feedback = await renderBuiltWorker(
    "/api/edward-lab/feedback?assistantKind=student",
  );
  assert.equal(feedback.status, 404);
  const personas = await renderBuiltWorker("/api/edward-lab/personas");
  assert.equal(personas.status, 404);
});

/* --- credential boundary --------------------------------------------------- */

test("no worker credential or internal trace path leaks into client assets", async () => {
  // Vinext 0.2 nests emitted browser assets under _next/static. Scan the
  // complete client output so a new chunk layout cannot hide a credential.
  const clientDirectory = new URL("../dist/client/", import.meta.url);
  const files = await readdir(clientDirectory, { recursive: true });
  for (const file of files) {
    if (!/\.(js|css)$/.test(file)) continue;
    const content = await readFile(
      new URL(file.replaceAll("\\", "/"), clientDirectory),
      "utf8",
    );
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
    // The current architecture: the loop, staff identity/entities, recognition,
    // the history the model saw, and per-stage details.
    "Model read loop",
    "Entity &amp; referent resolution",
    "Staff identity",
    "Write recognition",
    "historyPreview",
    "stageDetails",
    "roundLabel",
    "modelCallLabel",
    "guardReasonLabel",
  ]) {
    assert.ok(source.includes(marker), `inspector must render "${marker}"`);
  }
  // The static eight-tick checklist is gone: the guard panel shows the
  // recorded verdict and reason code, never checks it cannot see.
  assert.doesNotMatch(source, /GUARD_CHECKS/);
});

/* --- current-architecture vocabulary ------------------------------------------ */

const loopTrace = {
  traceId: "loop-1",
  path: "pipeline",
  readPlanner: "hybrid",
  responseSource: "model_loop",
  classification: { requestType: "enrollment_state", confidence: 0.6, source: "model_loop" },
  toolSelectionSource: "model_loop",
  selectedTools: ["getEnrollmentState", "getOnboardingChecklist"],
  toolCalls: [
    { tool: "getEnrollmentState", status: "available", round: "loop-1", durationMs: 40 },
    { tool: "getOnboardingChecklist", status: "available", round: "loop-1", durationMs: 55 },
  ],
  readLoop: {
    rounds: 2,
    outcome: "answered",
    reads: ["getEnrollmentState", "getOnboardingChecklist"],
    reasoning: ["Check state and checklist.", "Answer."],
    steps: [
      {
        round: 1,
        outcome: "reads",
        reasoning: "Check state and checklist.",
        reads: [
          { tool: "getEnrollmentState", status: "available" },
          { tool: "getOnboardingChecklist", status: "available" },
        ],
      },
      { round: 2, outcome: "answered", reasoning: "Answer.", reads: [] },
    ],
    guard: "accepted",
  },
  modelCalls: [
    { operation: "assistant_read_loop", attempt: 1, outcome: "step", durationMs: 900, usage: { totalTokens: 2000 } },
    { operation: "assistant_read_loop", attempt: 2, outcome: "step", durationMs: 1500, usage: { totalTokens: 4200 } },
  ],
  stages: [
    { stage: "normalize", durationMs: 0 },
    { stage: "read_loop", durationMs: 2500, rounds: 2, outcome: "accepted" },
  ],
  evidence: ["getEnrollmentState.depositPaid: true"],
  historyMessages: 0,
  finalMessage: "No, you are not fully good to go.",
  durationMs: 2600,
};

test("a model-loop turn is never reported as deterministic", async () => {
  const { summarizeTrace, guardVerdict } = await labModule();
  const summary = summarizeTrace(loopTrace);
  assert.equal(summary.status, "loop");
  assert.equal(summary.statusLabel, "Model loop ✓");
  assert.equal(summary.loopRounds, 2);
  assert.equal(summary.modelCallCount, 2);
  assert.equal(summary.totalTokens, 6200);
  assert.deepEqual(guardVerdict(loopTrace), { verdict: "accepted", reason: null });
  const rejected = summarizeTrace({
    ...loopTrace,
    responseSource: "deterministic",
    readLoop: { ...loopTrace.readLoop, guard: "invented_hold", rejectedAnswer: "You have a hold." },
    failureCodes: ["read_loop_fallback:invented_hold"],
  });
  assert.equal(rejected.status, "fallback");
  assert.deepEqual(rejected.guard, { verdict: "rejected", reason: "invented_hold" });
});

test("every hosting-service route has a label and the right status family", async () => {
  const { summarizeTrace, pathLabel, PATH_LABELS } = await labModule();
  for (const path of [
    "pipeline",
    "idempotent_replay",
    "pre_pipeline_safety_gate",
    "action_untrusted_framing",
    "action_conversation_recall",
    "action_clarification",
    "action_proposal",
    "action_proposal_denied",
    "action_boundary",
    "action_capability_answer",
  ]) {
    assert.ok(PATH_LABELS[path], `${path} needs a label`);
  }
  assert.equal(summarizeTrace({ traceId: "x", path: "action_boundary" }).status, "action");
  assert.equal(summarizeTrace({ traceId: "x", path: "action_boundary" }).statusLabel, "Boundary answer");
  assert.equal(summarizeTrace({ traceId: "x", path: "action_untrusted_framing" }).status, "safety_gate");
  assert.equal(summarizeTrace({ traceId: "x", path: "action_proposal" }).status, "action");
  // Unknown paths are shown verbatim, never mapped to something else.
  assert.equal(pathLabel("action_future_thing"), "action future thing");
});

test("tool rounds and model-call operations are labelled as the platform emits them", async () => {
  const { roundLabel, roundFamily, modelCallLabel, recognitionSourceLabel } = await labModule();
  assert.equal(roundLabel("entities"), "entity lookup");
  assert.equal(roundLabel("loop-3"), "loop round 3");
  assert.equal(roundLabel("dependency"), "dependency");
  assert.equal(roundFamily("loop-2"), "loop");
  assert.equal(roundFamily("entities"), "entities");
  assert.equal(modelCallLabel("action_recognizer"), "Action recognizer (tier 1)");
  assert.equal(modelCallLabel("assistant_read_loop"), "Read loop step");
  assert.equal(modelCallLabel("assistant_composer"), "Prose composer");
  assert.equal(modelCallLabel("assistant_planner"), "Model planner");
  assert.match(recognitionSourceLabel("model_none"), /tier 1 consulted/);
  assert.match(recognitionSourceLabel(null), /not action-shaped/);
});

test("the guard glossary covers every rejection code the claim guard emits", async () => {
  const { GUARD_REASONS, guardReasonLabel } = await labModule();
  // Mirrors reject(...) calls in platform integrations/assistant/guard.py.
  for (const code of [
    "claimed_write",
    "contradicted_document_state",
    "contradicted_processing_state",
    "empty",
    "invented_causation",
    "invented_hold",
    "leaked_identifier",
    "missing_unavailability_note",
    "too_long",
    "ungrounded_contact",
    "ungrounded_date",
    "ungrounded_number",
  ]) {
    assert.ok(GUARD_REASONS[code], `guard code ${code} needs an explanation`);
  }
  assert.equal(guardReasonLabel("brand_new_code"), "brand new code");
});

/* --- route derivation --------------------------------------------------------- */

test("routeFor lights the read loop, not the deterministic route, on a loop turn", async () => {
  const { routeFor } = await labModule();
  const route = routeFor(loopTrace);
  assert.deepEqual(route.sequence, [
    "message",
    "gates",
    "read_loop",
    "guard",
    "answer",
  ]);
  const loop = route.nodes.find((node) => node.id === "read_loop");
  assert.equal(loop.state, "hot");
  assert.equal(loop.toolCalls.length, 2);
  assert.equal(loop.modelCalls.length, 2);
  assert.equal(loop.notes.length, 2);
  assert.match(loop.notes[0].label, /round 1 · reads/);
  assert.equal(route.nodes.find((node) => node.id === "tool_reads").state, "skipped");
  assert.equal(route.nodes.find((node) => node.id === "answer").state, "ended");
});

test("routeFor ends a staff turn at entity resolution when an ambiguity answered it", async () => {
  const { routeFor } = await labModule();
  const route = routeFor({
    traceId: "staff-1",
    assistantKind: "staff",
    path: "pipeline",
    classification: { requestType: "student_overview", confidence: 0.97, source: "deterministic" },
    identity: { name: "Matthias Gunnarsson", roleCode: "international_adviser", component: "ISS" },
    entities: {
      mentions: [{ text: "Fiona Ashgrove", kindHint: "person" }],
      students: [],
      staff: [],
      departments: [],
      ambiguities: [{ mention: "Fiona Ashgrove", reason: "several_students", students: ["a", "b", "c", "d"] }],
    },
    toolCalls: [
      { tool: "searchStaff", status: "available", round: "entities", recordCount: 0 },
      { tool: "searchStudents", status: "available", round: "entities", recordCount: 4 },
    ],
    stages: [
      { stage: "normalize", durationMs: 0 },
      { stage: "load_identity", durationMs: 16 },
      { stage: "resolve_entities", durationMs: 28, ambiguous: ["Fiona Ashgrove"] },
    ],
    responseSource: "deterministic",
    finalMessage: "I found 4 students matching “Fiona Ashgrove” — which one do you mean?",
  });
  assert.deepEqual(route.sequence, ["message", "gates", "identity", "entities", "answer"]);
  const entities = route.nodes.find((node) => node.id === "entities");
  assert.equal(entities.state, "ended");
  assert.match(entities.headline, /Ambiguous/);
  assert.equal(entities.toolCalls.length, 2);
  const classifier = route.nodes.find((node) => node.id === "classifier");
  assert.equal(classifier.state, "skipped");
  assert.match(classifier.headline, /Consulted \(student_overview\)/);
});

test("routeFor follows gated and action routes without inventing pipeline stages", async () => {
  const { routeFor } = await labModule();
  const boundary = routeFor({ traceId: "b", path: "action_boundary", finalMessage: "I can't take a file." });
  assert.deepEqual(boundary.sequence, ["message", "gates", "boundary", "answer"]);
  const gate = routeFor({ traceId: "g", path: "pre_pipeline_safety_gate", finalMessage: "…" });
  assert.deepEqual(gate.sequence, ["message", "gates", "answer"]);
  assert.equal(gate.nodes.find((node) => node.id === "gates").state, "ended");
  const proposal = routeFor({
    traceId: "p",
    path: "action_proposal",
    actionRequested: "student.preferences.update",
    actionRecognitionSource: "pattern",
    actionProposed: "student.preferences.update",
    actionPolicyResult: "allowed",
    finalMessage: "Preview…",
  });
  assert.deepEqual(proposal.sequence, ["message", "gates", "recognizer", "action_gateway", "answer"]);
  assert.equal(proposal.nodes.find((node) => node.id === "recognizer").state, "hot");
});

test("routeFor keeps a skipped composer out of the executed sequence in zero-LLM mode", async () => {
  const { routeFor } = await labModule();
  const route = routeFor({
    traceId: "d",
    path: "pipeline",
    executionMode: "deterministic",
    classification: { requestType: "remaining_steps", confidence: 1, source: "deterministic" },
    toolCalls: [{ tool: "getOnboardingChecklist", status: "available", round: "initial" }],
    stages: [
      { stage: "normalize", durationMs: 0 },
      { stage: "classify_and_plan", durationMs: 1 },
      { stage: "execute_tool_reads", durationMs: 3 },
      { stage: "compose_deterministic", durationMs: 1 },
      { stage: "model_rewrite", durationMs: 0 },
    ],
    responseSource: "deterministic",
    finalMessage: "2 steps remain.",
  });
  assert.deepEqual(route.sequence, [
    "message",
    "gates",
    "classifier",
    "tool_reads",
    "compose",
    "answer",
  ]);
  assert.match(route.nodes.find((node) => node.id === "rewrite").headline, /deterministic execution mode/);
});

test("the architecture tab and the info buttons exist in both labs and stay honest", async () => {
  const architecture = await readFile(
    new URL("../app/components/edward-architecture.tsx", import.meta.url),
    "utf8",
  );
  assert.match(architecture, /routeFor\(trace\)/);
  assert.match(architecture, /ROUTE_NODES/);
  assert.doesNotMatch(architecture, /internal\/assistant/);
  const info = await readFile(
    new URL("../app/components/edward-lab-info.tsx", import.meta.url),
    "utf8",
  );
  assert.match(info, /\/api\/edward-lab\/tools/);
  assert.match(info, /Not in either planner catalogue/);
  for (const file of ["edward-lab.tsx", "staff-edward-lab.tsx"]) {
    const source = await readFile(new URL(`../app/components/${file}`, import.meta.url), "utf8");
    assert.match(source, /"architecture"/, `${file} needs the Architecture view`);
    assert.match(source, /EdwardArchitecture/);
    assert.match(source, /LabInfoProvider/);
    assert.match(source, /READ_PLANNERS/, `${file} needs the read-planner control`);
  }
  // The student Lab lists only student traces; staff has its own Lab.
  const student = await readFile(new URL("../app/components/edward-lab.tsx", import.meta.url), "utf8");
  assert.match(student, /assistantKind \?\? "student"\) === "student"/);
  const route = await readFile(new URL("../app/api/edward-lab/tools/route.ts", import.meta.url), "utf8");
  assert.match(route, /proxyInternal\("\/internal\/assistant\/dev\/tools"\)/);
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
  assert.match(
    source,
    /import type \{ EdwardExecutionMode, EdwardReadPlanner \} from "\.\/edward-lab";/,
  );
  assert.doesNotMatch(source, /import \{[^}]*\} from "\.\/edward-lab"/);
  // No other call site may pin a mode (an `executionMode:` request option).
  // Reading `trace.executionMode` to display it is fine.
  const callers = await readdir(new URL("../app/components/", import.meta.url));
  for (const file of callers) {
    if (!file.endsWith(".tsx") || file === "edward-lab-compare.tsx") continue;
    const content = await readFile(
      new URL(`../app/components/${file}`, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      content,
      /executionMode\s*:/,
      `${file} must not pin an Edward execution mode`,
    );
  }
});

test("the read-planner header is pinned in the client and sent only when the lab asks", async () => {
  const { EDWARD_READ_PLANNER_HEADER } = await labModule();
  const source = await readFile(
    new URL("../app/lib/api-client.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    new RegExp(`const EDWARD_READ_PLANNER_HEADER = "${EDWARD_READ_PLANNER_HEADER}";`),
  );
  assert.match(
    source,
    /\.\.\.\(options\.readPlanner\s*\?\s*\{\s*\[EDWARD_READ_PLANNER_HEADER\]: options\.readPlanner\s*\}\s*:\s*\{\}\)/,
  );
  // Both assistants accept the same Lab options; product surfaces pass none.
  assert.match(source, /export function askStaffEdward\([\s\S]*?options: EdwardLabRequestOptions = \{\}/);
  const assistant = await readFile(
    new URL("../app/components/edward-assistant.tsx", import.meta.url),
    "utf8",
  );
  assert.match(assistant, /labOptions\?: EdwardLabRequestOptions/);
  assert.match(assistant, /labOptions \?\? \{\}/);
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


test("architecture distinguishes an unavailable planner, failed loop and rejected answer", async () => {
  const { routeFor, guardVerdict } = await labModule();
  const unavailable = routeFor({
    traceId: "university-disabled", path: "pipeline", executionMode: "deterministic",
    readPlanner: "model", stages: [{ stage: "normalize", durationMs: 0 }],
    responseSource: "university_planner_unavailable", failureCodes: ["university_planner_required"],
    finalMessage: "University record guidance is temporarily unavailable.",
  });
  for (const id of ["read_loop", "tool_reads", "compose", "guard"]) {
    assert.equal(unavailable.nodes.find(node => node.id === id).state, "skipped");
  }
  const failed = { ...loopTrace, responseSource: "university_model_unavailable",
    readLoop: { rounds: 1, outcome: "model_error", guard: "model_error", reads: [], reasoning: [] },
    failureCodes: ["read_loop_fallback:model_error"] };
  assert.equal(guardVerdict(failed).verdict, "not_run");
  assert.doesNotMatch(routeFor(failed).nodes.find(node => node.id === "read_loop").headline, /rejected|deterministic route/);
  const rejected = { ...failed, readLoop: { ...failed.readLoop, outcome: "answered", guard: "ungrounded_number", rejectedAnswer: "You owe $99." } };
  const route = routeFor(rejected);
  assert.equal(guardVerdict(rejected).verdict, "rejected");
  assert.match(route.nodes.find(node => node.id === "guard").headline, /recorded fallback response/);
  assert.doesNotMatch(route.nodes.find(node => node.id === "guard").headline, /draft/);
});

test("architecture retains recorded loop notes, discarded answers and response projection", async () => {
  const { routeFor } = await labModule();
  const trace = { ...loopTrace,
    readLoop: { ...loopTrace.readLoop, steps: [{ round: 1, outcome: "reads", reasoning: "Fetch fresh evidence.", reads: [], forced: true, discardedAnswer: true }] },
    stages: [...loopTrace.stages, { stage: "presentation", durationMs: 1, construction: "semantic_projection", blockTypes: ["answer"] }],
    responseBlocks: [{ type: "answer" }],
  };
  const route = routeFor(trace);
  assert.deepEqual(route.sequence.slice(-3), ["guard", "presentation", "answer"]);
  const loop = route.nodes.find(node => node.id === "read_loop");
  assert.equal(loop.notes[0].text, "Fetch fresh evidence.");
  assert.match(loop.notes[0].label, /forced.*proposed answer discarded/);
  assert.equal(route.nodes.find(node => node.id === "classifier").state, "skipped");
  assert.deepEqual(routeFor({ traceId: "missing" }).sequence, ["message", "answer"]);
});

test("an interrupted read stage does not invent a composed draft", async () => {
  const { routeFor } = await labModule();
  const route = routeFor({ traceId: "partial", path: "pipeline", error: "read failed",
    stages: [{ stage: "execute_tool_reads", durationMs: 2 }] });
  assert.equal(route.nodes.find(node => node.id === "compose").state, "skipped");
});

test("unsupported university comparison explains the limitation and reports no savings", async () => {
  const { comparisonFacts, comparisonDelta } = await labModule();
  const normal = comparisonFacts(sideFixture("default"));
  const deterministic = comparisonFacts(sideFixture("deterministic", { trace: {
    traceId: "disabled", executionMode: "deterministic", modelCalls: [],
    responseSource: "university_planner_unavailable", failureCodes: ["university_planner_required"],
    durationMs: 1,
  } }));
  assert.match(deterministic.unavailableReason, /require model planning/);
  assert.equal(deterministic.modeConfirmed, true);
  assert.equal(deterministic.modelCallCount, 0);
  const delta = comparisonDelta(normal, deterministic, "answer", "unavailable");
  assert.equal(delta.comparable, false);
  assert.equal(delta.tokensSaved, null);
  assert.equal(delta.costSavedUsd, null);
  assert.equal(delta.serverDurationDeltaMs, null);
});

test("missing traces and partially recorded usage never imply zero cost or savings", async () => {
  const { comparisonFacts, comparisonDelta, estimateModelCostUsd } = await labModule();
  const absent = comparisonFacts(sideFixture("deterministic", { trace: null }));
  assert.equal(absent.totalTokens, null);
  assert.equal(absent.estimatedCostUsd, null);
  assert.equal(comparisonDelta(comparisonFacts(sideFixture("default")), absent, "a", "b").comparable, false);
  const trace = traceFixture();
  assert.equal(estimateModelCostUsd({ ...trace, modelCalls: [...trace.modelCalls, { operation: "assistant_read_loop", model: "unpriced", usage: { totalTokens: 100 } }] }), null);
});


test("a rejected loop is checked before fallback planning and deterministic composition", async () => {
  const { routeFor } = await labModule();
  const trace = { ...loopTrace, responseSource: "deterministic",
    readLoop: { ...loopTrace.readLoop, guard: "ungrounded_number", rejectedAnswer: "$999" },
    modelCalls: [...loopTrace.modelCalls, { operation: "assistant_planner", attempt: 1, outcome: "accepted", durationMs: 3 }],
    stages: [...loopTrace.stages, { stage: "execute_tool_reads", durationMs: 2 }, { stage: "compose_deterministic", durationMs: 1 }],
  };
  const route = routeFor(trace);
  assert.deepEqual(route.sequence.slice(-6), ["read_loop", "guard", "model_planner", "tool_reads", "compose", "answer"]);
  route.sequence.forEach((id, index) => assert.equal(route.nodes.find(node => node.id === id).order, index + 1));
});


test("tree hot edges bypass unrecorded blocks instead of lighting the static layout", async () => {
  const { routeFor, routeEdges } = await labModule();
  const route = routeFor(loopTrace);
  assert.equal(route.nodes.find(node => node.id === "recognizer").state, "skipped");
  assert.deepEqual(routeEdges(route), [
    { from: "message", to: "gates" }, { from: "gates", to: "read_loop" },
    { from: "read_loop", to: "guard" }, { from: "guard", to: "answer" },
  ]);
  const replay = routeEdges(routeFor({ traceId: "replay", path: "idempotent_replay", finalMessage: "saved" }));
  assert.deepEqual(replay, [{ from: "message", to: "gates" }, { from: "gates", to: "answer" }]);
});

test("staff model operations light the planner, composer and guard", async () => {
  const { routeFor, guardVerdict, modelCallLabel } = await labModule();
  const trace = { traceId: "staff-rewrite", assistantKind: "staff", path: "pipeline",
    responseSource: "deterministic", finalMessage: "Use the recorded checklist.",
    stages: [{ stage: "execute_tool_reads", durationMs: 1 }, { stage: "compose_deterministic", durationMs: 1 }],
    modelCalls: [
      { operation: "staff_assistant_planner", attempt: 1, outcome: "accepted", durationMs: 2 },
      { operation: "staff_assistant_composer", attempt: 1, outcome: "guard_rejected", detail: "ungrounded_number", durationMs: 2 },
    ],
  };
  const route = routeFor(trace);
  for (const id of ["model_planner", "rewrite", "guard"]) assert.equal(route.nodes.find(node => node.id === id).state, "hot");
  assert.equal(guardVerdict(trace).verdict, "rejected");
  assert.equal(modelCallLabel("staff_assistant_composer"), "Prose composer");
});


test("fallback rewrites retain both guard visits in the hot path", async () => {
  const { routeFor, routeEdges } = await labModule();
  const trace = { ...loopTrace, responseSource: "model_prose",
    readLoop: { ...loopTrace.readLoop, guard: "ungrounded_number", rejectedAnswer: "$999" },
    modelCalls: [...loopTrace.modelCalls, { operation: "assistant_composer", attempt: 1, outcome: "accepted", durationMs: 2 }],
    stages: [...loopTrace.stages, { stage: "execute_tool_reads", durationMs: 1 }, { stage: "compose_deterministic", durationMs: 1 }],
  };
  const route = routeFor(trace);
  assert.deepEqual(route.sequence.slice(-7), ["read_loop", "guard", "tool_reads", "compose", "rewrite", "guard", "answer"]);
  assert.equal(route.nodes.find(node => node.id === "guard").orders.length, 2);
  assert.ok(routeEdges(route).some(edge => edge.from === "guard" && edge.to === "tool_reads"));
});
