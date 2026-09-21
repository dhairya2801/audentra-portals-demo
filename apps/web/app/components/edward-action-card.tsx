"use client";

import type {
  EdwardActionIntent,
  EdwardActionReceipt,
  StaffEmailSendIntent,
} from "@vv/contracts";
import { useEffect, useMemo, useState } from "react";
import {
  cancelStaffEdwardAction,
  cancelStudentEdwardAction,
  confirmStaffEdwardAction,
  confirmStaffEmailSendIntent,
  confirmStudentEdwardAction,
  getStaffEdwardAction,
  getStudentEdwardAction,
} from "../lib/api-client";
import styles from "./edward-action-card.module.css";

function valueLabel(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value).replaceAll("_", " ");
}

function confirmationLabel(intent: EdwardActionIntent): string {
  if (intent.action === "communications.email.prepare") {
    return "Prepare for final send review";
  }
  if (intent.action === "operations.cohort.create_follow_ups") {
    return `Confirm and create ${intent.preview.cohort?.count ?? 0} follow-ups`;
  }
  if (intent.action === "student.preferences.update") return "Confirm update";
  if (intent.action === "student.support.contact") return "Create support request";
  if (intent.action === "operations.work_item.update") return "Confirm task update";
  if (intent.action === "operations.follow_up.create") return "Create follow-up";
  return "Confirm action";
}

function isEmailSendIntent(value: Record<string, unknown>): value is Record<
  string,
  unknown
> &
  StaffEmailSendIntent {
  return (
    typeof value.id === "string" &&
    typeof value.version === "number" &&
    typeof value.contentSha256 === "string" &&
    value.status === "pending_confirmation"
  );
}

export function EdwardActionCard({
  intent,
  actor,
  onApplied,
}: {
  intent: EdwardActionIntent;
  actor: "student" | "staff";
  onApplied?: () => void;
}) {
  const [status, setStatus] = useState(intent.status);
  const [receipt, setReceipt] = useState<EdwardActionReceipt | null>(
    intent.receipt ?? null,
  );
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const preview = intent.preview;
  // Who an internal request reaches. A student who is told a request was
  // opened, and not who will see it, has to ask a second question.
  const routedTo = useMemo(() => {
    const routes = preview.routesTo;
    if (!routes) return null;
    const adviser = routes.adviser
      ? [routes.adviser.name, routes.adviser.title].filter(Boolean).join(" — ")
      : null;
    return [routes.office, adviser].filter(Boolean).join(" · ") || null;
  }, [preview.routesTo]);
  const needsExplicitReview =
    intent.confirmationMode === "strong_confirm" ||
    intent.confirmationMode === "external_confirm";
  const expiresLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(intent.expiresAt)),
    [intent.expiresAt],
  );

  const refresh = async () => {
    const current =
      actor === "staff"
        ? await getStaffEdwardAction(intent.id)
        : await getStudentEdwardAction(intent.id);
    setStatus(current.status);
    setReceipt(current.receipt ?? null);
    return current;
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const current =
          actor === "staff"
            ? await getStaffEdwardAction(intent.id)
            : await getStudentEdwardAction(intent.id);
        if (mounted) {
          setStatus(current.status);
          setReceipt(current.receipt ?? null);
        }
      } catch {
        // The original server preview remains useful if a background refresh
        // is temporarily unavailable. Confirmation will still fail closed.
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [actor, intent.id]);

  const confirm = async () => {
    if (needsExplicitReview && !reviewed) return;
    setBusy(true);
    setError(null);
    try {
      const input = {
        expectedVersion: intent.version,
        contentSha256: intent.contentSha256,
      };
      const next =
        actor === "staff"
          ? await confirmStaffEdwardAction(intent.id, input)
          : await confirmStudentEdwardAction(intent.id, input);
      setReceipt(next);
      setStatus(next.status);
      if (next.status === "succeeded") onApplied?.();
    } catch (caught) {
      try {
        const current = await refresh();
        if (current.receipt?.status === "succeeded") onApplied?.();
        if (!current.receipt) {
          setError(
            caught instanceof Error ? caught.message : "Edward could not complete the action.",
          );
        }
      } catch {
        setError(caught instanceof Error ? caught.message : "Edward could not complete the action.");
      }
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      if (actor === "staff") {
        await cancelStaffEdwardAction(intent.id, { expectedVersion: intent.version });
      } else {
        await cancelStudentEdwardAction(intent.id, { expectedVersion: intent.version });
      }
      setStatus("cancelled");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The preview could not be cancelled.");
    } finally {
      setBusy(false);
    }
  };

  const queueEmail = async () => {
    if (!receipt || !isEmailSendIntent(receipt.result)) return;
    setBusy(true);
    setError(null);
    try {
      const next = await confirmStaffEmailSendIntent(receipt.result.id, {
        expectedVersion: receipt.result.version,
        contentSha256: receipt.result.contentSha256,
      });
      setEmailStatus(next.status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The email could not be queued.");
    } finally {
      setBusy(false);
    }
  };

  if (status === "cancelled") {
    return (
      <section className={`${styles.card} ${styles.inactive}`} aria-label="Cancelled action">
        <strong>Action cancelled</strong>
        <p>No changes were made.</p>
      </section>
    );
  }

  if (receipt) {
    const succeeded = receipt.status === "succeeded";
    const savedChanges = succeeded && Array.isArray(receipt.result.changes)
      ? receipt.result.changes.filter(
          (change): change is { field: string; after: unknown } =>
            change !== null && typeof change === "object" &&
            typeof change.field === "string" && "after" in change,
        )
      : [];
    const emailIntent = succeeded && isEmailSendIntent(receipt.result) ? receipt.result : null;
    const outcomeTitle =
      receipt.status === "failed"
        ? "Not completed"
        : receipt.status === "partial"
          ? "Partially completed"
          : "Completed";
    return (
      <section
        className={`${styles.card} ${receipt.status === "failed" ? styles.failed : styles.receipt}`}
        aria-label="Action receipt"
      >
        <div className={styles.heading}>
          <span className={receipt.status === "failed" ? styles.failureMark : styles.receiptMark}>
            {receipt.status === "failed" ? "!" : "✓"}
          </span>
          <div>
            <strong>{outcomeTitle}</strong>
            <p>
              {preview.title}
            </p>
          </div>
        </div>
        {savedChanges.length ? (
          <dl className={styles.details}>
            {savedChanges.map((change) => (
              <div key={change.field}>
                <dt>{valueLabel(change.field).replace(/([a-z])([A-Z])/g, "$1 $2")}</dt>
                <dd>{valueLabel(change.after)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {receipt.status === "failed" ? (
          <p className={styles.error}>
            {String(receipt.result.message ?? "The action did not complete. Review a fresh preview before retrying.")}
          </p>
        ) : null}
        {emailIntent && emailStatus === null ? (
          <div className={styles.externalStep}>
            <strong>Final email review</strong>
            <p>
              The message is prepared but has not been sent. This separate confirmation queues
              the exact message below.
            </p>
            <dl className={styles.details}>
              <div><dt>From</dt><dd>{emailIntent.sender}</dd></div>
              <div><dt>To</dt><dd>{emailIntent.recipients.join(", ")}</dd></div>
              <div><dt>Subject</dt><dd>{emailIntent.subject}</dd></div>
            </dl>
            <pre className={styles.emailBody}>{emailIntent.body}</pre>
            <button type="button" className={styles.dangerButton} onClick={queueEmail} disabled={busy}>
              {busy ? "Queuing…" : "Queue email for sending"}
            </button>
          </div>
        ) : emailStatus ? (
          <p className={styles.successText}>Email status: {valueLabel(emailStatus)}.</p>
        ) : null}
        <details className={styles.receiptDetails}>
          <summary>Receipt details</summary>
          <span>{receipt.affectedCount} {receipt.affectedCount === 1 ? "record" : "records"} changed</span>
          <code>{receipt.receiptSha256.slice(0, 16)}…</code>
          <span>{new Date(receipt.committedAt).toLocaleString()}</span>
        </details>
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>
    );
  }

  if (status !== "pending_confirmation") {
    const copy =
      status === "executing"
        ? "Edward is verifying the execution result. It is not safe to submit it again yet."
        : status === "expired"
          ? "This preview expired without making a change. Ask Edward for a fresh preview."
          : "This action is no longer confirmable.";
    return (
      <section className={`${styles.card} ${styles.inactive}`} aria-label="Inactive action">
        <strong>{status === "executing" ? "Execution pending" : "Preview unavailable"}</strong>
        <p>{copy}</p>
      </section>
    );
  }

  return (
    <section className={styles.card} aria-label="Edward action preview">
      <div className={styles.heading}>
        <span className={styles.risk}>Review change</span>
        <div>
          <strong>{preview.title}</strong>
          <p>{preview.summary}</p>
        </div>
      </div>

      {preview.student || preview.recipient ? (
        <dl className={styles.details}>
          <div>
            <dt>{preview.recipient ? "Recipient" : "Student"}</dt>
            <dd>
              {(preview.recipient ?? preview.student)?.name}
              {preview.recipient?.address ? (
                <span className={styles.subtle}> · {preview.recipient.address}</span>
              ) : null}
            </dd>
          </div>
        </dl>
      ) : null}

      {preview.changes?.length ? (
        <div className={styles.changes}>
          {preview.changes.map((change) => (
            <div key={change.field}>
              <span>{valueLabel(change.field)}</span>
              <del>{valueLabel(change.before)}</del>
              <span aria-hidden="true">→</span>
              <ins>{valueLabel(change.after)}</ins>
            </div>
          ))}
        </div>
      ) : null}

      {preview.requirement ? (
        <dl className={styles.details}>
          <div>
            <dt>Requirement</dt>
            <dd>{preview.requirement.title}</dd>
          </div>
          <div>
            <dt>Current status</dt>
            <dd>{valueLabel(preview.requirement.status)}</dd>
          </div>
        </dl>
      ) : null}

      {preview.workItem ? (
        <dl className={styles.details}>
          {Object.entries(preview.workItem).map(([field, value]) =>
            value === null || value === undefined || value === "" ? null : (
              <div key={field}>
                <dt>{valueLabel(field)}</dt>
                <dd>{valueLabel(value)}</dd>
              </div>
            ),
          )}
        </dl>
      ) : null}

      {preview.response ? (
        <dl className={styles.details}>
          {Object.entries(preview.response).map(([field, value]) => (
            <div key={field}>
              <dt>{valueLabel(field)}</dt>
              <dd>{valueLabel(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {preview.cohort ? (
        <div className={styles.cohort}>
          <strong>{preview.cohort.count} students match</strong>
          <p>{preview.cohort.description.join(" · ")}</p>
          <ul>
            {preview.cohort.sample.map((student) => (
              <li key={student.id}>
                {student.name}{student.program ? ` · ${student.program}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview.topic || preview.message ? (
        <dl className={styles.details}>
          {preview.topic ? (
            <div>
              <dt>Topic</dt>
              <dd>{valueLabel(preview.topic)}</dd>
            </div>
          ) : null}
          {preview.message ? (
            <div>
              <dt>Message</dt>
              <dd>{preview.message}</dd>
            </div>
          ) : null}
          {routedTo ? (
            <div>
              <dt>Goes to</dt>
              <dd>{routedTo}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {preview.subject || preview.body ? (
        <div className={styles.email}>
          {preview.sender ? <p><b>From:</b> {preview.sender}</p> : null}
          {preview.subject ? <p><b>Subject:</b> {preview.subject}</p> : null}
          {preview.body ? <pre>{preview.body}</pre> : null}
        </div>
      ) : null}

      {preview.warnings?.length ? (
        <ul className={styles.warnings}>
          {preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}

      {intent.provenance.length ? (
        <details className={styles.provenance}>
          <summary>Sources used for this preview</summary>
          <ul>
            {intent.provenance.map((source) => (
              <li key={`${source.kind}:${source.source}`}>
                {valueLabel(source.kind)} · {valueLabel(source.source)}
                {source.factTrusted ? " · canonical fact source" : " · untrusted/derived content"}
                {" · never action authority"}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {needsExplicitReview ? (
        <label className={styles.acknowledge}>
          <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
          <span>I reviewed the target, scope, and exact effect.</span>
        </label>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={intent.riskClass === 4 ? styles.dangerButton : styles.confirmButton}
          disabled={busy || (needsExplicitReview && !reviewed)}
          onClick={confirm}
        >
          {busy ? "Working…" : confirmationLabel(intent)}
        </button>
        <button type="button" className={styles.cancelButton} disabled={busy} onClick={cancel}>
          Cancel
        </button>
      </div>
      <p className={styles.expiry}>Preview expires at {expiresLabel}. Nothing changes until you confirm.</p>
      {error ? <p className={styles.error}>{error}</p> : null}
    </section>
  );
}
