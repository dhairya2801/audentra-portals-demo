/**
 * Edward Lab — pure helpers for the developer trace dashboard.
 *
 * Everything here is framework-free so it can be unit-tested with node:test.
 * The Lab never talks to the platform's worker-token-protected trace
 * endpoints directly from the browser: it goes through the same-origin
 * `/api/edward-lab/*` route handlers, which hold the credential server-side.
 *
 * The one rule every helper follows: derive, never invent. A label is shown
 * only when the trace positively records the thing it names; anything the
 * trace does not say is rendered as "not recorded", not guessed.
 */

/**
 * How one Edward turn was allowed to execute. `default` is exactly what
 * production does; `deterministic` removes the model planner and the prose
 * composer for that single turn, so the platform makes zero provider calls.
 * The platform honours the header only where its own Lab controls are on.
 */
export type EdwardExecutionMode = "default" | "deterministic";

export const EDWARD_EXECUTION_MODE_HEADER = "X-Edward-Mode";

/**
 * Who plans the reads for a question the safety gates let through. The
 * deployment default is `hybrid`; the Lab can pin one per request where Lab
 * controls are honoured, so one host can serve an A/B.
 */
export type EdwardReadPlanner = "deterministic" | "hybrid" | "model";

export const EDWARD_READ_PLANNER_HEADER = "x-edward-read-planner";

export const READ_PLANNERS: ReadonlyArray<{ value: EdwardReadPlanner; label: string }> =
  Object.freeze([
    { value: "deterministic", label: "deterministic" },
    { value: "hybrid", label: "hybrid" },
    { value: "model", label: "model" },
  ]);

/**
 * One executed tool read as recorded in the AssistantTurnTrace.
 *
 * `round` is an open string on purpose: the platform emits "initial",
 * "dependency", "referent" and "entities" for the deterministic route and
 * "loop-1" … "loop-N" for the model read loop. See `roundLabel`.
 */
export interface TraceToolCall {
  tool: string;
  status: string;
  round: string;
  durationMs?: number | null;
  recordCount?: number | null;
  reason?: string | null;
  result?: unknown;
  /** Model result projection, with trace privacy redaction applied. */
  modelResult?: unknown;
  /** Staff tools take validated arguments; recorded sanitized when present. */
  arguments?: unknown;
  /** Validation outcome for the recorded arguments (staff turns). */
  validation?: string | null;
}

export interface TraceTextSnapshot {
  text: string;
  characters: number;
  truncated: boolean;
}

export interface TraceModelCall {
  /**
   * "assistant_planner" | "assistant_composer" | "assistant_read_loop" |
   * "action_recognizer" — see `modelCallLabel`.
   */
  operation: string;
  attempt: number;
  durationMs: number;
  outcome: string;
  provider?: string;
  model?: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
  detail?: string | null;
  answer?: TraceTextSnapshot | null;
}

export interface TraceStage {
  stage: string;
  durationMs: number;
  /** Stage-specific facts the pipeline attached (coverage gate domains, …). */
  [key: string]: unknown;
}

/** One model round of the read loop, as it actually unfolded. */
export interface TraceLoopStep {
  round: number;
  /** "reads" | "answered" | "empty" | "no_answer" | "model_error" | "no_provider" | "invalid_step" */
  outcome: string;
  reasoning?: string;
  reads: Array<{ tool: string; status: string; reason?: string }>;
  forced?: boolean;
  discardedAnswer?: boolean;
}

export interface TraceReadLoop {
  rounds: number;
  outcome: string;
  reads: string[];
  reasoning: string[];
  steps?: TraceLoopStep[];
  /** "accepted" or the claim-guard reason code that rejected the answer. */
  guard: string;
  ungrounded?: string[];
  rejectedAnswer?: string;
}

/** Staff turns: who is signed in, as the pipeline saw them. */
export interface TraceIdentity {
  id?: string;
  name?: string;
  title?: string | null;
  roleCode?: string;
  component?: string;
  employmentStatus?: string | null;
  isManager?: boolean;
  directReports?: number;
  primaryAdvisees?: number;
}

export interface TraceResolvedEntity {
  kind: string;
  id: string;
  name: string;
  mention?: string;
  matchQuality?: string;
}

/** Staff turns: how every name in the message resolved. */
export interface TraceEntities {
  mentions?: Array<{ text: string; kindHint?: string | null; possessive?: boolean }>;
  staff?: TraceResolvedEntity[];
  students?: TraceResolvedEntity[];
  departments?: TraceResolvedEntity[];
  ambiguities?: Array<{
    mention: string;
    reason: string;
    staff?: unknown[];
    students?: unknown[];
    fuzzy?: boolean;
  }>;
  selfReference?: boolean;
  selfTeam?: boolean;
  staffContext?: boolean;
  studentContext?: boolean;
}

/** The AssistantTurnTrace payload exactly as the platform serializes it. */
export interface EdwardTurnTrace {
  traceId: string;
  /** "student" (or absent on older traces) vs "staff". */
  assistantKind?: string;
  /** Staff turns record who asked. */
  actorType?: string | null;
  staffMemberId?: string | null;
  tenantId?: string | null;
  studentId?: string | null;
  conversationId?: string | null;
  inputMode?: string;
  /** Which route the hosting service took; see `pathLabel`. */
  path?: string;
  /** "default" is production execution; "deterministic" is the Lab's zero-LLM turn. */
  executionMode?: EdwardExecutionMode;
  /** A mode the platform refused to honour, recorded but never applied. */
  ignoredExecutionModeRequest?: string | null;
  userMessage?: string;
  pagePath?: string | null;
  pageLabel?: string | null;
  historyMessages?: number;
  historySource?: string;
  /** The bounded tail of the history the model saw (role + opening text). */
  historyPreview?: Array<{ role: string; content: string }>;
  classification?: {
    requestType?: string;
    confidence?: number;
    source?: string;
    additionalRequestTypes?: string[];
    requirementReference?: string | null;
    /** Staff classification: the referenced student/topic, when one exists. */
    reference?: string | null;
    /** Action proposals record the semantic action here. */
    action?: string | null;
  } | null;
  toolSelectionSource?: string | null;
  selectedTools?: string[];
  toolCalls?: TraceToolCall[];
  secondRead?: { triggeredBy?: Array<{ gate: string; tool: string }>; tools?: string[] } | null;
  /** Which read planner the turn ran under. */
  readPlanner?: EdwardReadPlanner | string | null;
  /** The model read loop, when it ran. */
  readLoop?: TraceReadLoop | null;
  identity?: TraceIdentity | null;
  entities?: TraceEntities | null;
  evidence?: string[];
  modelCalls?: TraceModelCall[];
  modelIterations?: number;
  provider?: string | null;
  model?: string | null;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
  /** "model_prose" | "model_loop" | "deterministic" */
  responseSource?: string | null;
  responseBlocks?: Array<{ type: string; fallbackText?: string; provenance?: { tool?: string; kind?: string; asOf?: string } }>;
  failureCodes?: string[];
  /** Deterministic action-plane decisions and committed receipt, when present. */
  actionRequested?: string | null;
  /** "pattern" | "continuation" | "model" | "model_none" | "pattern+model" | null */
  actionRecognitionSource?: string | null;
  actionProposed?: string | null;
  actionPolicyResult?: string | null;
  actionDenialReason?: string | null;
  actionIntentId?: string | null;
  actionConfirmationMode?: string | null;
  actionAuthorizationCapability?: string | null;
  actionBlastRadius?: number | null;
  actionProvenance?: Array<Record<string, unknown>>;
  actionReceipt?: Record<string, unknown> | null;
  actionExecutionResult?: string | null;
  actionLatencyMs?: number | null;
  deterministicDraft?: TraceTextSnapshot | null;
  finalMessage?: string;
  finalMessageTruncated?: boolean;
  userMessageId?: string | null;
  assistantMessageId?: string | null;
  stages?: TraceStage[];
  error?: string | null;
  startedAt?: string;
  durationMs?: number | null;
}

export interface TraceListEntry {
  traceId: string;
  /** "student" (or absent on older traces) vs "staff". */
  assistantKind?: string;
  startedAt?: string;
  path?: string;
  executionMode?: EdwardExecutionMode;
  inputMode?: string;
  conversationId?: string | null;
  studentId?: string | null;
  userMessage?: string;
  requestType?: string | null;
  toolSelectionSource?: string | null;
  readPlanner?: string | null;
  executedTools?: string[];
  modelIterations?: number;
  responseSource?: string | null;
  failureCodes?: string[];
  actionRequested?: string | null;
  actionProposed?: string | null;
  actionPolicyResult?: string | null;
  actionExecutionResult?: string | null;
  durationMs?: number | null;
}

/** One tool as the planners are told about it, from /api/edward-lab/tools. */
export interface LabToolInfo {
  name: string;
  description: string;
  informationClass?: string | null;
  arguments?: Record<string, Record<string, unknown>> | null;
}

export interface LabToolCatalogue {
  student: LabToolInfo[];
  staff: LabToolInfo[];
}

/**
 * The Lab exists in development, and in any other environment only when the
 * flag is explicitly "true". NEXT_PUBLIC_* values are inlined at build time,
 * so a production bundle without the flag contains a permanently-disabled
 * page and the server route handlers refuse with 404.
 */
export function edwardLabEnabled(env: {
  NEXT_PUBLIC_EDWARD_DEBUG_ENABLED?: string;
  NODE_ENV?: string;
}): boolean {
  const flag = env.NEXT_PUBLIC_EDWARD_DEBUG_ENABLED?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return env.NODE_ENV === "development";
}

/**
 * Traces are recorded immediately after the response is composed, but give
 * the recorder a few short chances in case the response beats the record by
 * a tick. Bounded: never polls forever.
 */
export async function fetchTraceWithRetry(
  traceId: string,
  fetchImpl: (url: string) => Promise<{ status: number; json(): Promise<unknown> }>,
  options: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<EdwardTurnTrace | null> {
  const attempts = Math.max(1, Math.min(options.attempts ?? 4, 8));
  const delayMs = options.delayMs ?? 250;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(
        `/api/edward-lab/traces/${encodeURIComponent(traceId)}`,
      );
      if (response.status === 200) {
        return (await response.json()) as EdwardTurnTrace;
      }
      // 404 may be the record race; anything else is not worth retrying.
      if (response.status !== 404) return null;
    } catch {
      // transient network failure — retry within the bound
    }
    if (attempt < attempts) await sleep(delayMs);
  }
  return null;
}

/* --- vocabulary ------------------------------------------------------------ */

/**
 * Every `trace.path` the hosting service emits, with the plain-language
 * meaning. A path missing from this table is shown verbatim, never mapped.
 */
export const PATH_LABELS: Readonly<Record<string, string>> = Object.freeze({
  pipeline: "Read pipeline",
  idempotent_replay: "Replayed a stored exchange",
  pre_pipeline_safety_gate: "Safety gate refusal",
  action_untrusted_framing: "Injection prefilter refusal",
  action_conversation_recall: "Answered from action receipts",
  action_clarification: "Clarifying question (action)",
  action_proposal: "Action proposed",
  action_proposal_denied: "Action denied by policy",
  action_boundary: "Boundary answer",
  action_capability_answer: "Capability answer",
});

export function pathLabel(path: string | null | undefined): string {
  if (!path) return "not recorded";
  return PATH_LABELS[path] ?? path.replaceAll("_", " ");
}

const ROUND_LABELS: Readonly<Record<string, string>> = Object.freeze({
  initial: "initial",
  dependency: "dependency",
  referent: "referent",
  entities: "entity lookup",
});

/** Human label for a tool round, including the loop's numbered rounds. */
export function roundLabel(round: string | null | undefined): string {
  if (!round) return "initial";
  const loop = /^loop-(\d+)$/.exec(round);
  if (loop) return `loop round ${loop[1]}`;
  return ROUND_LABELS[round] ?? round.replaceAll("_", " ");
}

/** Round family, for colour: the loop is one family whatever its round number. */
export function roundFamily(
  round: string | null | undefined,
): "initial" | "dependency" | "referent" | "entities" | "loop" {
  if (!round) return "initial";
  if (round.startsWith("loop-")) return "loop";
  if (round === "dependency" || round === "referent" || round === "entities") return round;
  return "initial";
}

const MODEL_CALL_LABELS: Readonly<Record<string, string>> = Object.freeze({
  assistant_planner: "Model planner",
  assistant_composer: "Prose composer",
  staff_assistant_composer: "Prose composer",
  staff_assistant_planner: "Model planner",
  staff_assistant_read_loop: "Read loop step",
  assistant_read_loop: "Read loop step",
  action_recognizer: "Action recognizer (tier 1)",
});

/** Which component made a model call. Unknown operations are shown verbatim. */
export function modelCallLabel(operation: string | null | undefined): string {
  if (!operation) return "Model call";
  return MODEL_CALL_LABELS[operation] ?? operation.replaceAll("_", " ");
}

/** Student and staff pipelines use different operation prefixes. */
export function modelOperationIs(call: TraceModelCall, operation: string): boolean {
  return call.operation === operation || call.operation === `staff_${operation}`;
}

const RECOGNITION_SOURCE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  pattern: "tier 0 — pattern matched an action",
  continuation: "continuation of an action already on the table",
  model: "tier 1 — model recognized an action",
  "pattern+model": "tier 0 parsed part, tier 1 filled the rest",
  model_none: "tier 1 consulted, found no action",
});

export function recognitionSourceLabel(source: string | null | undefined): string {
  if (!source) return "not action-shaped (no model tier consulted)";
  return RECOGNITION_SOURCE_LABELS[source] ?? source;
}

const RESPONSE_SOURCE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  model_prose: "model prose over deterministic evidence",
  model_loop: "model read loop answer",
  deterministic: "deterministic composer",
});

export function responseSourceLabel(source: string | null | undefined): string {
  if (!source) return "not recorded";
  return RESPONSE_SOURCE_LABELS[source] ?? source;
}

/**
 * Every reason code the claim guard can reject with, and what each means.
 * Mirrors `integrations/assistant/guard.py`; the same codes appear in
 * `readLoop.guard` and as `guard_rejected` model-call details.
 */
export const GUARD_REASONS: Readonly<Record<string, string>> = Object.freeze({
  empty: "The model returned no prose.",
  too_long: "The prose exceeded the answer length bound.",
  claimed_write: "The prose claimed to have changed something; Edward's read plane never writes.",
  leaked_identifier: "The prose contained an internal identifier that students must not see.",
  ungrounded_contact: "The prose gave a contact (email, phone) not present in the evidence.",
  ungrounded_date: "The prose stated a date not present in the evidence.",
  ungrounded_number: "The prose stated a number/amount not present in the evidence.",
  invented_causation:
    "The prose explained a gate with a cause the record does not support (\"because …\").",
  invented_hold: "The prose asserted a hold when the record shows none.",
  contradicted_document_state:
    "The prose described a document state that contradicts the recorded one.",
  contradicted_processing_state:
    "The prose described a processing state (e.g. deposit pending) that contradicts the record.",
  missing_unavailability_note:
    "A source could not be read this turn and the prose did not acknowledge it.",
});

export function guardReasonLabel(code: string | null | undefined): string {
  if (!code) return "not recorded";
  return GUARD_REASONS[code] ?? code.replaceAll("_", " ");
}

const STAGE_LABELS: Record<string, string> = {
  normalize: "Normalize",
  load_identity: "Load staff identity",
  resolve_entities: "Resolve entities",
  coverage_gate: "Coverage gate",
  classify_and_plan: "Classify / plan",
  execute_tool_reads: "Tool reads",
  dependency_reads: "Dependency reads",
  derive_student_state: "Derive state",
  derive_staff_state: "Derive state",
  compose_deterministic: "Compose (deterministic)",
  model_rewrite: "Model rewrite + guard",
  read_loop: "Model read loop",
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replaceAll("_", " ");
}

/** The detail keys a stage carried beyond its name and duration. */
export function stageDetails(stage: TraceStage): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(stage)) {
    if (key === "stage" || key === "durationMs" || value === null || value === undefined) continue;
    out.push([key, Array.isArray(value) ? value.join(", ") : String(value)]);
  }
  return out;
}

export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)} s`;
  return `${Math.round(value)} ms`;
}

export function formatTokens(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US");
}

/* --- summary --------------------------------------------------------------- */

export type TraceStatus =
  | "grounded"
  | "loop"
  | "deterministic"
  | "fallback"
  | "safety_gate"
  | "action"
  | "replay"
  | "error";

export interface TraceSummary {
  status: TraceStatus;
  statusLabel: string;
  requestType: string | null;
  durationMs: number | null;
  toolCount: number;
  dependencyToolCount: number;
  loopRounds: number;
  modelCallCount: number;
  totalTokens: number | null;
  failureCodes: string[];
  guardRejections: TraceModelCall[];
  /** The claim-guard verdict for whichever component wrote the prose. */
  guard: { verdict: "accepted" | "rejected" | "not_run"; reason: string | null };
}

const ACTION_PATHS = new Set([
  "action_conversation_recall",
  "action_clarification",
  "action_proposal",
  "action_proposal_denied",
  "action_boundary",
  "action_capability_answer",
]);

const GATE_PATHS = new Set(["pre_pipeline_safety_gate", "action_untrusted_framing"]);

/** The claim guard's verdict, from whichever component wrote the prose. */
export function guardVerdict(trace: EdwardTurnTrace): TraceSummary["guard"] {
  const loopGuard = trace.readLoop?.guard;
  if (trace.responseSource === "model_loop") {
    return { verdict: "accepted", reason: null };
  }
  const composer = (trace.modelCalls ?? []).filter(
    (call) => modelOperationIs(call, "assistant_composer"),
  );
  const rejected = composer.filter((call) => call.outcome === "guard_rejected");
  if (trace.responseSource === "model_prose") return { verdict: "accepted", reason: null };
  if (rejected.length > 0) {
    return {
      verdict: "rejected",
      reason: rejected[rejected.length - 1]?.detail ?? "guard_rejected",
    };
  }
  if (loopGuard === "accepted") return { verdict: "accepted", reason: null };
  if (loopGuard && (trace.readLoop?.rejectedAnswer || trace.readLoop?.outcome === "answered")) {
    return { verdict: "rejected", reason: loopGuard };
  }
  return { verdict: "not_run", reason: null };
}

/** Collapse a trace into the badge-level facts the summary header shows. */
export function summarizeTrace(trace: EdwardTurnTrace): TraceSummary {
  const toolCalls = trace.toolCalls ?? [];
  const modelCalls = trace.modelCalls ?? [];
  const failureCodes = trace.failureCodes ?? [];
  const guardRejections = modelCalls.filter((call) => call.outcome === "guard_rejected");
  const path = trace.path ?? "pipeline";
  const guard = guardVerdict(trace);

  let status: TraceStatus;
  if (trace.error) status = "error";
  else if (GATE_PATHS.has(path)) status = "safety_gate";
  else if (path === "idempotent_replay") status = "replay";
  else if (ACTION_PATHS.has(path)) status = "action";
  else if (trace.responseSource === "model_loop") status = "loop";
  else if (trace.responseSource === "model_prose") status = "grounded";
  else if (guardRejections.length > 0 || failureCodes.length > 0) status = "fallback";
  else status = "deterministic";

  const statusLabel = {
    grounded: "Grounded ✓",
    loop: "Model loop ✓",
    deterministic: "Deterministic",
    fallback: "Fallback",
    safety_gate: "Safety gate",
    action: pathLabel(path),
    replay: "Replay",
    error: "Error",
  }[status];

  const totals = modelCalls
    .map((call) => call.usage?.totalTokens ?? 0)
    .reduce((sum, value) => sum + value, 0);

  return {
    status,
    statusLabel,
    requestType: trace.classification?.requestType ?? null,
    durationMs: trace.durationMs ?? null,
    toolCount: toolCalls.length,
    dependencyToolCount: toolCalls.filter((call) => call.round === "dependency").length,
    loopRounds: trace.readLoop?.rounds ?? 0,
    modelCallCount: modelCalls.length,
    totalTokens: totals > 0 ? totals : (trace.usage?.totalTokens ?? null),
    failureCodes,
    guardRejections,
    guard,
  };
}

/** Which open gate pulled a dependency-round tool in, if any. */
export function dependencyTriggerFor(trace: EdwardTurnTrace, tool: string): string | null {
  const triggers = trace.secondRead?.triggeredBy ?? [];
  return triggers.find((entry) => entry.tool === tool)?.gate ?? null;
}

/**
 * Evidence lines carry deterministic prefixes from the composer; classify
 * them for subtle visual weighting without inventing semantics.
 */
export function evidenceTone(line: string): "warn" | "done" | "neutral" {
  if (/^(Blocker:|Registration gate \(open\)|Housing gate \(open\))/.test(line)) return "warn";
  if (/^Completed checklist step:/.test(line) || /: accepted\b/i.test(line)) return "done";
  if (/^Open checklist step:|^Deadline:/.test(line)) return "warn";
  return "neutral";
}

/* --- glossary -------------------------------------------------------------- */

/**
 * What each concept the Lab names actually is, for the ⓘ buttons. Written
 * from the pipeline code and docs/edward-run2-implementation-report.md; keep
 * it factual — this is documentation of behaviour, not marketing.
 */
export const GLOSSARY: Readonly<Record<string, { title: string; body: string }>> =
  Object.freeze({
    path: {
      title: "Route (trace.path)",
      body:
        "Which branch the hosting service took before or instead of the read pipeline. " +
        "\"Read pipeline\" means the question reached the classifier/planner. Every " +
        "action_* value is a deterministic branch of the write plane; the safety gate and " +
        "injection prefilter refuse before any model or tool runs.",
    },
    read_planner: {
      title: "Read planner",
      body:
        "Who decides which records to read. deterministic: regex classifier + static tool " +
        "table, model planner only as a fallback. hybrid: the classifier keeps " +
        "confident, well-covered intents; everything it cannot place, every safe-fallback " +
        "turn and every multi-domain staff question goes to the model read loop. model: " +
        "every readable question goes through the loop. V3 defaults to model planning with four rounds; its legacy deterministic read mode is unavailable. Set per request with the " +
        "x-edward-read-planner header where Lab controls are on.",
    },
    read_loop: {
      title: "Model read loop",
      body:
        "Up to N rounds (default 3, then a forced answer round) in which the model sees the " +
        "question, the tool catalogue and the results so far, and returns either reads to " +
        "perform or a written answer. Tool arguments are validated server-side; identity is " +
        "bound by the host, never by the model. The answer is checked by the same claim guard " +
        "as a deterministic-route rewrite; a rejected answer falls back to the deterministic " +
        "route with the reason recorded.",
    },
    coverage_gate: {
      title: "Coverage gate",
      body:
        "After a confident classification, checks whether the question asks about domains " +
        "the selected reads will not answer (\"transcript status and what I owe\"). Gaps are " +
        "closed deterministically by adding reads (augmented) or, in planner mode, by asking " +
        "the model planner. Records askDomains, uncoveredDomains and supplements.",
    },
    classifier: {
      title: "Regex classifier",
      body:
        "Deterministic intent classification with a confidence and a source. A confident " +
        "match selects reads from a static tool table. No match yields either the model " +
        "planner (deterministic planner), the read loop (hybrid/model), or the broad " +
        "safe_fallback checklist read.",
    },
    model_planner: {
      title: "Model planner",
      body:
        "A single model call that proposes an intent and a list of reads when the classifier " +
        "has none. Its plan is validated against the catalogue before use; an invalid plan is " +
        "discarded and recorded.",
    },
    dependency_round: {
      title: "Dependency reads",
      body:
        "Exactly one deterministic extra round: when deriving state exposes an open gate " +
        "whose owning domain was not read (a housing gate that depends on the deposit), the " +
        "verifying read is fetched so the answer can explain the gate rather than name it.",
    },
    claim_guard: {
      title: "Claim guard",
      body:
        "Deterministic checks over model-written prose against the evidence corpus: no " +
        "invented dates, numbers or contacts; no claimed writes; no leaked identifiers; no " +
        "invented causation or holds; no contradicted document/processing state; " +
        "unavailability acknowledged. Rejected prose uses the configured fallback; v3 university reads fail closed when evidence does not verify the answer.",
    },
    evidence: {
      title: "Evidence corpus",
      body:
        "The deterministic sentences the composer derived from tool results (plus today's " +
        "date). They are what the model is given to write from and what the claim guard " +
        "checks the prose against. On loop turns they are the flattened tool results.",
    },
    response_source: {
      title: "Response source",
      body:
        "Who wrote the final text. model_prose: the composer rewrote a deterministic draft and " +
        "the guard accepted it. model_loop: the read loop's answer, guard-accepted. " +
        "deterministic: the composer's own draft (no model, model failed, or guard rejected).",
    },
    recognizer: {
      title: "Write recognition",
      body:
        "Runs before the read plane on every turn. Tier 0 regex patterns, then a continuation " +
        "check against actions already on the table in this conversation, then tier 1 — a " +
        "bounded model call over a closed enum of actions (pinned to a cheap model). " +
        "Recognizing an action routes the turn to the Action Gateway instead of the classifier.",
    },
    action_gateway: {
      title: "Action Gateway",
      body:
        "Deterministic write plane: resolves the target, authorizes the actor, previews the " +
        "change as an intent card, waits for confirmation, executes, and issues a receipt. " +
        "Never a model decision. A compound turn (question + change) runs the question " +
        "through the read pipeline separately.",
    },
    boundary: {
      title: "Boundary & capability answers",
      body:
        "Canned deterministic answers for requests Edward understands but cannot do (\"upload " +
        "my transcript for me\") and for questions about what Edward can do. Composed before " +
        "any model or tool runs.",
    },
    safety_gate: {
      title: "Safety gates",
      body:
        "guarded_response and the injection prefilter: refusals for unsafe or untrusted-framing " +
        "messages, and the idempotent replay of an exchange already stored for the same " +
        "clientMessageId. All settle before any model call.",
    },
    identity: {
      title: "Staff identity",
      body:
        "The signed-in staff member's profile as the pipeline saw it: role, component, whether " +
        "they manage others, advisee count. Identity arguments to tools (staffId) are bound " +
        "from this, never supplied by a model.",
    },
    entities: {
      title: "Entity & referent resolution",
      body:
        "Every name in a staff message is resolved against the roster and directory: " +
        "capitalised names, speculative lower-case pairs (kept only on exact hits), pasted " +
        "student IDs, inline qualifiers among namesakes, staff-vs-student tie-breaks by the " +
        "question's domain, and pronouns re-scoped to the conversation's active student. An " +
        "ambiguity ends the turn with a disambiguation question.",
    },
    history: {
      title: "Conversation history",
      body:
        "server: prior turns loaded from the durable conversation store. client_fallback: the " +
        "request body supplied history (first conversation-less turn only). none: no prior " +
        "context. A follow-up answered with no reads is reasoning from these messages alone.",
    },
    tool_round: {
      title: "Tool rounds",
      body:
        "initial: the reads the plan selected. dependency: the bounded verifying round. " +
        "entities / referent: staff-side roster and directory lookups made to resolve who the " +
        "question is about. loop round N: reads the model asked for in that round of the read loop.",
    },
    execution_mode: {
      title: "Execution mode",
      body:
        "default is production. deterministic (Lab only, X-Edward-Mode header) removes every " +
        "model hook — planner, composer, read loop and recognizer — so the turn makes zero " +
        "provider calls. Useful as a control, not as a product path.",
    },
    failure_codes: {
      title: "Failure codes",
      body:
        "Deterministic markers appended as the turn degrades: classification_fallback, " +
        "written_answer_rejected:<reason>, read_loop_fallback:<reason>, untrusted_<reason>, " +
        "policy denial codes. Empty means nothing degraded.",
    },
    tokens: {
      title: "Tokens",
      body:
        "Prompt and completion tokens as the provider reported them per model call, summed " +
        "for the turn. The read loop's prompt grows every round because it carries the " +
        "results so far.",
    },
  });

/* --- route (the hot path through the architecture) ------------------------- */

export type RouteNodeId =
  | "message"
  | "gates"
  | "recognizer"
  | "action_gateway"
  | "boundary"
  | "identity"
  | "entities"
  | "classifier"
  | "model_planner"
  | "read_loop"
  | "tool_reads"
  | "compose"
  | "rewrite"
  | "guard"
  | "presentation"
  | "answer";

export interface RouteNodeDefinition {
  id: RouteNodeId;
  title: string;
  /** One sentence: what this component does. */
  summary: string;
  /** Glossary key for the ⓘ button. */
  glossary: keyof typeof GLOSSARY;
  /** Which assistants have this component. */
  kinds: ReadonlyArray<"student" | "staff">;
  /** Whether the component is deterministic or a model call. */
  nature: "deterministic" | "model" | "mixed";
}

/** The static component map, in execution order, both planes. */
export const ROUTE_NODES: ReadonlyArray<RouteNodeDefinition> = Object.freeze([
  {
    id: "message",
    title: "Message + conversation",
    summary: "The question as received, with recorded page context and history source.",
    glossary: "history",
    kinds: ["student", "staff"],
    nature: "deterministic",
  },
  {
    id: "gates",
    title: "Safety gates · injection prefilter · replay",
    summary: "Refusals and replays that settle before any model call.",
    glossary: "safety_gate",
    kinds: ["student", "staff"],
    nature: "deterministic",
  },
  {
    id: "recognizer",
    title: "Write recognition",
    summary: "Tier 0 patterns → continuation → tier 1 model enum.",
    glossary: "recognizer",
    kinds: ["student", "staff"],
    nature: "mixed",
  },
  {
    id: "action_gateway",
    title: "Action Gateway",
    summary: "Resolve · authorize · preview · confirm · execute · receipt.",
    glossary: "action_gateway",
    kinds: ["student", "staff"],
    nature: "deterministic",
  },
  {
    id: "boundary",
    title: "Boundary & capability answers",
    summary: "Understood but out of reach, or \"what can you do?\".",
    glossary: "boundary",
    kinds: ["student", "staff"],
    nature: "deterministic",
  },
  {
    id: "identity",
    title: "Staff identity",
    summary: "Who is signed in: role, component, caseload.",
    glossary: "identity",
    kinds: ["staff"],
    nature: "deterministic",
  },
  {
    id: "entities",
    title: "Entity & referent resolution",
    summary: "Which student or staff member the question is about.",
    glossary: "entities",
    kinds: ["staff"],
    nature: "deterministic",
  },
  {
    id: "classifier",
    title: "Intent classification + coverage",
    summary: "Recorded classification and coverage checks; model mode can use the read loop even when an intent matched.",
    glossary: "classifier",
    kinds: ["student", "staff"],
    nature: "deterministic",
  },
  {
    id: "model_planner",
    title: "Model planner",
    summary: "Fallback plan when the classifier has none.",
    glossary: "model_planner",
    kinds: ["student", "staff"],
    nature: "model",
  },
  {
    id: "read_loop",
    title: "Model read loop",
    summary: "Bounded model rounds, with tool reads and a guarded answer.",
    glossary: "read_loop",
    kinds: ["student", "staff"],
    nature: "model",
  },
  {
    id: "tool_reads",
    title: "Static tool table + dependency round",
    summary: "Canonical repository reads and shared FinancialPlanService / WorkBoardProjection; then a verifying round for open gates.",
    glossary: "dependency_round",
    kinds: ["student", "staff"],
    nature: "deterministic",
  },
  {
    id: "compose",
    title: "Derive state + deterministic compose",
    summary: "Evidence sentences and a draft answer from the reads.",
    glossary: "evidence",
    kinds: ["student", "staff"],
    nature: "deterministic",
  },
  {
    id: "rewrite",
    title: "Prose composer · model_prose",
    summary: "Model rewrites the draft over the evidence.",
    glossary: "response_source",
    kinds: ["student", "staff"],
    nature: "model",
  },
  {
    id: "guard",
    title: "Claim guard",
    summary: "Accept grounded prose; university failures return an inability to verify.",
    glossary: "claim_guard",
    kinds: ["student", "staff"],
    nature: "deterministic",
  },
  {
    id: "presentation",
    title: "Response projection",
    summary: "Construct response blocks from the answer and recorded evidence.",
    glossary: "response_source",
    kinds: ["student", "staff"],
    nature: "deterministic",
  },
  {
    id: "answer",
    title: "Answer · receipts · trace",
    summary: "What was sent, and who wrote it.",
    glossary: "response_source",
    kinds: ["student", "staff"],
    nature: "deterministic",
  },
]);

export type RouteNodeState = "hot" | "passed" | "skipped" | "ended";

export interface RouteDetail {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad" | "neutral";
}

export interface RouteNode {
  id: RouteNodeId;
  /** hot: did real work; passed: ran and let the turn through; ended: produced the answer. */
  state: RouteNodeState;
  /** Position in the executed sequence (1-based); null when skipped. */
  order: number | null;
  orders: number[];
  headline: string;
  details: RouteDetail[];
  toolCalls: TraceToolCall[];
  modelCalls: TraceModelCall[];
  /** Longer free text: reasoning notes, rejected answers, messages. */
  notes: Array<{ label: string; text: string }>;
}

export interface TraceRoute {
  nodes: RouteNode[];
  /** Executed node ids in order. */
  sequence: RouteNodeId[];
}

function nodeFor(id: RouteNodeId, state: RouteNodeState, headline: string): RouteNode {
  return { id, state, order: null, orders: [], headline, details: [], toolCalls: [], modelCalls: [], notes: [] };
}

function stageMap(trace: EdwardTurnTrace): Map<string, TraceStage> {
  const map = new Map<string, TraceStage>();
  for (const stage of trace.stages ?? []) map.set(stage.stage, stage);
  return map;
}

function classificationDetails(trace: EdwardTurnTrace): RouteDetail[] {
  const classification = trace.classification;
  if (!classification) return [{ label: "Classification", value: "none (nothing matched)" }];
  const out: RouteDetail[] = [
    { label: "Intent", value: classification.requestType ?? "—" },
    {
      label: "Confidence",
      value: classification.confidence !== undefined ? String(classification.confidence) : "—",
    },
    { label: "Source", value: classification.source ?? "—" },
  ];
  if (classification.additionalRequestTypes?.length) {
    out.push({ label: "Also asked", value: classification.additionalRequestTypes.join(", ") });
  }
  if (classification.reference) out.push({ label: "Reference", value: classification.reference });
  return out;
}

/**
 * Derive the route one turn took through the component map, from what the
 * trace positively records. Nothing here is inferred from the answer text.
 */
export function routeFor(trace: EdwardTurnTrace): TraceRoute {
  const staff = trace.assistantKind === "staff";
  const path = trace.path ?? "unknown";
  const stages = stageMap(trace);
  const toolCalls = trace.toolCalls ?? [];
  const modelCalls = trace.modelCalls ?? [];
  const byId = new Map<RouteNodeId, RouteNode>();
  for (const definition of ROUTE_NODES) {
    if (!definition.kinds.includes(staff ? "staff" : "student")) continue;
    byId.set(definition.id, nodeFor(definition.id, "skipped", "Not on this turn's route."));
  }
  const sequence: RouteNodeId[] = [];
  const visit = (id: RouteNodeId, state: RouteNodeState, headline: string): RouteNode => {
    const node = byId.get(id) ?? nodeFor(id, state, headline);
    node.state = state;
    node.headline = headline;
    node.order = sequence.length + 1;
    sequence.push(id);
    byId.set(id, node);
    return node;
  };
  // A component that was on the route but did no work: keep it out of the
  // executed sequence, but say why it did nothing.
  const skip = (id: RouteNodeId, headline: string): void => {
    const node = byId.get(id);
    if (node) node.headline = headline;
  };

  // 1. Message.
  const message = visit("message", "hot", trace.userMessage || "(empty message)");
  message.details.push(
    { label: "Input", value: trace.inputMode ?? "text" },
    {
      label: "History",
      value: `${trace.historySource ?? "none"} · ${trace.historyMessages ?? 0} prior message${
        (trace.historyMessages ?? 0) === 1 ? "" : "s"
      }`,
    },
  );
  if (trace.pagePath) {
    message.details.push({
      label: "Page",
      value: `${trace.pagePath}${trace.pageLabel ? ` (${trace.pageLabel})` : ""}`,
    });
  }
  for (const entry of trace.historyPreview ?? []) {
    message.notes.push({ label: `history · ${entry.role}`, text: entry.content });
  }
  const normalize = stages.get("normalize");
  if (normalize) {
    for (const [key, value] of stageDetails(normalize)) message.details.push({ label: key, value });
  }

  // 2. Gates.
  if (path === "idempotent_replay") {
    const gates = visit("gates", "ended", "Replayed the stored exchange for this clientMessageId.");
    gates.details.push({ label: "Route", value: pathLabel(path) });
  } else if (GATE_PATHS.has(path)) {
    const gates = visit(
      "gates",
      "ended",
      path === "pre_pipeline_safety_gate"
        ? "Refused by the safety gate before any model or tool ran."
        : "Refused by the injection prefilter (untrusted framing).",
    );
    gates.details.push({ label: "Route", value: pathLabel(path), tone: "warn" });
    for (const code of trace.failureCodes ?? []) {
      gates.details.push({ label: "Failure code", value: code, tone: "warn" });
    }
  } else if (path !== "unknown") {
    visit("gates", "passed", "No safety refusal or replay recorded on this route.");
  }

  // 3. Recognition: highlight only a recorded source, action, or model call.
  if (path !== "unknown" && path !== "idempotent_replay" && !GATE_PATHS.has(path)) {
    const recognizerCalls = modelCalls.filter((call) => call.operation === "action_recognizer");
    const source = trace.actionRecognitionSource ?? null;
    const recognized = Boolean(trace.actionRequested);
    if (source || recognized || recognizerCalls.length > 0) {
      const recognizer = visit(
        "recognizer",
        recognized || recognizerCalls.length > 0 ? "hot" : "passed",
        recognized
          ? `Recognized ${trace.actionRequested} (${recognitionSourceLabel(source)}).`
          : recognizerCalls.length > 0
            ? "Tier 1 model consulted; no action recognized."
            : "No recognized action or recognition model call recorded.",
      );
      recognizer.details.push({ label: "Recognition", value: source ? recognitionSourceLabel(source) : "not recorded" });
      if (trace.actionRequested) {
        recognizer.details.push({ label: "Action", value: trace.actionRequested });
      }
      recognizer.modelCalls.push(...recognizerCalls);
    } else {
      skip("recognizer", "No action recognition was recorded for this turn.");
    }
  }

  // 4. Write plane vs boundary vs read plane.
  if (ACTION_PATHS.has(path)) {
    if (path === "action_boundary" || path === "action_capability_answer") {
      const boundary = visit("boundary", "ended", pathLabel(path));
      boundary.details.push({ label: "Route", value: pathLabel(path) });
    } else {
      const gateway = visit("action_gateway", "ended", pathLabel(path));
      gateway.details.push({ label: "Route", value: pathLabel(path) });
      if (trace.actionReceipt) gateway.notes.push({ label: "Recorded action receipt", text: JSON.stringify(trace.actionReceipt, null, 2) });
      if (trace.actionAuthorizationCapability) gateway.details.push({ label: "Authorization capability", value: trace.actionAuthorizationCapability });
      if (trace.actionProposed) gateway.details.push({ label: "Proposed", value: trace.actionProposed });
      if (trace.actionPolicyResult) {
        gateway.details.push({
          label: "Policy",
          value: trace.actionPolicyResult,
          tone: trace.actionPolicyResult === "denied" ? "bad" : "ok",
        });
      }
      if (trace.actionDenialReason) {
        gateway.details.push({ label: "Denial", value: trace.actionDenialReason, tone: "bad" });
      }
      if (trace.actionIntentId) gateway.details.push({ label: "Intent", value: trace.actionIntentId });
      if (trace.actionConfirmationMode) {
        gateway.details.push({ label: "Confirmation", value: trace.actionConfirmationMode });
      }
      if (trace.actionBlastRadius != null) {
        gateway.details.push({ label: "Blast radius", value: String(trace.actionBlastRadius) });
      }
      if (trace.actionExecutionResult) {
        gateway.details.push({ label: "Execution", value: trace.actionExecutionResult });
      }
    }
  } else if (path === "pipeline") {
    // A staff turn the entity resolver settled (disambiguation question, "no
    // such student", search results) never reaches classify_and_plan or any
    // read stage, even though the classifier was consulted along the way.
    const entityShortCircuit =
      staff &&
      (stages.has("resolve_entities") || Boolean(trace.entities)) &&
      !stages.has("classify_and_plan") &&
      !stages.has("read_loop") &&
      !stages.has("execute_tool_reads") &&
      trace.responseSource === "deterministic" &&
      Boolean(trace.finalMessage);
    // Staff: identity + entities.
    if (staff) {
      const identityStage = stages.get("load_identity");
      const identity = trace.identity ?? null;
      if (identityStage || identity) {
        const node = visit(
          "identity",
          "hot",
          identity
            ? `${identity.name ?? "staff member"} · ${identity.roleCode ?? "staff"} · ${
                identity.component ?? ""
              }`.trim()
            : "Identity stage ran; no profile recorded.",
        );
        node.toolCalls.push(...toolCalls.filter(call => call.round === "identity"));
        if (identity) {
          node.details.push(
            { label: "Role", value: identity.roleCode ?? "—" },
            { label: "Component", value: identity.component ?? "—" },
            { label: "Advisees", value: String(identity.primaryAdvisees ?? 0) },
            { label: "Direct reports", value: String(identity.directReports ?? 0) },
          );
          if (identity.employmentStatus) {
            node.details.push({ label: "Employment", value: identity.employmentStatus });
          }
        }
      }
      const entityStage = stages.get("resolve_entities");
      const entities = trace.entities ?? null;
      if (entityStage || entities) {
        const entityCalls = toolCalls.filter(
          (call) => call.round === "entities" || call.round === "referent",
        );
        const resolved = [
          ...(entities?.students ?? []).map((e) => `student ${e.name}`),
          ...(entities?.staff ?? []).map((e) => `staff ${e.name}`),
          ...(entities?.departments ?? []).map((e) => `department ${e.name}`),
        ];
        const ambiguities = entities?.ambiguities ?? [];
        const mentions = entities?.mentions ?? [];
        const headline =
          ambiguities.length > 0
            ? `Ambiguous: ${ambiguities
                .map((a) => `"${a.mention}" (${a.reason.replaceAll("_", " ")})`)
                .join("; ")}`
            : resolved.length > 0
              ? `Resolved ${resolved.join(", ")}.`
              : mentions.length > 0
                ? `Mentions found (${mentions.map((m) => m.text).join(", ")}) but none resolved.`
                : "No names in the message; scope from identity/conversation.";
        const node = visit(
          "entities",
          entityShortCircuit ? "ended" : "hot",
          entityShortCircuit
            ? `${headline} The turn ended here with a deterministic answer.`
            : headline,
        );
        node.details.push({
          label: "Mentions",
          value: mentions.length
            ? mentions
                .map((m) => `${m.text}${m.kindHint ? ` (${m.kindHint})` : ""}`)
                .join(", ")
            : "none",
        });
        for (const entity of entities?.students ?? []) {
          node.details.push({
            label: "Student",
            value: `${entity.name}${entity.matchQuality ? ` · ${entity.matchQuality}` : ""}`,
            tone: "ok",
          });
        }
        for (const entity of entities?.staff ?? []) {
          node.details.push({
            label: "Staff",
            value: `${entity.name}${entity.matchQuality ? ` · ${entity.matchQuality}` : ""}`,
            tone: "ok",
          });
        }
        for (const ambiguity of ambiguities) {
          const candidates = [
            ...((ambiguity.students ?? []) as unknown[]),
            ...((ambiguity.staff ?? []) as unknown[]),
          ];
          node.details.push({
            label: `Ambiguity · ${ambiguity.mention}`,
            value: `${ambiguity.reason.replaceAll("_", " ")} — ${candidates.length} candidate${
              candidates.length === 1 ? "" : "s"
            }${ambiguity.fuzzy ? " (fuzzy)" : ""}`,
            tone: "warn",
          });
        }
        if (entities?.selfReference) node.details.push({ label: "Self-reference", value: "yes" });
        node.toolCalls.push(...entityCalls);
        if (entityShortCircuit && trace.finalMessage) {
          node.notes.push({ label: "answer", text: trace.finalMessage });
        }
      }
    }

    const loopRan = Boolean(trace.readLoop) || stages.has("read_loop");
    const deterministicRouteRan =
      stages.has("execute_tool_reads") || stages.has("compose_deterministic");
    const plannerCalls = modelCalls.filter((call) => modelOperationIs(call, "assistant_planner"));

    // Classifier + coverage gate.
    const classifyStage = stages.get("classify_and_plan");
    const coverage = stages.get("coverage_gate");
    const classification = trace.classification;
    if (entityShortCircuit) {
      skip(
        "classifier",
        classification
          ? `Consulted (${classification.requestType ?? "?"}) but not used: the entity ` +
            "resolver answered the turn."
          : "Not reached: the entity resolver answered the turn.",
      );
    } else if (classifyStage || coverage || (classification && classification.source !== "model_loop" && classification.source !== "model_plan")) {
      const source = classification?.source ?? null;
      const headline =
        classification && source !== "model_loop"
          ? `${classification.requestType ?? "?"} (${source ?? "?"}, ${
              classification.confidence ?? "?"
            })${coverage?.action ? ` · coverage: ${String(coverage.action)}` : ""}`
          : source === "model_loop"
            ? "Intent assigned from loop reads; no pre-loop classification recorded."
            : "No classification recorded.";
      const node = visit("classifier", "hot", headline);
      node.details.push(...classificationDetails(trace));
      if (coverage) {
        for (const [key, value] of stageDetails(coverage)) {
          node.details.push({ label: `coverage · ${key}`, value });
        }
      }
      if (trace.toolSelectionSource) {
        node.details.push({ label: "Tool selection", value: trace.toolSelectionSource });
      }
      if ((trace.selectedTools ?? []).length > 0 && trace.toolSelectionSource !== "model_loop") {
        node.details.push({ label: "Selected reads", value: (trace.selectedTools ?? []).join(", ") });
      }
    }

    // Read loop.
    if (loopRan) {
      const loop = trace.readLoop;
      const guard = loop?.guard ?? "not recorded";
      const accepted = guard === "accepted";
      const guardRan = accepted || Boolean(loop?.rejectedAnswer) || loop?.outcome === "answered";
      const loopCalls = toolCalls.filter((call) => call.round.startsWith("loop-"));
      const loopModelCalls = modelCalls.filter((call) => modelOperationIs(call, "assistant_read_loop"));
      const node = visit(
        "read_loop",
        "hot",
        `${loop?.rounds ?? "?"} round${loop?.rounds === 1 ? "" : "s"} · ${loopCalls.length} read${
          loopCalls.length === 1 ? "" : "s"
        } · ${loop?.outcome ?? "?"} · ${!guardRan ? "no answer to check" : `guard ${accepted ? "accepted" : `rejected (${guard})`}`}${
          accepted ? "" : deterministicRouteRan ? " → classified read route" : " → recorded fallback response"
        }`,
      );
      node.details.push(
        { label: "Planner", value: trace.readPlanner ?? "not recorded" },
        { label: "Rounds", value: String(loop?.rounds ?? "?") },
        { label: "Outcome", value: loop?.outcome ?? "?" },
        {
          label: "Guard",
          value: !guardRan ? "Not run: no answer produced" : accepted ? "accepted" : `${guard} — ${guardReasonLabel(guard)}`,
          tone: accepted ? "ok" : "bad",
        },
      );
      const rejected = loopCalls.filter((call) => call.status === "rejected");
      if (rejected.length > 0) {
        node.details.push({
          label: "Rejected calls",
          value: `${rejected.length}; inspect each recorded reason and subsequent round`,
          tone: "warn",
        });
      }
      node.toolCalls.push(...loopCalls);
      node.modelCalls.push(...loopModelCalls);
      const steps = loop?.steps ?? [];
      if (steps.length > 0) {
        for (const step of steps) {
          const reads = step.reads.map((r) => `${r.tool}${r.status === "rejected" ? " ✗" : ""}`);
          node.notes.push({
            label: `round ${step.round} · ${step.outcome}${step.forced ? " (forced)" : ""}${
              reads.length ? ` · ${reads.join(", ")}` : ""
            }${step.discardedAnswer ? " · proposed answer discarded" : ""}`,
            text: step.reasoning ?? "(no reasoning note)",
          });
        }
      } else {
        (loop?.reasoning ?? []).forEach((note, index) =>
          node.notes.push({ label: `planner note ${index + 1}`, text: note }),
        );
      }
      if (loop?.rejectedAnswer) {
        node.notes.push({
          label: `rejected answer · ungrounded: ${(loop.ungrounded ?? []).join(", ") || "—"}`,
          text: loop.rejectedAnswer,
        });
      }
    }

    if (plannerCalls.length > 0) {
      const accepted = plannerCalls.some((call) => call.outcome === "accepted");
      const node = visit(
        "model_planner",
        "hot",
        accepted ? "Planner proposed the reads." : `Planner ${plannerCalls[0]?.outcome ?? "ran"}.`,
      );
      node.modelCalls.push(...plannerCalls);
    }

    // Deterministic route.
    if (deterministicRouteRan) {
      const initial = toolCalls.filter(
        (call) => call.round === "initial" || call.round === "dependency",
      );
      const dependency = initial.filter((call) => call.round === "dependency");
      const unavailable = initial.filter((call) => call.status !== "available");
      const reads = visit(
        "tool_reads",
        "hot",
        `${initial.length - dependency.length} initial read${initial.length - dependency.length === 1 ? "" : "s"}${
          dependency.length ? ` (+${dependency.length} dependency)` : ""
        }${unavailable.length ? ` · ${unavailable.length} unavailable` : ""}`,
      );
      reads.toolCalls.push(...initial);
      for (const trigger of trace.secondRead?.triggeredBy ?? []) {
        reads.details.push({ label: "Dependency trigger", value: `${trigger.gate} → ${trigger.tool}` });
      }
      const composeStage = stages.get("compose_deterministic");
      if (composeStage) {
        const compose = visit(
          "compose",
          "hot",
          `${(trace.evidence ?? []).length} evidence line${
            (trace.evidence ?? []).length === 1 ? "" : "s"
          } · draft answer`,
        );
        for (const [key, value] of stageDetails(composeStage)) compose.details.push({ label: key, value });
      }
      const composerCalls = modelCalls.filter((call) => modelOperationIs(call, "assistant_composer"));
      if (composerCalls.length > 0) {
        const acceptedCall = composerCalls.find((call) => call.outcome === "accepted");
        const rewrite = visit(
          "rewrite",
          "hot",
          acceptedCall
            ? `Accepted on attempt ${acceptedCall.attempt}.`
            : `${composerCalls.length} attempt${composerCalls.length === 1 ? "" : "s"}, none accepted.`,
        );
        rewrite.modelCalls.push(...composerCalls);
      } else if (stages.has("model_rewrite")) {
        skip(
          "rewrite",
          trace.executionMode === "deterministic"
            ? "Skipped: deterministic execution mode (no model hooks)."
            : "Skipped: no composer call recorded.",
        );
      }
    }

    // Guard.
    const verdict = guardVerdict(trace);
    if (verdict.verdict !== "not_run") {
      const guard = visit(
        "guard",
        "hot",
        verdict.verdict === "accepted"
          ? "Accepted the model's prose."
          : `Rejected (${verdict.reason}) → ${stages.has("compose_deterministic") ? "deterministic draft available" : "recorded fallback response"}.`,
      );
      guard.details.push({
        label: "Verdict",
        value: verdict.verdict,
        tone: verdict.verdict === "accepted" ? "ok" : "bad",
      });
      if (verdict.reason) {
        guard.details.push({ label: "Reason", value: guardReasonLabel(verdict.reason), tone: "bad" });
      }
      const rejections = modelCalls.filter((call) => call.outcome === "guard_rejected");
      for (const call of rejections) {
        guard.details.push({
          label: `${modelCallLabel(call.operation)} · attempt ${call.attempt}`,
          value: `${call.detail ?? "guard_rejected"} — ${guardReasonLabel(call.detail)}`,
          tone: "bad",
        });
      }
    } else if (deterministicRouteRan || loopRan) {
      skip("guard", "Not run: no model prose was written this turn.");
    }
  }

  const presentation = stages.get("presentation");
  if (presentation) {
    const node = visit("presentation", "hot", String(presentation.construction ?? "Response blocks constructed"));
    for (const [label, value] of stageDetails(presentation)) node.details.push({ label, value });
    node.details.push({ label: "Blocks", value: (trace.responseBlocks ?? []).map(block => block.type).join(", ") || "not recorded" });
  }

  // Answer.
  const summary = summarizeTrace(trace);
  const answer = visit("answer", "ended", trace.finalMessage || trace.error || "(no final message)");
  answer.details.push(
    { label: "Response source", value: responseSourceLabel(trace.responseSource) },
    { label: "Status", value: summary.statusLabel },
    { label: "Route", value: pathLabel(path) },
  );
  if (trace.provider || trace.model) {
    answer.details.push({ label: "Model", value: `${trace.provider ?? "—"} · ${trace.model ?? "—"}` });
  }
  answer.details.push(
    { label: "Model calls", value: String(summary.modelCallCount) },
    { label: "Tokens", value: formatTokens(summary.totalTokens) },
    { label: "Server time", value: formatMs(trace.durationMs) },
  );
  for (const code of trace.failureCodes ?? []) {
    answer.details.push({ label: "Failure code", value: code, tone: "warn" });
  }
  if (trace.error) answer.details.push({ label: "Error", value: trace.error, tone: "bad" });

  // The loop checks its answer before falling back. A later composer checks
  // its own output again: retain both visits to the shared guard in the path.
  const loopChecked = trace.readLoop && (trace.readLoop.guard === "accepted" ||
    trace.readLoop.rejectedAnswer || trace.readLoop.outcome === "answered");
  if (loopChecked) {
    const loopIndex = sequence.indexOf("read_loop");
    const guardIndex = sequence.indexOf("guard");
    if (loopIndex >= 0 && guardIndex > loopIndex + 1) {
      if (!modelCalls.some(call => modelOperationIs(call, "assistant_composer") &&
        ["accepted", "guard_rejected"].includes(call.outcome))) sequence.splice(guardIndex, 1);
      sequence.splice(loopIndex + 1, 0, "guard");
    }
    byId.get("guard")?.details.push({
      label: "Read-loop guard", value: trace.readLoop!.guard,
      tone: trace.readLoop!.guard === "accepted" ? "ok" : "bad",
    });
  }
  for (const node of byId.values()) {
    node.orders = sequence.flatMap((id, index) => id === node.id ? [index + 1] : []);
    node.order = node.orders[0] ?? null;
  }

  return {
    nodes: ROUTE_NODES.filter((d) => byId.has(d.id)).map((d) => byId.get(d.id)!),
    sequence,
  };
}

/** Only consecutive recorded components are connected by the hot path. */
export function routeEdges(route: TraceRoute): Array<{ from: RouteNodeId; to: RouteNodeId }> {
  return route.sequence.slice(1).map((to, index) => ({ from: route.sequence[index]!, to }));
}

/* --- normal vs deterministic comparison ---------------------------------- */

/**
 * Lab-only model prices, USD per token. Deliberately a short, explicit table:
 * an unpriced model reports no cost rather than a made-up one, because the
 * point of the comparison is to be honest about what the model costs.
 */
export const LAB_MODEL_PRICING: Readonly<
  Record<string, { input: number; output: number }>
> = Object.freeze({
  "gpt-5.6-luna": { input: 0.2 / 1_000_000, output: 1.2 / 1_000_000 },
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  "gpt-4o-mini-2024-07-18": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  "openai/gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
});

/** Summed cost of every model call on a trace; null when nothing is priceable. */
export function estimateModelCostUsd(trace: EdwardTurnTrace | null): number | null {
  const calls = trace?.modelCalls ?? [];
  let total = 0;
  let priced = 0;
  for (const call of calls) {
    const pricing = call.model ? LAB_MODEL_PRICING[call.model] : undefined;
    if (!pricing || !call.usage) continue;
    priced += 1;
    total +=
      (call.usage.promptTokens ?? 0) * pricing.input +
      (call.usage.completionTokens ?? 0) * pricing.output;
  }
  if (!trace) return null;
  if (calls.length === 0) return 0;
  return priced === calls.length ? total : null;
}

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value === 0) return "$0";
  return `$${value.toFixed(6)}`;
}

/** One side of a comparison: everything the Lab shows for a single run. */
export interface ComparisonSide {
  mode: EdwardExecutionMode;
  requestId: string | null;
  message: string;
  blocks: Array<{ type?: string }>;
  trace: EdwardTurnTrace | null;
  /** Client-observed round trip, which includes network and proxying. */
  latencyMs: number;
  error: string | null;
}

/** The comparable facts for one side, derived only from what was recorded. */
export interface ComparisonFacts {
  mode: EdwardExecutionMode;
  /** True only when the trace positively confirms the requested mode ran. */
  modeConfirmed: boolean;
  requestType: string | null;
  toolSelectionSource: string | null;
  readPlanner: string | null;
  selectedTools: string[];
  executedTools: string[];
  toolCallCount: number;
  dependencyToolCount: number;
  evidenceCount: number;
  blockTypes: string[];
  responseSource: string | null;
  provider: string | null;
  model: string | null;
  modelCallCount: number;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  serverDurationMs: number | null;
  clientLatencyMs: number;
  failureCodes: string[];
  /** Deterministic Edward saying it cannot answer — the useful failure signal. */
  unsupported: boolean;
  unavailableReason: string | null;
  messageCharacters: number;
  error: string | null;
}

const UNSUPPORTED_REQUEST_TYPES = new Set([
  "unsupported_or_out_of_scope",
  "human_handoff",
]);

export function comparisonFacts(side: ComparisonSide): ComparisonFacts {
  const trace = side.trace;
  const toolCalls = trace?.toolCalls ?? [];
  const modelCalls = trace?.modelCalls ?? [];
  const requestType = trace?.classification?.requestType ?? null;
  const tokens = modelCalls.reduce(
    (sum, call) => sum + (call.usage?.totalTokens ?? 0),
    0,
  );
  return {
    mode: side.mode,
    // A trace that never arrived cannot confirm anything; the Lab must not
    // present an unverified run as a zero-LLM run.
    modeConfirmed: trace?.executionMode === side.mode,
    requestType,
    toolSelectionSource: trace?.toolSelectionSource ?? null,
    readPlanner: trace?.readPlanner ?? null,
    selectedTools: trace?.selectedTools ?? [],
    executedTools: toolCalls.map((call) => call.tool),
    toolCallCount: toolCalls.length,
    dependencyToolCount: toolCalls.filter((call) => call.round === "dependency").length,
    evidenceCount: trace?.evidence?.length ?? 0,
    blockTypes: side.blocks.map((block) => String(block?.type ?? "unknown")),
    responseSource: trace?.responseSource ?? null,
    provider: trace?.provider ?? null,
    model: trace?.model ?? null,
    modelCallCount: modelCalls.length,
    totalTokens: !trace || modelCalls.some(call => call.usage?.totalTokens == null) ? null : tokens,
    estimatedCostUsd: estimateModelCostUsd(trace),
    serverDurationMs: trace?.durationMs ?? null,
    clientLatencyMs: Math.round(side.latencyMs),
    failureCodes: trace?.failureCodes ?? [],
    unavailableReason: trace?.failureCodes?.includes("university_planner_required")
      ? side.mode === "deterministic"
        ? "Zero-LLM university answers are not supported by this backend. University record questions require model planning; this run could not perform university record reads."
        : "University model planning was unavailable for this run. No university answer was produced."
      : null,
    unsupported:
      (requestType !== null && UNSUPPORTED_REQUEST_TYPES.has(requestType)) ||
      trace?.path === "pre_pipeline_safety_gate",
    messageCharacters: side.message.length,
    error: side.error,
  };
}

export interface ComparisonDelta {
  /** Identical final message text, ignoring surrounding whitespace. */
  sameMessage: boolean;
  /** Both runs read the same records, in the same order. */
  sameTools: boolean;
  /** Both runs classified the request the same way. */
  sameRequestType: boolean;
  /** Both runs produced the same structured block shape. */
  sameBlockTypes: boolean;
  /** Tools normal Edward read that the deterministic run did not, and vice versa. */
  toolsOnlyInNormal: string[];
  toolsOnlyInDeterministic: string[];
  /** Deterministic minus normal; negative means deterministic was faster. */
  serverDurationDeltaMs: number | null;
  tokensSaved: number | null;
  costSavedUsd: number | null;
  /** Set when the platform did not confirm one of the two requested modes. */
  unverified: EdwardExecutionMode[];
  comparable: boolean;
}

export function comparisonDelta(
  normal: ComparisonFacts,
  deterministic: ComparisonFacts,
  normalMessage: string,
  deterministicMessage: string,
): ComparisonDelta {
  const onlyIn = (a: string[], b: string[]) => a.filter((item) => !b.includes(item));
  const unverified: EdwardExecutionMode[] = [];
  if (!normal.modeConfirmed) unverified.push("default");
  if (!deterministic.modeConfirmed) unverified.push("deterministic");
  const comparable = unverified.length === 0 && !normal.error && !deterministic.error &&
    !normal.unavailableReason && !deterministic.unavailableReason &&
    normal.failureCodes.length === 0 && deterministic.failureCodes.length === 0;
  return {
    comparable,
    sameMessage: normalMessage.trim() === deterministicMessage.trim(),
    sameTools:
      normal.executedTools.join("|") === deterministic.executedTools.join("|"),
    sameRequestType: normal.requestType === deterministic.requestType,
    sameBlockTypes: normal.blockTypes.join("|") === deterministic.blockTypes.join("|"),
    toolsOnlyInNormal: onlyIn(normal.executedTools, deterministic.executedTools),
    toolsOnlyInDeterministic: onlyIn(
      deterministic.executedTools,
      normal.executedTools,
    ),
    serverDurationDeltaMs:
      !comparable || normal.serverDurationMs === null || deterministic.serverDurationMs === null
        ? null
        : deterministic.serverDurationMs - normal.serverDurationMs,
    tokensSaved: !comparable || normal.totalTokens === null || deterministic.totalTokens === null ? null : normal.totalTokens - deterministic.totalTokens,
    costSavedUsd: !comparable || normal.estimatedCostUsd === null || deterministic.estimatedCostUsd === null ? null : normal.estimatedCostUsd - deterministic.estimatedCostUsd,
    unverified,
  };
}

/**
 * The experiment set the Lab offers as one-click questions. Categories mirror
 * the comparison study: the point is to see *where* the model changes the
 * answer, not to score a leaderboard.
 */
export const COMPARISON_EXPERIMENTS: ReadonlyArray<{
  category: string;
  question: string;
  /** Prior turns replayed as client history, for follow-up experiments. */
  history?: ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
}> = Object.freeze([
  { category: "Direct simple", question: "What is my transcript status?" },
  { category: "Direct financial", question: "How much is my deposit?" },
  {
    category: "Cross-domain",
    question: "I paid my deposit. Why can't I apply for housing?",
  },
  { category: "Aggregation", question: "What do I still have to do?" },
  { category: "Ambiguous", question: "Am I good to go?" },
  {
    category: "Multi-intent",
    question: "What's my transcript status and what do I still owe?",
  },
  {
    category: "Follow-up",
    question: "Which of those do I need to do first?",
    history: [
      { role: "user", content: "What do I still have to do?" },
      {
        role: "assistant",
        content:
          "You still have open enrollment steps on your checklist, including your final transcript and your enrollment deposit.",
      },
    ],
  },
  {
    category: "Unsupported",
    question: "What was my roommate's high school GPA?",
  },
]);
