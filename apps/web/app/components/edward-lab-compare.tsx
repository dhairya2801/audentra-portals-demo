"use client";

/**
 * Edward Lab — normal vs forced zero-LLM comparison.
 *
 * One question, the same student state, run twice against the real platform:
 * once exactly as production runs it, once with `X-Edward-Mode: deterministic`,
 * which makes the platform build the pipeline without a model planner and
 * without a prose composer. Both runs are conversation-less, so neither
 * persists an exchange and the second run sees precisely the state the first
 * one did; follow-up experiments replay their prior turns as client history so
 * both sides get identical context.
 *
 * The panel reports only what the two AssistantTurnTraces actually recorded.
 * When a trace does not come back, the run is marked unverified rather than
 * presented as a confirmed zero-LLM turn.
 */

import { useCallback, useState } from "react";
import { askEdward } from "../lib/api-client";
import {
  COMPARISON_EXPERIMENTS,
  type ComparisonFacts,
  type ComparisonSide,
  type EdwardExecutionMode,
  comparisonDelta,
  comparisonFacts,
  fetchTraceWithRetry,
  formatMs,
  formatTokens,
  formatUsd,
} from "../lib/edward-lab";
import styles from "./edward-lab.module.css";

const MODES: readonly EdwardExecutionMode[] = ["default", "deterministic"];
const MODE_LABELS: Record<EdwardExecutionMode, string> = {
  default: "Normal Edward",
  deterministic: "Deterministic (zero-LLM)",
};
// A fixed page context so the only difference between the two runs is the mode.
const PAGE_CONTEXT = { path: "/enrollment", label: "Enrollment" };

type HistoryTurn = { role: "user" | "assistant"; content: string };

interface ComparisonRun {
  question: string;
  history: HistoryTurn[];
  sides: Record<EdwardExecutionMode, ComparisonSide>;
}

async function labFetch(url: string): Promise<Response> {
  return fetch(url, { headers: { accept: "application/json" } });
}

async function runOne(
  mode: EdwardExecutionMode,
  question: string,
  history: HistoryTurn[],
): Promise<ComparisonSide> {
  const started = performance.now();
  try {
    const response = await askEdward(
      {
        message: question,
        inputMode: "text",
        pageContext: PAGE_CONTEXT,
        ...(history.length > 0 ? { history } : {}),
      },
      undefined,
      { executionMode: mode },
    );
    const latencyMs = performance.now() - started;
    const requestId = response.requestId ?? null;
    const trace = requestId ? await fetchTraceWithRetry(requestId, labFetch) : null;
    return {
      mode,
      requestId,
      message: response.message ?? "",
      blocks: (response.blocks ?? []) as Array<{ type?: string }>,
      trace,
      latencyMs,
      error: null,
    };
  } catch (caught) {
    return {
      mode,
      requestId: null,
      message: "",
      blocks: [],
      trace: null,
      latencyMs: performance.now() - started,
      error: caught instanceof Error ? caught.message : String(caught),
    };
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.summaryStat}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function SideColumn({ facts, side }: { facts: ComparisonFacts; side: ComparisonSide }) {
  const zeroLlm = facts.modelCallCount === 0;
  return (
    <section className={`card ${styles.compareColumn}`}>
      <div className={styles.compareColumnHead}>
        <h3>{MODE_LABELS[facts.mode]}</h3>
        <span
          className={`${styles.statusBadge} ${
            facts.error
              ? styles.statusError
              : zeroLlm
                ? styles.statusDeterministic
                : styles.statusGrounded
          }`}
        >
          {facts.error
            ? "Error"
            : `${facts.modelCallCount} model call${facts.modelCallCount === 1 ? "" : "s"}`}
        </span>
      </div>
      {!facts.modeConfirmed ? (
        <p className={styles.compareWarning} role="status">
          Unverified: no trace confirmed this turn ran in {facts.mode} mode. Treat
          its numbers as observations, not proof.
        </p>
      ) : null}
      {facts.unsupported ? (
        <p className={styles.compareWarning} role="status">
          Edward reported this as outside what the record can answer
          {facts.requestType ? ` (${facts.requestType})` : ""}.
        </p>
      ) : null}
      {facts.error ? (
        <p className={styles.compareError} role="alert">
          {facts.error}
        </p>
      ) : (
        <p className={styles.compareMessage}>{side.message}</p>
      )}
      <dl className={styles.summaryGrid}>
        <Metric label="Route" value={facts.requestType ?? "—"} />
        <Metric label="Selection" value={facts.toolSelectionSource ?? "—"} />
        <Metric label="Response source" value={facts.responseSource ?? "—"} />
        <Metric label="Provider" value={facts.provider ?? "—"} />
        <Metric label="Model" value={facts.model ?? "—"} />
        <Metric label="Model calls" value={String(facts.modelCallCount)} />
        <Metric label="Tokens" value={formatTokens(facts.totalTokens)} />
        <Metric label="Est. cost" value={formatUsd(facts.estimatedCostUsd)} />
        <Metric label="Server duration" value={formatMs(facts.serverDurationMs)} />
        <Metric label="Client latency" value={formatMs(facts.clientLatencyMs)} />
        <Metric
          label="Tools"
          value={`${facts.toolCallCount}${
            facts.dependencyToolCount > 0 ? ` (+${facts.dependencyToolCount} dep)` : ""
          }`}
        />
        <Metric label="Evidence facts" value={String(facts.evidenceCount)} />
        <Metric label="Answer length" value={`${facts.messageCharacters} chars`} />
      </dl>
      <div className={styles.compareChips}>
        {facts.executedTools.length === 0 ? (
          <span className={styles.emptyState}>No tool reads recorded.</span>
        ) : (
          facts.executedTools.map((tool, index) => (
            <span key={`${tool}-${index}`} className={styles.toolChip}>
              {tool}
            </span>
          ))
        )}
      </div>
      {facts.blockTypes.length > 0 ? (
        <div className={styles.compareChips}>
          {facts.blockTypes.map((type, index) => (
            <span key={`${type}-${index}`} className={styles.blockChip}>
              {type}
            </span>
          ))}
        </div>
      ) : null}
      {facts.failureCodes.length > 0 ? (
        <div className={styles.compareChips}>
          {facts.failureCodes.map((code) => (
            <span key={code} className={styles.failureChip}>
              {code}
            </span>
          ))}
        </div>
      ) : null}
      {side.requestId ? (
        <p className={styles.compareTraceId}>
          <span className={styles.mono}>{side.requestId}</span>
        </p>
      ) : null}
    </section>
  );
}

export function EdwardLabCompare({ resetKey }: { resetKey: string }) {
  const [question, setQuestion] = useState<string>(COMPARISON_EXPERIMENTS[0].question);
  const [history, setHistory] = useState<HistoryTurn[]>([]);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<ComparisonRun | null>(null);
  const [lastResetKey, setLastResetKey] = useState(resetKey);

  // A persona switch is a different student: drop results rather than let a
  // previous student's answers sit next to a new student's.
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setRun(null);
  }

  const compare = useCallback(async () => {
    const asked = question.trim();
    if (!asked || running) return;
    setRunning(true);
    try {
      const sides = {} as Record<EdwardExecutionMode, ComparisonSide>;
      // Sequential on purpose: two concurrent turns would share the same
      // process and muddy the latency each one reports.
      for (const mode of MODES) {
        sides[mode] = await runOne(mode, asked, history);
      }
      setRun({ question: asked, history, sides });
    } finally {
      setRunning(false);
    }
  }, [history, question, running]);

  const normalFacts = run ? comparisonFacts(run.sides.default) : null;
  const deterministicFacts = run ? comparisonFacts(run.sides.deterministic) : null;
  const delta =
    run && normalFacts && deterministicFacts
      ? comparisonDelta(
          normalFacts,
          deterministicFacts,
          run.sides.default.message,
          run.sides.deterministic.message,
        )
      : null;

  return (
    <div className={styles.compareShell}>
      <section className={`card ${styles.compareControls}`}>
        <div className={styles.sectionHead}>
          <span className="eyebrow">Question</span>
          <span className={styles.turnMeta}>
            Both runs use the same state; neither is persisted.
          </span>
        </div>
        <div className={styles.compareForm}>
          <input
            type="text"
            aria-label="Question to compare"
            value={question}
            disabled={running}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void compare();
            }}
          />
          <button type="button" onClick={() => void compare()} disabled={running}>
            {running ? "Running both…" : "Run both"}
          </button>
        </div>
        {history.length > 0 ? (
          <p className={styles.compareHistoryNote}>
            Replaying {history.length} prior turn{history.length === 1 ? "" : "s"} as
            context for both runs.{" "}
            <button
              type="button"
              className={styles.copyButton}
              onClick={() => setHistory([])}
            >
              Clear
            </button>
          </p>
        ) : null}
        <div className={styles.compareChips}>
          {COMPARISON_EXPERIMENTS.map((experiment) => (
            <button
              key={experiment.question}
              type="button"
              className={styles.experimentChip}
              disabled={running}
              onClick={() => {
                setQuestion(experiment.question);
                setHistory([...(experiment.history ?? [])]);
              }}
            >
              <span className={styles.experimentCategory}>{experiment.category}</span>
              {experiment.question}
            </button>
          ))}
        </div>
      </section>

      {delta && normalFacts && deterministicFacts ? (
        <section className={`card ${styles.compareDelta}`}>
          <div className={styles.sectionHead}>
            <span className="eyebrow">Differences</span>
            <span className={styles.turnMeta}>{run?.question}</span>
          </div>
          {delta.unverified.length > 0 ? (
            <p className={styles.compareWarning} role="status">
              Unverified run{delta.unverified.length === 1 ? "" : "s"}:{" "}
              {delta.unverified.join(", ")}. The platform did not return a trace
              confirming the requested mode.
            </p>
          ) : null}
          <dl className={styles.summaryGrid}>
            <Metric label="Same final message" value={delta.sameMessage ? "yes" : "no"} />
            <Metric label="Same route" value={delta.sameRequestType ? "yes" : "no"} />
            <Metric label="Same tool reads" value={delta.sameTools ? "yes" : "no"} />
            <Metric label="Same blocks" value={delta.sameBlockTypes ? "yes" : "no"} />
            <Metric
              label="Server duration Δ"
              value={
                delta.serverDurationDeltaMs === null
                  ? "—"
                  : `${delta.serverDurationDeltaMs > 0 ? "+" : ""}${formatMs(
                      Math.abs(delta.serverDurationDeltaMs),
                    )}`
              }
            />
            <Metric label="Tokens avoided" value={formatTokens(delta.tokensSaved)} />
            <Metric label="Cost avoided" value={formatUsd(delta.costSavedUsd)} />
          </dl>
          {delta.toolsOnlyInNormal.length > 0 || delta.toolsOnlyInDeterministic.length > 0 ? (
            <p className={styles.compareHistoryNote}>
              {delta.toolsOnlyInNormal.length > 0
                ? `Only normal read: ${delta.toolsOnlyInNormal.join(", ")}. `
                : ""}
              {delta.toolsOnlyInDeterministic.length > 0
                ? `Only deterministic read: ${delta.toolsOnlyInDeterministic.join(", ")}.`
                : ""}
            </p>
          ) : null}
        </section>
      ) : null}

      {run && normalFacts && deterministicFacts ? (
        <div className={styles.compareGrid}>
          <SideColumn facts={normalFacts} side={run.sides.default} />
          <SideColumn facts={deterministicFacts} side={run.sides.deterministic} />
        </div>
      ) : (
        <section className={`card ${styles.compareControls}`}>
          <p className={styles.emptyState}>
            Pick an experiment or type a question, then run both modes to compare
            them side by side.
          </p>
        </section>
      )}
    </div>
  );
}
