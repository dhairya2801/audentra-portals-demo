"use client";

import { type EdwardTurnTrace, type TraceTextSnapshot, guardReasonLabel, modelOperationIs } from "../lib/edward-lab";
import styles from "./edward-lab.module.css";

function RecordedText({ label, snapshot }: { label: string; snapshot: TraceTextSnapshot }) {
  return <div className={styles.archNote}>
    <span className={styles.archNoteLabel}>{label}</span>
    <p className={styles.answerText}>{snapshot.text || "(empty text)"}</p>
    {snapshot.truncated ? <span className={styles.compareWarning}>
      Recorded excerpt · original {snapshot.characters.toLocaleString()} characters. The omitted text cannot be compared.
    </span> : null}
  </div>;
}

/** Same-turn input/output evidence, shared by Architecture and Chat + trace. */
export function EdwardAnswerEvolution({ trace, draftOnly = false }: { trace: EdwardTurnTrace; draftOnly?: boolean }) {
  const draft = trace.deterministicDraft;
  const calls = (trace.modelCalls ?? []).filter(call => modelOperationIs(call, "assistant_composer"));
  const composed = Boolean(draft) || trace.stages?.some(stage => stage.stage === "compose_deterministic") || calls.length > 0 || trace.responseSource === "model_prose";
  const loopAnswer = trace.responseSource === "model_loop";
  return <section className={styles.answerEvolution} aria-label={draftOnly ? "Deterministic draft" : "Answer evolution"}>
    <h4>{draftOnly ? "Deterministic draft" : "How this answer was produced"}</h4>
    {draft ? <RecordedText label="Before · deterministic draft" snapshot={draft} /> : <p className={styles.archHelp}>
      {loopAnswer
        ? "No deterministic draft was produced on this route. The read-loop model wrote the answer from tool evidence."
        : composed
          ? "The deterministic draft was not recorded in this older trace. It cannot be reconstructed from the final response. Run a new turn to capture it."
          : "This route did not record a deterministic composition or prose rewrite."}
    </p>}
    {!draftOnly ? <>
      {calls.map((call, index) => <details key={`${call.attempt}-${index}`} className={`${styles.compactCall} ${styles.answerAttempt}`} open={call.outcome === "accepted"}>
        <summary>Model rewrite · attempt {call.attempt} · {call.outcome === "guard_rejected" ? "rejected" : call.outcome.replaceAll("_", " ")}</summary>
        {call.detail ? <p className={styles.archHelp}>{guardReasonLabel(call.detail)}</p> : null}
        {call.answer ? <RecordedText label="Model output · before server post-processing" snapshot={call.answer} /> : <p className={styles.archHelp}>Model output text was not recorded for this attempt.</p>}
      </details>)}
      {trace.finalMessage !== undefined ? <RecordedText label={trace.responseSource === "model_prose" ? "After · final response sent" : "Final response sent"}
        snapshot={{ text: trace.finalMessage, characters: trace.finalMessage.length, truncated: false }} /> : <p className={styles.archHelp}>Final response text was not recorded.</p>}
      {trace.finalMessageTruncated || (trace.finalMessageTruncated === undefined && trace.finalMessage?.endsWith("…")) ? <p className={styles.compareWarning}>The final response is a recorded excerpt; the trace does not contain the complete answer.</p> : null}
      {draft && trace.finalMessage && !draft.truncated && trace.finalMessageTruncated === false ? <p className={styles.archHelp}>
        {draft.text === trace.finalMessage
          ? "The final response matches the deterministic draft."
          : trace.responseSource === "model_prose"
            ? "The final response differs from the draft. Accepted model text can also be adjusted by server checks before delivery."
            : "The final response differs from the draft; the recorded source determines which fallback or server processing was used."}
      </p> : null}
    </> : null}
  </section>;
}
