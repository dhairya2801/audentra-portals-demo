"use client";

/**
 * Edward Lab — trace inspector panel.
 *
 * Renders one AssistantTurnTrace exactly as the platform recorded it:
 * classification, tool reads (initial vs dependency), model calls, evidence
 * corpus, grounding outcome, failure codes, latency waterfall, conversation
 * context, and the raw JSON escape hatch. Purely presentational — it never
 * invents data the trace does not contain.
 */

import { useState } from "react";
import {
  dependencyTriggerFor,
  type EdwardTurnTrace,
  evidenceTone,
  formatMs,
  formatTokens,
  GUARD_CHECKS,
  stageLabel,
  summarizeTrace,
  type TraceModelCall,
  type TraceToolCall,
} from "../lib/edward-lab";
import styles from "./edward-lab.module.css";

function CopyButton({ value, className }: { value: string; className: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1_200);
        });
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function JsonBlock({ value, tall = false }: { value: unknown; tall?: boolean }) {
  const text = JSON.stringify(value, null, 2) ?? "null";
  return (
    <div className={`${styles.jsonBlock} ${tall ? styles.jsonBlockTall : ""}`}>
      <CopyButton value={text} className={styles.jsonCopy} />
      <pre>{text}</pre>
    </div>
  );
}

function statusBadgeClass(status: string): string {
  if (status === "grounded") return styles.statusGrounded;
  if (status === "deterministic") return styles.statusDeterministic;
  if (status === "fallback" || status === "safety_gate") return styles.statusFallback;
  if (status === "error") return styles.statusError;
  return styles.statusNeutral;
}

function SummaryHeader({ trace }: { trace: EdwardTurnTrace }) {
  const summary = summarizeTrace(trace);
  return (
    <section className={`card ${styles.summaryCard}`}>
      <div className={styles.summaryHead}>
        <h2>Edward turn</h2>
        <span className={`${styles.statusBadge} ${statusBadgeClass(summary.status)}`}>
          {summary.statusLabel}
        </span>
        {trace.inputMode === "voice" ? (
          <span className={`${styles.statusBadge} ${styles.statusNeutral}`}>Voice</span>
        ) : null}
        <span className={styles.mono}>
          {trace.traceId} <CopyButton value={trace.traceId} className={styles.copyButton} />
        </span>
      </div>
      <dl className={styles.summaryGrid}>
        <div className={styles.summaryStat}>
          <dt>Total latency</dt>
          <dd>{formatMs(summary.durationMs)}</dd>
        </div>
        <div className={styles.summaryStat}>
          <dt>Tools</dt>
          <dd>
            {summary.toolCount}
            {summary.dependencyToolCount > 0 ? ` (+${summary.dependencyToolCount} dep)` : ""}
          </dd>
        </div>
        <div className={styles.summaryStat}>
          <dt>Model calls</dt>
          <dd>{summary.modelCallCount}</dd>
        </div>
        <div className={styles.summaryStat}>
          <dt>Tokens</dt>
          <dd>{formatTokens(summary.totalTokens)}</dd>
        </div>
        <div className={styles.summaryStat}>
          <dt>Request type</dt>
          <dd className={styles.mono}>{summary.requestType ?? "—"}</dd>
        </div>
        <div className={styles.summaryStat}>
          <dt>History</dt>
          <dd>
            {trace.historySource ?? "—"} · {trace.historyMessages ?? 0} msg
          </dd>
        </div>
        <div className={styles.summaryStat}>
          <dt>Response source</dt>
          <dd className={styles.mono}>{trace.responseSource ?? trace.path ?? "—"}</dd>
        </div>
        <div className={styles.summaryStat}>
          <dt>Student</dt>
          <dd className={styles.mono}>{trace.studentId?.slice(0, 8) ?? "—"}…</dd>
        </div>
        <div className={styles.summaryStat}>
          <dt>Conversation</dt>
          <dd className={styles.mono}>
            {trace.conversationId ? `${trace.conversationId.slice(0, 8)}…` : "none"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function FailureSection({ trace }: { trace: EdwardTurnTrace }) {
  const failureCodes = trace.failureCodes ?? [];
  const hasError = Boolean(trace.error);
  const gated = trace.path === "pre_pipeline_safety_gate";
  if (!hasError && !gated && failureCodes.length === 0) return null;
  return (
    <div
      className={`${styles.failureBanner} ${hasError ? styles.failureBannerError : ""}`}
      role="status"
    >
      {hasError ? (
        <p>
          <strong>Turn error:</strong> {trace.error}
        </p>
      ) : null}
      {gated ? (
        <p>
          <strong>Pre-pipeline safety gate:</strong> the refusal was composed before any
          model or tool ran.
        </p>
      ) : null}
      {failureCodes.length > 0 ? (
        <p>
          <strong>Failure codes:</strong>{" "}
          {failureCodes.map((code) => (
            <span key={code} className={styles.failureCode}>
              {code}{" "}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

function LatencySection({ trace }: { trace: EdwardTurnTrace }) {
  const stages = trace.stages ?? [];
  const toolCalls = trace.toolCalls ?? [];
  const total = Math.max(
    trace.durationMs ?? 0,
    stages.reduce((sum, stage) => sum + (stage.durationMs || 0), 0),
    1,
  );
  const stageRows = stages.reduce<{
    rows: Array<{
      key: string;
      label: string;
      left: number;
      width: number;
      durationMs: number;
      model: boolean;
      dependency: boolean;
    }>;
    elapsed: number;
  }>(
    (acc, stage) => {
      const durationMs = stage.durationMs || 0;
      acc.rows.push({
        key: stage.stage,
        label: stageLabel(stage.stage),
        left: (acc.elapsed / total) * 100,
        width: Math.max((durationMs / total) * 100, 0.5),
        durationMs,
        model: stage.stage === "model_rewrite",
        dependency: stage.stage === "dependency_reads",
      });
      return { rows: acc.rows, elapsed: acc.elapsed + durationMs };
    },
    { rows: [], elapsed: 0 },
  ).rows;
  const maxTool = Math.max(...toolCalls.map((call) => call.durationMs ?? 0), 1);
  return (
    <section className={`card ${styles.section}`}>
      <div className={styles.sectionHead}>
        <span className="eyebrow">Latency</span>
        <span className={styles.turnMeta}>total {formatMs(trace.durationMs)}</span>
      </div>
      <div className={styles.waterfall}>
        {stageRows.map((row) => (
          <div key={row.key} className={styles.waterfallRow}>
            <span className={styles.waterfallLabel}>{row.label}</span>
            <span className={styles.waterfallTrack}>
              <span
                className={`${styles.waterfallBar} ${row.model ? styles.waterfallBarModel : ""} ${
                  row.dependency ? styles.waterfallBarDependency : ""
                }`}
                style={{ left: `${row.left}%`, width: `${row.width}%` }}
              />
            </span>
            <span className={styles.waterfallMs}>{formatMs(row.durationMs)}</span>
          </div>
        ))}
        {toolCalls.map((call, index) => (
          <div key={`${call.tool}-${index}`} className={styles.waterfallRow}>
            <span className={`${styles.waterfallLabel} ${styles.waterfallLabelSub}`}>
              {call.tool}
              {call.round === "dependency" ? " (dep)" : ""}
            </span>
            <span className={styles.waterfallTrack}>
              <span
                className={`${styles.waterfallBar} ${
                  call.round === "dependency"
                    ? styles.waterfallBarDependency
                    : styles.waterfallBarTool
                }`}
                style={{ width: `${Math.max(((call.durationMs ?? 0) / maxTool) * 100, 1)}%` }}
              />
            </span>
            <span className={styles.waterfallMs}>{formatMs(call.durationMs ?? 0)}</span>
          </div>
        ))}
      </div>
      <p className={styles.personaMeta} style={{ marginTop: "0.45rem" }}>
        Stage bars are sequential (offset = elapsed); tool bars are parallel reads scaled to
        the slowest tool.
      </p>
    </section>
  );
}

function ClassificationSection({ trace }: { trace: EdwardTurnTrace }) {
  const classification = trace.classification;
  const selected = trace.selectedTools ?? [];
  const toolCalls = trace.toolCalls ?? [];
  const initial = toolCalls.filter((call) => call.round !== "dependency");
  const dependency = toolCalls.filter((call) => call.round === "dependency");
  const triggers = trace.secondRead?.triggeredBy ?? [];
  return (
    <section className={`card ${styles.section}`}>
      <div className={styles.sectionHead}>
        <span className="eyebrow">Classification &amp; planning</span>
      </div>
      <dl className={styles.kvGrid}>
        <dt>Intent</dt>
        <dd className={styles.mono}>{classification?.requestType ?? "—"}</dd>
        {classification?.additionalRequestTypes?.length ? (
          <>
            <dt>Additional intents</dt>
            <dd className={styles.mono}>{classification.additionalRequestTypes.join(", ")}</dd>
          </>
        ) : null}
        <dt>Confidence</dt>
        <dd>{classification?.confidence ?? "—"}</dd>
        <dt>Classified by</dt>
        <dd className={styles.mono}>{classification?.source ?? "—"}</dd>
        <dt>Tool selection</dt>
        <dd className={styles.mono}>{trace.toolSelectionSource ?? "—"}</dd>
        <dt>Selected reads</dt>
        <dd>
          <span className={styles.toolChips}>
            {selected.length === 0 ? <span className={styles.emptyState}>none</span> : null}
            {selected.map((tool) => (
              <span key={tool} className={styles.toolChip}>
                {tool}
              </span>
            ))}
          </span>
        </dd>
        <dt>Initial reads</dt>
        <dd>
          <span className={styles.toolChips}>
            {initial.map((call) => (
              <span key={call.tool} className={styles.toolChip}>
                {call.status === "available" ? "✓" : "✗"} {call.tool}
              </span>
            ))}
          </span>
        </dd>
        {dependency.length > 0 ? (
          <>
            <dt>Dependency reads</dt>
            <dd>
              <span className={styles.toolChips}>
                {dependency.map((call) => (
                  <span
                    key={call.tool}
                    className={`${styles.toolChip} ${styles.toolChipDependency}`}
                  >
                    {call.status === "available" ? "✓" : "✗"} {call.tool}
                  </span>
                ))}
              </span>
            </dd>
            <dt>Triggered by</dt>
            <dd className={styles.mono}>
              {triggers.map((entry) => `${entry.gate} → ${entry.tool}`).join(", ") || "—"}
            </dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

function ToolCard({ call, trace }: { call: TraceToolCall; trace: EdwardTurnTrace }) {
  const trigger = call.round === "dependency" ? dependencyTriggerFor(trace, call.tool) : null;
  const ok = call.status === "available";
  return (
    <details className={styles.toolCard}>
      <summary>
        <span className={ok ? styles.okDot : styles.failDot} aria-hidden />
        <span className={styles.toolName}>{call.tool}</span>
        <span
          className={`${styles.roundBadge} ${
            call.round === "dependency" ? styles.roundBadgeDependency : ""
          }`}
        >
          {call.round === "dependency" ? "dependency" : "initial"}
        </span>
        <span className={styles.turnMeta}>{formatMs(call.durationMs ?? 0)}</span>
      </summary>
      <div className={styles.toolBody}>
        <dl className={styles.kvGrid}>
          <dt>Status</dt>
          <dd className={styles.mono}>{call.status}</dd>
          {call.reason ? (
            <>
              <dt>Reason</dt>
              <dd className={styles.mono}>{call.reason}</dd>
            </>
          ) : null}
          {trigger ? (
            <>
              <dt>Trigger gate</dt>
              <dd className={styles.mono}>{trigger}</dd>
            </>
          ) : null}
          <dt>Records</dt>
          <dd>{call.recordCount ?? "—"}</dd>
          <dt>Arguments</dt>
          <dd className={styles.personaMeta}>
            none — identity is bound server-side; tools receive no model-supplied arguments
          </dd>
        </dl>
        {call.result !== undefined ? (
          <JsonBlock value={call.result} />
        ) : (
          <p className={styles.emptyState}>No result payload recorded.</p>
        )}
      </div>
    </details>
  );
}

function ModelCallsSection({ trace }: { trace: EdwardTurnTrace }) {
  const calls = trace.modelCalls ?? [];
  return (
    <section className={`card ${styles.section}`}>
      <div className={styles.sectionHead}>
        <span className="eyebrow">Model calls</span>
        <span className={styles.turnMeta}>
          {trace.provider ? `${trace.provider} · ${trace.model ?? "?"}` : "no provider"}
        </span>
      </div>
      {calls.length === 0 ? (
        <p className={styles.emptyState}>
          No model call this turn — the answer was composed deterministically.
        </p>
      ) : (
        calls.map((call: TraceModelCall, index) => {
          const ok = call.outcome === "accepted";
          return (
            <div key={`${call.operation}-${index}`} className={styles.modelCall}>
              <span className={ok ? styles.okDot : styles.failDot} aria-hidden />
              <span className={styles.toolName}>
                {call.operation === "assistant_planner" ? "Planner" : "Composer"}
                {call.attempt > 1 ? ` · attempt ${call.attempt}` : ""}
              </span>
              <span
                className={`${styles.statusBadge} ${
                  ok ? styles.statusGrounded : styles.statusFallback
                }`}
              >
                {call.outcome}
                {call.detail ? `: ${call.detail}` : ""}
              </span>
              <span className={styles.modelCallMeta}>
                <span>{call.model ?? call.provider ?? "model n/a"}</span>
                <span>{formatMs(call.durationMs)}</span>
                {call.usage ? (
                  <span>
                    {formatTokens(call.usage.promptTokens)} →{" "}
                    {formatTokens(call.usage.completionTokens)} tokens
                  </span>
                ) : (
                  <span>usage n/a</span>
                )}
              </span>
            </div>
          );
        })
      )}
    </section>
  );
}

function GroundingSection({ trace }: { trace: EdwardTurnTrace }) {
  const rejections = (trace.modelCalls ?? []).filter(
    (call) => call.outcome === "guard_rejected",
  );
  const accepted = trace.responseSource === "model_prose";
  const attempted = (trace.modelCalls ?? []).some(
    (call) => call.operation === "assistant_composer",
  );
  const failedChecks = new Set(rejections.map((call) => call.detail ?? ""));
  return (
    <section className={`card ${styles.section}`}>
      <div className={styles.sectionHead}>
        <span className="eyebrow">Grounding guard</span>
        <span
          className={`${styles.statusBadge} ${
            accepted
              ? styles.statusGrounded
              : rejections.length > 0
                ? styles.statusError
                : styles.statusDeterministic
          }`}
        >
          {accepted
            ? "Accepted"
            : rejections.length > 0
              ? "Rejected → deterministic fallback"
              : attempted
                ? "Model failed → deterministic"
                : "Deterministic (no model prose)"}
        </span>
      </div>
      {rejections.length > 0 ? (
        <dl className={styles.kvGrid}>
          {rejections.map((call, index) => (
            <div key={index} style={{ display: "contents" }}>
              <dt>Attempt {call.attempt}</dt>
              <dd className={styles.mono}>{call.detail ?? "rejected"}</dd>
            </div>
          ))}
          <dt>Final source</dt>
          <dd className={styles.mono}>{trace.responseSource ?? "deterministic"}</dd>
        </dl>
      ) : null}
      {attempted || accepted ? (
        <ul className={styles.checkList}>
          {GUARD_CHECKS.map((check) => {
            const failed =
              (check === "invented causation" && failedChecks.has("invented_causation")) ||
              (check === "dates" && failedChecks.has("ungrounded_date")) ||
              (check === "numbers" && failedChecks.has("ungrounded_number")) ||
              (check === "contacts" && failedChecks.has("ungrounded_contact")) ||
              (check === "write claims" && failedChecks.has("claimed_write")) ||
              (check === "internal identifiers" && failedChecks.has("leaked_identifier")) ||
              (check === "document state" &&
                failedChecks.has("contradicted_document_state"));
            return (
              <li key={check} className={failed ? styles.checkFailed : ""}>
                {failed ? "✗" : "✓"} {check}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.emptyState}>
          The claim guard runs only on model-written prose; this turn used the deterministic
          composer directly.
        </p>
      )}
    </section>
  );
}

function EvidenceSection({ trace }: { trace: EdwardTurnTrace }) {
  const evidence = trace.evidence ?? [];
  return (
    <section className={`card ${styles.section}`}>
      <div className={styles.sectionHead}>
        <span className="eyebrow">Evidence Edward reasoned from</span>
        <span className={styles.turnMeta}>{evidence.length} facts</span>
      </div>
      {evidence.length === 0 ? (
        <p className={styles.emptyState}>
          No evidence corpus this turn (conversational opener, safety gate, or replay).
        </p>
      ) : (
        <ul className={styles.evidenceList}>
          {evidence.map((line, index) => {
            const tone = evidenceTone(line);
            return (
              <li
                key={index}
                className={
                  tone === "warn"
                    ? styles.evidenceWarn
                    : tone === "done"
                      ? styles.evidenceDone
                      : ""
                }
              >
                <span className={styles.evidenceIcon} aria-hidden>
                  {tone === "warn" ? "⚠" : tone === "done" ? "✓" : "•"}
                </span>
                <span>{line}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ContextSection({ trace }: { trace: EdwardTurnTrace }) {
  return (
    <section className={`card ${styles.section}`}>
      <div className={styles.sectionHead}>
        <span className="eyebrow">Conversation context</span>
      </div>
      <dl className={styles.kvGrid}>
        <dt>History source</dt>
        <dd className={styles.mono}>{trace.historySource ?? "—"}</dd>
        <dt>Messages used</dt>
        <dd>{trace.historyMessages ?? 0}</dd>
        <dt>Conversation</dt>
        <dd className={styles.mono}>{trace.conversationId ?? "none (stateless turn)"}</dd>
        <dt>Input mode</dt>
        <dd className={styles.mono}>{trace.inputMode ?? "text"}</dd>
        <dt>Page context</dt>
        <dd className={styles.mono}>
          {trace.pagePath ?? "—"}
          {trace.pageLabel ? ` (${trace.pageLabel})` : ""}
        </dd>
        <dt>Question</dt>
        <dd>{trace.userMessage || "—"}</dd>
        <dt>Answer</dt>
        <dd>{trace.finalMessage || "—"}</dd>
      </dl>
      <p className={styles.personaMeta} style={{ marginTop: "0.4rem" }}>
        The trace records history provenance and counts; the bounded message texts live in
        the durable conversation store.
      </p>
    </section>
  );
}

export function EdwardTraceInspector({ trace }: { trace: EdwardTurnTrace | null }) {
  const [tab, setTab] = useState<"inspector" | "raw">("inspector");
  if (!trace) {
    return (
      <section className={`card ${styles.section}`}>
        <span className="eyebrow">Trace inspector</span>
        <p className={styles.emptyState}>
          Ask Edward a question on the left — its trace will appear here automatically. You
          can also pick any recent trace below.
        </p>
      </section>
    );
  }
  return (
    <>
      <SummaryHeader trace={trace} />
      <div className={styles.tabRow} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "inspector"}
          className={`${styles.tabButton} ${tab === "inspector" ? styles.tabButtonActive : ""}`}
          onClick={() => setTab("inspector")}
        >
          Inspector
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "raw"}
          className={`${styles.tabButton} ${tab === "raw" ? styles.tabButtonActive : ""}`}
          onClick={() => setTab("raw")}
        >
          Raw trace
        </button>
      </div>
      {tab === "raw" ? (
        <JsonBlock value={trace} tall />
      ) : (
        <>
          <FailureSection trace={trace} />
          <ClassificationSection trace={trace} />
          <section className={`card ${styles.section}`}>
            <div className={styles.sectionHead}>
              <span className="eyebrow">Tool reads</span>
              <span className={styles.turnMeta}>{(trace.toolCalls ?? []).length} executed</span>
            </div>
            {(trace.toolCalls ?? []).length === 0 ? (
              <p className={styles.emptyState}>No tools were read this turn.</p>
            ) : (
              (trace.toolCalls ?? []).map((call, index) => (
                <ToolCard key={`${call.tool}-${index}`} call={call} trace={trace} />
              ))
            )}
          </section>
          <ModelCallsSection trace={trace} />
          <EvidenceSection trace={trace} />
          <GroundingSection trace={trace} />
          <LatencySection trace={trace} />
          <ContextSection trace={trace} />
        </>
      )}
    </>
  );
}
