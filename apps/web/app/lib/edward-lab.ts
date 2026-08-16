/**
 * Edward Lab — pure helpers for the developer trace dashboard.
 *
 * Everything here is framework-free so it can be unit-tested with node:test.
 * The Lab never talks to the platform's worker-token-protected trace
 * endpoints directly from the browser: it goes through the same-origin
 * `/api/edward-lab/*` route handlers, which hold the credential server-side.
 */

/**
 * How one Edward turn was allowed to execute. `default` is exactly what
 * production does; `deterministic` removes the model planner and the prose
 * composer for that single turn, so the platform makes zero provider calls.
 * The platform honours the header only where its own Lab controls are on.
 */
export type EdwardExecutionMode = "default" | "deterministic";

export const EDWARD_EXECUTION_MODE_HEADER = "X-Edward-Mode";

/** One executed tool read as recorded in the AssistantTurnTrace. */
export interface TraceToolCall {
  tool: string;
  status: string;
  /** Staff turns add a "referent" round: resolving which student is meant. */
  round: "initial" | "dependency" | "referent";
  durationMs?: number;
  recordCount?: number | null;
  reason?: string | null;
  result?: unknown;
  /** Staff tools take validated arguments; recorded sanitized when present. */
  arguments?: unknown;
  /** Validation outcome for the recorded arguments (staff turns). */
  validation?: string | null;
}

export interface TraceModelCall {
  operation: string;
  attempt: number;
  durationMs: number;
  outcome: string;
  provider?: string;
  model?: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
  detail?: string | null;
}

export interface TraceStage {
  stage: string;
  durationMs: number;
  [key: string]: unknown;
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
  classification?: {
    requestType?: string;
    confidence?: number;
    source?: string;
    additionalRequestTypes?: string[];
    requirementReference?: string | null;
    /** Staff classification: the referenced student/topic, when one exists. */
    reference?: string | null;
  } | null;
  toolSelectionSource?: string | null;
  selectedTools?: string[];
  toolCalls?: TraceToolCall[];
  secondRead?: { triggeredBy?: Array<{ gate: string; tool: string }>; tools?: string[] } | null;
  evidence?: string[];
  modelCalls?: TraceModelCall[];
  modelIterations?: number;
  provider?: string | null;
  model?: string | null;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
  responseSource?: string | null;
  failureCodes?: string[];
  finalMessage?: string;
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
  executedTools?: string[];
  modelIterations?: number;
  responseSource?: string | null;
  failureCodes?: string[];
  durationMs?: number | null;
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

export type TraceStatus =
  | "grounded"
  | "deterministic"
  | "fallback"
  | "safety_gate"
  | "replay"
  | "error";

export interface TraceSummary {
  status: TraceStatus;
  statusLabel: string;
  requestType: string | null;
  durationMs: number | null;
  toolCount: number;
  dependencyToolCount: number;
  modelCallCount: number;
  totalTokens: number | null;
  failureCodes: string[];
  guardRejections: TraceModelCall[];
}

/** Collapse a trace into the badge-level facts the summary header shows. */
export function summarizeTrace(trace: EdwardTurnTrace): TraceSummary {
  const toolCalls = trace.toolCalls ?? [];
  const modelCalls = trace.modelCalls ?? [];
  const failureCodes = trace.failureCodes ?? [];
  const guardRejections = modelCalls.filter((call) => call.outcome === "guard_rejected");

  let status: TraceStatus;
  if (trace.error) status = "error";
  else if (trace.path === "pre_pipeline_safety_gate") status = "safety_gate";
  else if (trace.path === "idempotent_replay") status = "replay";
  else if (trace.responseSource === "model_prose") status = "grounded";
  else if (guardRejections.length > 0 || failureCodes.length > 0) status = "fallback";
  else status = "deterministic";

  const statusLabel = {
    grounded: "Grounded ✓",
    deterministic: "Deterministic",
    fallback: "Fallback",
    safety_gate: "Safety gate",
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
    modelCallCount: modelCalls.length,
    totalTokens: totals > 0 ? totals : (trace.usage?.totalTokens ?? null),
    failureCodes,
    guardRejections,
  };
}

/** Which open gate pulled a dependency-round tool in, if any. */
export function dependencyTriggerFor(trace: EdwardTurnTrace, tool: string): string | null {
  const triggers = trace.secondRead?.triggeredBy ?? [];
  return triggers.find((entry) => entry.tool === tool)?.gate ?? null;
}

/** Deterministic checks the claim guard runs, in order, for the UI legend. */
export const GUARD_CHECKS = [
  "length bounds",
  "write claims",
  "internal identifiers",
  "contacts",
  "dates",
  "numbers",
  "invented causation",
  "document state",
] as const;

const STAGE_LABELS: Record<string, string> = {
  normalize: "Normalize",
  classify_and_plan: "Classify / plan",
  execute_tool_reads: "Tool reads",
  dependency_reads: "Dependency reads",
  derive_student_state: "Derive state",
  compose_deterministic: "Compose (deterministic)",
  model_rewrite: "Model rewrite + guard",
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replaceAll("_", " ");
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

/* --- normal vs deterministic comparison ---------------------------------- */

/**
 * Lab-only model prices, USD per token. Deliberately a short, explicit table:
 * an unpriced model reports no cost rather than a made-up one, because the
 * point of the comparison is to be honest about what the model costs.
 */
export const LAB_MODEL_PRICING: Readonly<
  Record<string, { input: number; output: number }>
> = Object.freeze({
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
  if (calls.length === 0) return 0;
  return priced > 0 ? total : null;
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
    totalTokens: modelCalls.length > 0 ? tokens : 0,
    estimatedCostUsd: estimateModelCostUsd(trace),
    serverDurationMs: trace?.durationMs ?? null,
    clientLatencyMs: Math.round(side.latencyMs),
    failureCodes: trace?.failureCodes ?? [],
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
  return {
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
      normal.serverDurationMs === null || deterministic.serverDurationMs === null
        ? null
        : deterministic.serverDurationMs - normal.serverDurationMs,
    tokensSaved: normal.totalTokens === null ? null : normal.totalTokens,
    costSavedUsd: normal.estimatedCostUsd,
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
