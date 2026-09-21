"use client";

/**
 * Edward Lab — trace inspector panel.
 *
 * Renders one AssistantTurnTrace exactly as the platform recorded it, in the
 * order the turn executed: route, question + context, write recognition,
 * (staff) identity and entity resolution, routing, the model read loop, tool
 * reads by round, model calls, evidence, the claim guard's verdict, latency,
 * and the raw JSON escape hatch. Purely presentational — it never invents
 * data the trace does not contain, and says "not recorded" where it doesn't.
 */

import { useState } from "react";
import {
  dependencyTriggerFor,
  type EdwardTurnTrace,
  evidenceTone,
  formatMs,
  formatTokens,
  guardReasonLabel,
  modelCallLabel,
  modelOperationIs,
  pathLabel,
  recognitionSourceLabel,
  responseSourceLabel,
  roundFamily,
  roundLabel,
  stageDetails,
  stageLabel,
  summarizeTrace,
  type TraceModelCall,
  type TraceToolCall,
} from "../lib/edward-lab";
import { EdwardAnswerEvolution } from "./edward-answer-evolution";
import { Info, ToolName } from "./edward-lab-info";
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
  if (status === "loop") return styles.statusLoop;
  if (status === "deterministic") return styles.statusDeterministic;
  if (status === "fallback" || status === "safety_gate") return styles.statusFallback;
  if (status === "action") return styles.statusAction;
  if (status === "error") return styles.statusError;
  return styles.statusNeutral;
}

function roundBadgeClass(round: string): string {
  const family = roundFamily(round);
  if (family === "dependency") return styles.roundBadgeDependency;
  if (family === "referent") return styles.roundBadgeReferent;
  if (family === "entities") return styles.roundBadgeEntities;
  if (family === "loop") return styles.roundBadgeLoop;
  return "";
}

function Eyebrow({ children, concept }: { children: string; concept?: Parameters<typeof Info>[0]["concept"] }) {
  return (
    <span className={styles.eyebrowRow}>
      <span className="eyebrow">{children}</span>
      {concept ? <Info concept={concept} /> : null}
    </span>
  );
}

/* --- header ---------------------------------------------------------------- */

function SummaryHeader({ trace }: { trace: EdwardTurnTrace }) {
  const summary = summarizeTrace(trace);
  const staff = trace.assistantKind === "staff";
  return (
    <section className={`card ${styles.summaryCard}`}>
      <div className={styles.summaryHead}>
        <h2>{staff ? "Staff Edward turn" : "Edward turn"}</h2>
        <span className={`${styles.statusBadge} ${statusBadgeClass(summary.status)}`}>
          {summary.statusLabel}
        </span>
        {trace.executionMode === "deterministic" ? (
          <span className={`${styles.statusBadge} ${styles.statusNeutral}`}>zero-LLM mode</span>
        ) : null}
        {trace.inputMode === "voice" ? (
          <span className={`${styles.statusBadge} ${styles.statusNeutral}`}>Voice</span>
        ) : null}
      </div>
      <div className={styles.routeLine}>
        <span>
          route <b>{pathLabel(trace.path)}</b>
          <Info concept="path" />
        </span>
        <span>
          planner <b>{trace.readPlanner ?? "not recorded"}</b>
          <Info concept="read_planner" />
        </span>
        <span>
          wrote the answer <b>{responseSourceLabel(trace.responseSource)}</b>
          <Info concept="response_source" />
        </span>
      </div>
      <dl className={styles.summaryGrid}>
        <div className={styles.summaryStat}>
          <dt>Server time</dt>
          <dd>{formatMs(summary.durationMs)}</dd>
        </div>
        <div className={styles.summaryStat}>
          <dt>Model calls</dt>
          <dd>{summary.modelCallCount}</dd>
        </div>
        <div className={styles.summaryStat}>
          <dt>
            Tokens <Info concept="tokens" />
          </dt>
          <dd>{formatTokens(summary.totalTokens)}</dd>
        </div>
        <div className={styles.summaryStat}>
          <dt>Tool reads</dt>
          <dd>
            {summary.toolCount}
            {summary.dependencyToolCount > 0 ? ` (+${summary.dependencyToolCount} dep)` : ""}
          </dd>
        </div>
        {summary.loopRounds > 0 ? (
          <div className={styles.summaryStat}>
            <dt>Loop rounds</dt>
            <dd>{summary.loopRounds}</dd>
          </div>
        ) : null}
        <div className={styles.summaryStat}>
          <dt>Intent</dt>
          <dd className={styles.mono}>{summary.requestType ?? "—"}</dd>
        </div>
        <div className={styles.summaryStat}>
          <dt>Model</dt>
          <dd className={styles.mono}>
            {trace.provider ? `${trace.provider} · ${trace.model ?? "?"}` : "none"}
          </dd>
        </div>
      </dl>
      <div className={styles.idsLine}>
        <span className={styles.mono}>
          trace {trace.traceId} <CopyButton value={trace.traceId} className={styles.copyButton} />
        </span>
        <span className={styles.mono}>
          conversation {trace.conversationId ?? "none (stateless turn)"}
        </span>
        {staff ? (
          <>
            <span className={styles.mono}>staff {trace.staffMemberId ?? "—"}</span>
            <span className={styles.mono}>resolved student {trace.studentId ?? "none"}</span>
          </>
        ) : (
          <span className={styles.mono}>student {trace.studentId ?? "—"}</span>
        )}
      </div>
    </section>
  );
}

/* --- failures ---------------------------------------------------------------- */

function FailureSection({ trace }: { trace: EdwardTurnTrace }) {
  const failureCodes = trace.failureCodes ?? [];
  const hasError = Boolean(trace.error);
  const path = trace.path ?? "pipeline";
  const gated = path === "pre_pipeline_safety_gate" || path === "action_untrusted_framing";
  if (!hasError && !gated && failureCodes.length === 0 && !trace.ignoredExecutionModeRequest) {
    return null;
  }
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
          <strong>{pathLabel(path)}:</strong> the refusal was composed before any model or tool
          ran.
        </p>
      ) : null}
      {trace.ignoredExecutionModeRequest ? (
        <p>
          <strong>Ignored control:</strong> the request asked for mode{" "}
          <span className={styles.failureCode}>{trace.ignoredExecutionModeRequest}</span> and
          this environment refused it (Lab controls are off here).
        </p>
      ) : null}
      {failureCodes.length > 0 ? (
        <p>
          <strong>Failure codes</strong>
          <Info concept="failure_codes" />:{" "}
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

/* --- question + context -------------------------------------------------------- */

function ContextSection({ trace }: { trace: EdwardTurnTrace }) {
  const normalize = (trace.stages ?? []).find((stage) => stage.stage === "normalize");
  const normalizeDetails = normalize ? stageDetails(normalize) : [];
  const preview = trace.historyPreview ?? [];
  return (
    <section className={`card ${styles.section}`}>
      <div className={styles.sectionHead}>
        <Eyebrow concept="history">Conversation context</Eyebrow>
        <span className={styles.turnMeta}>
          {trace.historySource ?? "—"} · {trace.historyMessages ?? 0} prior
        </span>
      </div>
      <dl className={styles.kvGrid}>
        <dt>Question</dt>
        <dd>{trace.userMessage || "—"}</dd>
        <dt>Page</dt>
        <dd className={styles.mono}>
          {trace.pagePath ?? "—"}
          {trace.pageLabel ? ` (${trace.pageLabel})` : ""}
        </dd>
        <dt>Input</dt>
        <dd className={styles.mono}>{trace.inputMode ?? "text"}</dd>
        {normalizeDetails.map(([key, value]) => (
          <div key={key} style={{ display: "contents" }}>
            <dt>{key}</dt>
            <dd className={styles.mono}>{value}</dd>
          </div>
        ))}
      </dl>
      {preview.length > 0 ? (
        <ul className={styles.historyList} aria-label="History the model saw">
          {preview.map((entry, index) => (
            <li key={index} className={styles.historyRow}>
              <span className={styles.historyRole}>{entry.role}</span>
              <span>{entry.content}</span>
            </li>
          ))}
        </ul>
      ) : (trace.historyMessages ?? 0) > 0 ? (
        <p className={styles.personaMeta} style={{ marginTop: "0.4rem" }}>
          {trace.historyMessages} prior message{trace.historyMessages === 1 ? "" : "s"} were
          used but this trace predates history recording.
        </p>
      ) : null}
    </section>
  );
}

/* --- recognition + action plane -------------------------------------------------- */

function RecognitionSection({ trace }: { trace: EdwardTurnTrace }) {
  const recognizerCalls = (trace.modelCalls ?? []).filter(
    (call) => call.operation === "action_recognizer",
  );
  const actionPresent = Boolean(
    trace.actionRequested ||
      trace.actionProposed ||
      trace.actionPolicyResult ||
      trace.actionIntentId ||
      trace.actionExecutionResult ||
      trace.actionReceipt,
  );
  return (
    <section className={`card ${styles.section}`}>
      <div className={styles.sectionHead}>
        <Eyebrow concept="recognizer">Write recognition · Action plane</Eyebrow>
        <span className={styles.turnMeta}>
          {actionPresent
            ? (trace.actionExecutionResult ?? trace.actionPolicyResult ?? "recognized")
            : "no action"}
          {trace.actionLatencyMs != null ? ` · ${formatMs(trace.actionLatencyMs)}` : ""}
        </span>
      </div>
      <dl className={styles.kvGrid}>
        <dt>Recognition</dt>
        <dd>{recognitionSourceLabel(trace.actionRecognitionSource)}</dd>
        {recognizerCalls.map((call, index) => (
          <div key={index} style={{ display: "contents" }}>
            <dt>Tier 1 call</dt>
            <dd className={styles.mono}>
              {call.outcome}
              {call.detail ? ` (${call.detail})` : ""} · {call.model ?? call.provider ?? "?"} ·{" "}
              {formatMs(call.durationMs)} ·{" "}
              {call.usage ? `${formatTokens(call.usage.totalTokens)} tokens` : "usage n/a"}
            </dd>
          </div>
        ))}
        {actionPresent ? (
          <>
            <dt>Requested</dt>
            <dd className={styles.mono}>{trace.actionRequested ?? "—"}</dd>
            <dt>Proposed</dt>
            <dd className={styles.mono}>{trace.actionProposed ?? "—"}</dd>
            <dt>Policy result</dt>
            <dd className={styles.mono}>{trace.actionPolicyResult ?? "—"}</dd>
            {trace.actionDenialReason ? (
              <>
                <dt>Denial</dt>
                <dd>{trace.actionDenialReason}</dd>
              </>
            ) : null}
            <dt>Intent</dt>
            <dd className={styles.mono}>{trace.actionIntentId ?? "—"}</dd>
            <dt>Confirmation</dt>
            <dd className={styles.mono}>{trace.actionConfirmationMode ?? "—"}</dd>
            <dt>Capability</dt>
            <dd className={styles.mono}>{trace.actionAuthorizationCapability ?? "self"}</dd>
            <dt>Blast radius</dt>
            <dd>{trace.actionBlastRadius ?? "—"}</dd>
            <dt>Execution</dt>
            <dd className={styles.mono}>{trace.actionExecutionResult ?? "not executed"}</dd>
          </>
        ) : null}
      </dl>
      {(trace.actionProvenance ?? []).length > 0 ? (
        <details className={styles.toolCard}>
          <summary>Preview provenance ({trace.actionProvenance?.length ?? 0})</summary>
          <JsonBlock value={trace.actionProvenance} />
        </details>
      ) : null}
      {trace.actionReceipt ? (
        <details className={styles.toolCard}>
          <summary>Server-issued receipt</summary>
          <JsonBlock value={trace.actionReceipt} />
        </details>
      ) : null}
    </section>
  );
}

/* --- staff identity + entities ------------------------------------------------------ */

function IdentitySection({ trace }: { trace: EdwardTurnTrace }) {
  const identity = trace.identity;
  if (trace.assistantKind !== "staff") return null;
  return (
    <section className={`card ${styles.section}`}>
      <div className={styles.sectionHead}>
        <Eyebrow concept="identity">Staff identity</Eyebrow>
      </div>
      {identity ? (
        <dl className={styles.kvGrid}>
          <dt>Name</dt>
          <dd>
            {identity.name ?? "—"}
            {identity.title ? ` · ${identity.title}` : ""}
          </dd>
          <dt>Role</dt>
          <dd className={styles.mono}>{identity.roleCode ?? "—"}</dd>
          <dt>Component</dt>
          <dd>{identity.component ?? "—"}</dd>
          <dt>Caseload</dt>
          <dd>
            {identity.primaryAdvisees ?? 0} primary advisee
            {identity.primaryAdvisees === 1 ? "" : "s"} · {identity.directReports ?? 0} direct
            report{identity.directReports === 1 ? "" : "s"}
            {identity.isManager ? " · manager" : ""}
          </dd>
          {identity.employmentStatus ? (
            <>
              <dt>Employment</dt>
              <dd className={styles.mono}>{identity.employmentStatus}</dd>
            </>
          ) : null}
        </dl>
      ) : (
        <p className={styles.emptyState}>No identity recorded on this turn.</p>
      )}
    </section>
  );
}

function EntitiesSection({ trace }: { trace: EdwardTurnTrace }) {
  if (trace.assistantKind !== "staff") return null;
  const entities = trace.entities;
  const lookups = (trace.toolCalls ?? []).filter(
    (call) => call.round === "entities" || call.round === "referent",
  );
  const mentions = entities?.mentions ?? [];
  const ambiguities = entities?.ambiguities ?? [];
  return (
    <section className={`card ${styles.section}`}>
      <div className={styles.sectionHead}>
        <Eyebrow concept="entities">Entity &amp; referent resolution</Eyebrow>
        <span className={styles.turnMeta}>
          {mentions.length} mention{mentions.length === 1 ? "" : "s"} · {lookups.length} lookup
          {lookups.length === 1 ? "" : "s"}
        </span>
      </div>
      {!entities ? (
        <p className={styles.emptyState}>No entity resolution recorded on this turn.</p>
      ) : (
        <dl className={styles.kvGrid}>
          <dt>Mentions</dt>
          <dd>
            {mentions.length === 0 ? (
              <span className={styles.emptyState}>none in the message</span>
            ) : (
              <span className={styles.toolChips}>
                {mentions.map((mention, index) => (
                  <span key={index} className={styles.toolChip}>
                    {mention.text}
                    {mention.kindHint ? ` · ${mention.kindHint}` : ""}
                    {mention.possessive ? " · possessive" : ""}
                  </span>
                ))}
              </span>
            )}
          </dd>
          {(entities.students ?? []).map((entity) => (
            <div key={`s-${entity.id}`} style={{ display: "contents" }}>
              <dt>Student</dt>
              <dd>
                <span className={styles.okDot} aria-hidden /> {entity.name}
                {entity.matchQuality ? (
                  <span className={styles.personaMeta}> · {entity.matchQuality}</span>
                ) : null}
                {entity.mention ? (
                  <span className={styles.personaMeta}> · from “{entity.mention}”</span>
                ) : null}
                <span className={styles.mono}> {entity.id}</span>
              </dd>
            </div>
          ))}
          {(entities.staff ?? []).map((entity) => (
            <div key={`f-${entity.id}`} style={{ display: "contents" }}>
              <dt>Staff</dt>
              <dd>
                <span className={styles.okDot} aria-hidden /> {entity.name}
                {entity.matchQuality ? (
                  <span className={styles.personaMeta}> · {entity.matchQuality}</span>
                ) : null}
                <span className={styles.mono}> {entity.id}</span>
              </dd>
            </div>
          ))}
          {(entities.departments ?? []).map((entity) => (
            <div key={`d-${entity.id}`} style={{ display: "contents" }}>
              <dt>Department</dt>
              <dd>{entity.name}</dd>
            </div>
          ))}
          {ambiguities.map((ambiguity, index) => {
            const candidates = [
              ...((ambiguity.students ?? []) as unknown[]),
              ...((ambiguity.staff ?? []) as unknown[]),
            ];
            return (
              <div key={`a-${index}`} style={{ display: "contents" }}>
                <dt>Ambiguous</dt>
                <dd className={styles.toneWarn}>
                  <span className={styles.failDot} aria-hidden /> “{ambiguity.mention}” —{" "}
                  {ambiguity.reason.replaceAll("_", " ")}
                  {ambiguity.fuzzy ? " (fuzzy)" : ""} · {candidates.length} candidate
                  {candidates.length === 1 ? "" : "s"}
                  {candidates.length > 0 ? (
                    <span className={styles.personaMeta}>
                      {" "}
                      ({candidates
                        .slice(0, 6)
                        .map((candidate) =>
                          typeof candidate === "string"
                            ? candidate
                            : JSON.stringify(candidate),
                        )
                        .join(", ")}
                      {candidates.length > 6 ? ", …" : ""})
                    </span>
                  ) : null}
                </dd>
              </div>
            );
          })}
          <dt>Scope hints</dt>
          <dd className={styles.mono}>
            {[
              entities.selfReference ? "self-reference" : null,
              entities.selfTeam ? "self-team" : null,
              entities.staffContext ? "staff-context" : null,
              entities.studentContext ? "student-context" : null,
            ]
              .filter(Boolean)
              .join(" · ") || "none"}
          </dd>
        </dl>
      )}
    </section>
  );
}

/* --- routing ------------------------------------------------------------------ */

function RoutingSection({ trace }: { trace: EdwardTurnTrace }) {
  const classification = trace.classification;
  const coverage = (trace.stages ?? []).find((stage) => stage.stage === "coverage_gate");
  const planner = (trace.modelCalls ?? []).filter((call) => modelOperationIs(call, "assistant_planner"));
  const selected = trace.selectedTools ?? [];
  const loop = trace.readLoop;
  const triggers = trace.secondRead?.triggeredBy ?? [];
  return (
    <section className={`card ${styles.section}`}>
      <div className={styles.sectionHead}>
        <Eyebrow concept="classifier">Routing</Eyebrow>
        <span className={styles.turnMeta}>
          {trace.toolSelectionSource ? `reads chosen by ${trace.toolSelectionSource}` : ""}
        </span>
      </div>
      <dl className={styles.kvGrid}>
        <dt>Intent</dt>
        <dd className={styles.mono}>{classification?.requestType ?? "none"}</dd>
        {classification?.additionalRequestTypes?.length ? (
          <>
            <dt>Also asked</dt>
            <dd className={styles.mono}>{classification.additionalRequestTypes.join(", ")}</dd>
          </>
        ) : null}
        {classification?.reference ? (
          <>
            <dt>Reference</dt>
            <dd className={styles.mono}>{classification.reference}</dd>
          </>
        ) : null}
        <dt>Confidence</dt>
        <dd>{classification?.confidence ?? "—"}</dd>
        <dt>Classified by</dt>
        <dd className={styles.mono}>{classification?.source ?? "—"}</dd>
        {coverage ? (
          <>
            <dt>
              Coverage gate <Info concept="coverage_gate" />
            </dt>
            <dd className={styles.mono}>
              {stageDetails(coverage)
                .map(([key, value]) => `${key}: ${value}`)
                .join(" · ") || "ran"}
            </dd>
          </>
        ) : null}
        {planner.length > 0 ? (
          <>
            <dt>
              Model planner <Info concept="model_planner" />
            </dt>
            <dd className={styles.mono}>
              {planner
                .map(
                  (call) =>
                    `attempt ${call.attempt}: ${call.outcome}${call.detail ? ` (${call.detail})` : ""}`,
                )
                .join(" · ")}
            </dd>
          </>
        ) : null}
        <dt>Planner</dt>
        <dd className={styles.mono}>
          {trace.readPlanner ?? "not recorded"}
          {loop ? " → model read loop took this turn" : ""}
        </dd>
        <dt>Selected reads</dt>
        <dd>
          <span className={styles.toolChips}>
            {selected.length === 0 ? <span className={styles.emptyState}>none</span> : null}
            {selected.map((tool) => (
              <span key={tool} className={styles.toolChip}>
                <ToolName name={tool} className={styles.mono} />
              </span>
            ))}
          </span>
        </dd>
        {triggers.length > 0 ? (
          <>
            <dt>
              Dependency round <Info concept="dependency_round" />
            </dt>
            <dd className={styles.mono}>
              Triggered by {triggers.map((entry) => `${entry.gate} → ${entry.tool}`).join(", ")}
            </dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

/* --- read loop ----------------------------------------------------------------- */

function ReadLoopSection({ trace }: { trace: EdwardTurnTrace }) {
  const loop = trace.readLoop;
  if (!loop) return null;
  const accepted = loop.guard === "accepted";
  const guardRan = accepted || Boolean(loop.rejectedAnswer) || loop.outcome === "answered";
  const steps = loop.steps ?? [];
  const loopCalls = (trace.toolCalls ?? []).filter((call) => call.round.startsWith("loop-"));
  const loopModelCalls = (trace.modelCalls ?? []).filter(
    (call) => modelOperationIs(call, "assistant_read_loop"),
  );
  const tokens = loopModelCalls.reduce((sum, call) => sum + (call.usage?.totalTokens ?? 0), 0);
  return (
    <section className={`card ${styles.section}`}>
      <div className={styles.sectionHead}>
        <Eyebrow concept="read_loop">Model read loop</Eyebrow>
        <span className={styles.turnMeta}>
          {loop.rounds} round{loop.rounds === 1 ? "" : "s"} · {loopCalls.length} read
          {loopCalls.length === 1 ? "" : "s"} · {formatTokens(tokens)} tokens
        </span>
      </div>
      <dl className={styles.kvGrid}>
        <dt>Outcome</dt>
        <dd className={styles.mono}>{loop.outcome}</dd>
        <dt>Guard</dt>
        <dd className={accepted ? styles.toneOk : styles.toneBad}>
          {!guardRan ? "Not run: no answer was produced" : accepted ? "accepted" : `${loop.guard} — ${guardReasonLabel(loop.guard)}`}
          {!accepted ? ` → ${trace.responseSource ?? "fallback source not recorded"}` : ""}
        </dd>
      </dl>
      {steps.length > 0 ? (
        <ol className={styles.loopSteps}>
          {steps.map((step) => {
            const modelCall = loopModelCalls.find((call) => call.attempt === step.round);
            return (
              <li key={step.round} className={styles.loopStep}>
                <div className={styles.loopStepHead}>
                  <span className={styles.loopStepRound}>round {step.round}</span>
                  <span className={styles.mono}>
                    {step.outcome}
                    {step.forced ? " (forced answer round)" : ""}
                    {step.discardedAnswer ? " · answer written before results — discarded" : ""}
                  </span>
                  {modelCall ? (
                    <span className={styles.turnMeta}>
                      {formatMs(modelCall.durationMs)} ·{" "}
                      {modelCall.usage
                        ? `${formatTokens(modelCall.usage.promptTokens)} → ${formatTokens(
                            modelCall.usage.completionTokens,
                          )} tokens`
                        : "usage n/a"}
                    </span>
                  ) : null}
                </div>
                {step.reasoning ? (
                  <p className={styles.loopReasoning}>{step.reasoning}</p>
                ) : (
                  <p className={styles.emptyState}>No decision summary this round.</p>
                )}
                {step.reads.length > 0 ? (
                  <span className={styles.loopReads}>
                    {step.reads.map((read, index) => (
                      <span
                        key={`${read.tool}-${index}`}
                        className={`${styles.toolChip} ${
                          read.status === "rejected" ? styles.toolChipDependency : styles.toolChipLoop
                        }`}
                        title={read.reason ?? undefined}
                      >
                        {read.status === "available" ? "✓" : "✗"}{" "}
                        <ToolName name={read.tool} className={styles.mono} />
                        {read.status !== "available" ? ` · ${read.status}` : ""}
                      </span>
                    ))}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <ol className={styles.loopSteps}>
          {loop.reasoning.map((note, index) => (
            <li key={index} className={styles.loopStep}>
              <span className={styles.loopStepRound}>decision summary {index + 1}</span>
              <p className={styles.loopReasoning}>{note}</p>
            </li>
          ))}
        </ol>
      )}
      {loop.rejectedAnswer ? (
        <>
          <p className={styles.archSubhead} style={{ marginTop: "0.5rem" }}>
            Rejected answer
            {loop.ungrounded?.length ? ` · ungrounded: ${loop.ungrounded.join(", ")}` : ""}
          </p>
          <blockquote className={`${styles.quoteBlock} ${styles.quoteBlockBad}`}>
            {loop.rejectedAnswer}
          </blockquote>
        </>
      ) : null}
    </section>
  );
}

/* --- tool reads --------------------------------------------------------------------- */

function ToolCard({ call, trace }: { call: TraceToolCall; trace: EdwardTurnTrace }) {
  const trigger = call.round === "dependency" ? dependencyTriggerFor(trace, call.tool) : null;
  const ok = call.status === "available";
  return (
    <details className={styles.toolCard}>
      <summary>
        <span className={ok ? styles.okDot : styles.failDot} aria-hidden />
        <ToolName name={call.tool} />
        <span className={`${styles.roundBadge} ${roundBadgeClass(call.round)}`}>
          {roundLabel(call.round)}
        </span>
        <span className={styles.turnMeta}>
          {call.status}
          {call.durationMs != null ? ` · ${formatMs(call.durationMs)}` : ""}
        </span>
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
          {call.validation ? (
            <>
              <dt>Validation</dt>
              <dd className={styles.mono}>{call.validation}</dd>
            </>
          ) : null}
          <dt>Records</dt>
          <dd>{call.recordCount ?? "—"}</dd>
          {call.arguments === undefined ? (
            <>
              <dt>Arguments</dt>
              <dd className={styles.personaMeta}>
                none — identity is bound server-side; this tool receives no model-supplied
                arguments
              </dd>
            </>
          ) : null}
        </dl>
        {call.arguments !== undefined ? (
          <>
            <span className="eyebrow">Arguments</span>
            <JsonBlock value={call.arguments} />
          </>
        ) : null}
        {call.modelResult !== undefined ? <>
          <span className="eyebrow">Evidence sent to the planner (trace privacy redaction applied)</span>
          <JsonBlock value={call.modelResult} />
        </> : null}
        {call.result !== undefined ? (
          <>
            <span className="eyebrow">Result (sanitized, bounded)</span>
            <JsonBlock value={call.result} />
          </>
        ) : (
          <p className={styles.emptyState}>No result payload recorded.</p>
        )}
      </div>
    </details>
  );
}

const ROUND_ORDER = ["entities", "referent", "initial", "dependency"];

function roundSortKey(round: string): [number, number] {
  const loop = /^loop-(\d+)$/.exec(round);
  if (loop) return [ROUND_ORDER.length, Number(loop[1])];
  const index = ROUND_ORDER.indexOf(round);
  return [index === -1 ? ROUND_ORDER.length + 1 : index, 0];
}

function ToolReadsSection({ trace }: { trace: EdwardTurnTrace }) {
  const calls = trace.toolCalls ?? [];
  const groups = new Map<string, TraceToolCall[]>();
  for (const call of calls) {
    const list = groups.get(call.round) ?? [];
    list.push(call);
    groups.set(call.round, list);
  }
  const ordered = [...groups.entries()].sort((a, b) => {
    const [ka, na] = roundSortKey(a[0]);
    const [kb, nb] = roundSortKey(b[0]);
    return ka - kb || na - nb;
  });
  return (
    <section className={`card ${styles.section}`}>
      <div className={styles.sectionHead}>
        <Eyebrow concept="tool_round">Tool reads</Eyebrow>
        <span className={styles.turnMeta}>{calls.length} executed</span>
      </div>
      {calls.length === 0 ? (
        <p className={styles.emptyState}>No tools were read this turn.</p>
      ) : (
        ordered.map(([round, list]) => (
          <div key={round} className={styles.toolGroup}>
            <div className={styles.toolGroupTitle}>
              <span className={`${styles.roundBadge} ${roundBadgeClass(round)}`}>
                {roundLabel(round)}
              </span>
              <span>
                {list.length} read{list.length === 1 ? "" : "s"}
                {round === "dependency" ? " — one bounded verifying round" : ""}
              </span>
            </div>
            {list.map((call, index) => (
              <ToolCard key={`${call.tool}-${round}-${index}`} call={call} trace={trace} />
            ))}
          </div>
        ))
      )}
    </section>
  );
}

/* --- model calls ----------------------------------------------------------------------- */

function ModelCallsSection({ trace }: { trace: EdwardTurnTrace }) {
  const calls = trace.modelCalls ?? [];
  return (
    <section className={`card ${styles.section}`}>
      <div className={styles.sectionHead}>
        <Eyebrow concept="tokens">Model calls</Eyebrow>
        <span className={styles.turnMeta}>
          {trace.provider ? `${trace.provider} · ${trace.model ?? "?"}` : "no provider"}
        </span>
      </div>
      {calls.length === 0 ? (
        <p className={styles.emptyState}>
          No model call this turn — everything was deterministic.
        </p>
      ) : (
        calls.map((call: TraceModelCall, index) => {
          const ok =
            call.outcome === "accepted" || call.outcome === "step" || call.outcome === "recognized";
          return (
            <div key={`${call.operation}-${index}`} className={styles.modelCall}>
              <span className={ok ? styles.okDot : styles.failDot} aria-hidden />
              <span className={styles.toolName}>
                {modelCallLabel(call.operation)}
                {call.attempt > 1 || modelOperationIs(call, "assistant_read_loop")
                  ? ` · ${modelOperationIs(call, "assistant_read_loop") ? "round" : "attempt"} ${call.attempt}`
                  : ""}
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

/* --- evidence + guard ------------------------------------------------------------------------ */

function EvidenceSection({ trace }: { trace: EdwardTurnTrace }) {
  const evidence = trace.evidence ?? [];
  return (
    <section className={`card ${styles.section}`}>
      <div className={styles.sectionHead}>
        <Eyebrow concept="evidence">Evidence Edward reasoned from</Eyebrow>
        <span className={styles.turnMeta}>{evidence.length} facts</span>
      </div>
      {evidence.length === 0 ? (
        <p className={styles.emptyState}>
          No evidence corpus this turn
          {(trace.historyMessages ?? 0) > 0 && (trace.toolCalls ?? []).length === 0
            ? " — the answer was reasoned from conversation history alone (see Conversation context)."
            : " (conversational opener, gate, action plane, or replay)."}
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

function GroundingSection({ trace }: { trace: EdwardTurnTrace }) {
  const summary = summarizeTrace(trace);
  const verdict = summary.guard;
  const rejections = summary.guardRejections;
  const wroteProse =
    trace.responseSource === "model_prose" || trace.responseSource === "model_loop";
  const writer =
    trace.responseSource === "model_loop"
      ? "the read loop's answer"
      : trace.responseSource === "model_prose"
        ? "the composer's prose"
        : rejections.length > 0
          ? "the composer's prose"
          : trace.readLoop
            ? "the read loop's answer"
            : null;
  return (
    <section className={`card ${styles.section}`}>
      <div className={styles.sectionHead}>
        <Eyebrow concept="claim_guard">Grounding guard</Eyebrow>
        <span
          className={`${styles.statusBadge} ${
            verdict.verdict === "accepted"
              ? styles.statusGrounded
              : verdict.verdict === "rejected"
                ? styles.statusError
                : styles.statusNeutral
          }`}
        >
          {verdict.verdict === "accepted"
            ? "Accepted"
            : verdict.verdict === "rejected"
              ? "Rejected · see final response source"
              : "Not run"}
        </span>
      </div>
      {verdict.verdict === "not_run" ? (
        <p className={styles.emptyState}>
          The claim guard checks only model-written prose; nothing model-written reached the
          answer on this turn.
        </p>
      ) : (
        <dl className={styles.kvGrid}>
          <dt>Checked</dt>
          <dd>{writer ?? "model prose"}</dd>
          <dt>Verdict</dt>
          <dd className={wroteProse ? styles.toneOk : styles.toneBad}>
            {wroteProse
              ? "Configured grounding checks passed. This does not prove every claim is correct or complete."
              : `rejected: ${verdict.reason ?? "?"} — ${guardReasonLabel(verdict.reason)}`}
          </dd>
          {rejections.map((call, index) => (
            <div key={index} style={{ display: "contents" }}>
              <dt>
                {modelCallLabel(call.operation)} attempt {call.attempt}
              </dt>
              <dd className={styles.toneBad}>
                {call.detail ?? "guard_rejected"} — {guardReasonLabel(call.detail)}
              </dd>
            </div>
          ))}
          {trace.readLoop && trace.readLoop.guard !== "accepted" ? (
            <>
              <dt>Read loop</dt>
              <dd className={styles.toneBad}>
                {trace.readLoop.guard} — {guardReasonLabel(trace.readLoop.guard)}
                {trace.readLoop.ungrounded?.length
                  ? ` · ungrounded: ${trace.readLoop.ungrounded.join(", ")}`
                  : ""}
              </dd>
            </>
          ) : null}
          <dt>Final source</dt>
          <dd className={styles.mono}>{trace.responseSource ?? "deterministic"}</dd>
        </dl>
      )}
      {(trace.evidence ?? []).length === 0 && verdict.verdict === "accepted" ? (
        <p className={`${styles.failureBanner}`} style={{ marginTop: "0.5rem" }}>
          Accepted with an empty evidence corpus: the guard had nothing to check the prose
          against, so &ldquo;accepted&rdquo; here means &ldquo;made no groundable claim&rdquo;,
          not &ldquo;grounded&rdquo;.
        </p>
      ) : null}
    </section>
  );
}

/* --- latency --------------------------------------------------------------------------------- */

function LatencySection({ trace }: { trace: EdwardTurnTrace }) {
  const stages = trace.stages ?? [];
  const toolCalls = trace.toolCalls ?? [];
  const modelCalls = trace.modelCalls ?? [];
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
      details: Array<[string, string]>;
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
        model: stage.stage === "model_rewrite" || stage.stage === "read_loop",
        dependency: stage.stage === "dependency_reads",
        details: stageDetails(stage),
      });
      return { rows: acc.rows, elapsed: acc.elapsed + durationMs };
    },
    { rows: [], elapsed: 0 },
  ).rows;
  const maxTool = Math.max(...toolCalls.map((call) => call.durationMs ?? 0), 1);
  const maxModel = Math.max(...modelCalls.map((call) => call.durationMs ?? 0), 1);
  return (
    <section className={`card ${styles.section}`}>
      <div className={styles.sectionHead}>
        <span className="eyebrow">Latency</span>
        <span className={styles.turnMeta}>server total {formatMs(trace.durationMs)}</span>
      </div>
      {stageRows.length === 0 ? (
        <p className={styles.emptyState}>
          No pipeline stages recorded — this route ({pathLabel(trace.path)}) answered before
          the pipeline ran.
        </p>
      ) : null}
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
            {row.details.length > 0 ? (
              <span className={styles.stageDetail}>
                {row.details.map(([key, value]) => `${key}: ${value}`).join(" · ")}
              </span>
            ) : null}
          </div>
        ))}
        {modelCalls.map((call, index) => (
          <div key={`m-${call.operation}-${index}`} className={styles.waterfallRow}>
            <span className={`${styles.waterfallLabel} ${styles.waterfallLabelSub}`}>
              {modelCallLabel(call.operation)} {call.attempt}
            </span>
            <span className={styles.waterfallTrack}>
              <span
                className={`${styles.waterfallBar} ${styles.waterfallBarModel}`}
                style={{ width: `${Math.max(((call.durationMs ?? 0) / maxModel) * 100, 1)}%` }}
              />
            </span>
            <span className={styles.waterfallMs}>{formatMs(call.durationMs)}</span>
          </div>
        ))}
        {toolCalls.map((call, index) => (
          <div key={`t-${call.tool}-${index}`} className={styles.waterfallRow}>
            <span className={`${styles.waterfallLabel} ${styles.waterfallLabelSub}`}>
              {call.tool} · {roundLabel(call.round)}
            </span>
            <span className={styles.waterfallTrack}>
              <span
                className={`${styles.waterfallBar} ${
                  roundFamily(call.round) === "dependency"
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
        Stage bars are sequential on the turn&apos;s timeline. Model-call and tool bars below them
        are each scaled to the slowest of their kind, not to the timeline.
      </p>
    </section>
  );
}

/* --- inspector ---------------------------------------------------------------------------------- */

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
  const path = trace.path ?? "pipeline";
  const pipelineRan = path === "pipeline";
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
          <ContextSection trace={trace} />
          <RecognitionSection trace={trace} />
          {pipelineRan ? (
            <>
              <IdentitySection trace={trace} />
              <EntitiesSection trace={trace} />
              <RoutingSection trace={trace} />
              <ReadLoopSection trace={trace} />
              <ToolReadsSection trace={trace} />
              <ModelCallsSection trace={trace} />
              <EvidenceSection trace={trace} />
              <GroundingSection trace={trace} />
            </>
          ) : (
            <>
              <ToolReadsSection trace={trace} />
              <ModelCallsSection trace={trace} />
            </>
          )}
          <section className={`card ${styles.section}`} aria-label="Semantic response construction">
            <div className={styles.sectionHead}><strong>Response construction</strong><span>{String(trace.stages?.find(stage => stage.stage === "presentation")?.construction ?? "Construction stage not recorded")}</span></div>
            <p>{trace.stages?.some(stage => stage.stage === "presentation")
              ? "The recorded presentation stage built these response blocks from the answer and evidence. Inspect the payload for the recorded provenance."
              : "These are the recorded response blocks. This trace does not identify a separate presentation stage."}</p>
            {trace.responseBlocks?.length ? <>
              <ul>{trace.responseBlocks.map((block, index) => <li key={index}><code>{block.type}</code> · {block.provenance?.tool ?? (block.type === "sources" ? "Retrieved policy passages" : "Guarded prose or server context")}</li>)}</ul>
              <details><summary>Inspect semantic payload</summary><JsonBlock value={trace.responseBlocks} tall /></details>
            </> : <p>No semantic payload recorded on this older trace.</p>}
          </section>
          <section className={`card ${styles.section}`}><EdwardAnswerEvolution trace={trace} /></section>
          <LatencySection trace={trace} />
        </>
      )}
    </>
  );
}
