"use client";

import type {
  StudentHelpRequest,
  StudentRequirementDetail,
} from "@vv/contracts";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  createStudentHelpRequest,
  getStudentHelp,
} from "../lib/api-client";
import { TenantLink as Link } from "./tenant-link";
import { useTenant } from "./tenant-provider";
import styles from "./requirement-help-request.module.css";

const activeHelpStatuses = new Set<StudentHelpRequest["status"]>([
  "new",
  "open",
  "waiting_on_student",
]);
const maximumHelpRequestMessageLength = 500;

function requirementReference(requirement: StudentRequirementDetail) {
  return [
    `Requirement code: ${requirement.code}`,
    `Requirement page: /enrollment/requirements/${requirement.slug}`,
  ].join("\n");
}

function isActiveRequestForRequirement(
  request: StudentHelpRequest,
  requirement: StudentRequirementDetail,
) {
  if (!activeHelpStatuses.has(request.status)) return false;
  if (request.requirementId) return request.requirementId === requirement.id;
  return request.message.includes(requirementReference(requirement));
}

function helpTopicForRequirement(requirement: StudentRequirementDetail) {
  if (requirement.submissionType === "document") return "documents" as const;
  if (requirement.submissionType === "payment") return "payments" as const;
  return "support" as const;
}

function helpMessageForRequirement(
  requirement: StudentRequirementDetail,
  studentNote: string,
) {
  // The backend currently exposes a strict topicCode/message contract. Keeping
  // this stable reference in the durable message preserves exact item context
  // until requirementId becomes a first-class help-request field.
  return [
    `I need help with \"${requirement.title}\".`,
    requirementReference(requirement),
    `Student note: ${studentNote.trim()}`,
  ].join("\n");
}

export function RequirementHelpRequest({
  requirement,
  onHelpStateChange,
}: {
  requirement: StudentRequirementDetail;
  onHelpStateChange: (requested: boolean) => void;
}) {
  const { tenant } = useTenant();
  const [expanded, setExpanded] = useState(false);
  const [studentNote, setStudentNote] = useState("");
  const [optimisticRequest, setOptimisticRequest] =
    useState<StudentHelpRequest | null>(null);
  const createRequest = useApiAction(createStudentHelpRequest);
  const loadHelp = useCallback(
    (signal: AbortSignal) => getStudentHelp(signal),
    [],
  );
  const help = useApiResource(loadHelp);
  const serverRequest = useMemo(
    () =>
      help.data?.requests.find((request) =>
        isActiveRequestForRequirement(request, requirement),
      ) ?? null,
    [help.data, requirement],
  );
  const activeRequest =
    serverRequest ??
    (optimisticRequest && activeHelpStatuses.has(optimisticRequest.status)
      ? optimisticRequest
      : null);
  const maximumStudentNoteLength = Math.max(
    1,
    maximumHelpRequestMessageLength -
      helpMessageForRequirement(requirement, "").length,
  );

  useEffect(() => {
    if (help.status !== "ready" && !optimisticRequest) return;
    onHelpStateChange(Boolean(activeRequest));
  }, [activeRequest, help.status, onHelpStateChange, optimisticRequest]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const note = studentNote.trim();
    if (!note) return;
    createRequest.reset();

    try {
      const created = await createRequest.run(
        {
          topicCode: helpTopicForRequirement(requirement),
          message: helpMessageForRequirement(requirement, note),
          requirementId: requirement.id,
        },
        crypto.randomUUID(),
      );
      setOptimisticRequest(created);
      setStudentNote("");
      setExpanded(false);
      onHelpStateChange(true);
      help.refresh();
    } catch {
      // Keep the student's note and expanded form in place for a safe retry.
    }
  };

  if (activeRequest) {
    return (
      <section
        className={`${styles.card} ${styles.requested}`}
        aria-labelledby="requirement-help-title"
      >
        <span className={styles.icon} aria-hidden="true">
          ?
        </span>
        <div className={styles.copy}>
          <span className={styles.state}>Help requested</span>
          <h3 id="requirement-help-title">Your support team has this item</h3>
          <p>
            Your request is linked to <strong>{requirement.title}</strong>. You
            can continue this task while {tenant.shortName} reviews your question.
          </p>
        </div>
        <Link className={styles.historyLink} href="/help">
          View conversation <span aria-hidden="true">→</span>
        </Link>
      </section>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="requirement-help-title">
      <span className={styles.icon} aria-hidden="true">
        ?
      </span>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>Need help with this step?</p>
        <h3 id="requirement-help-title">Ask about this exact requirement</h3>
        <p>
          Your message will include this requirement so the enrollment team can
          respond with the right context.
        </p>
        {help.status === "error" ? (
          <div className={styles.lookupWarning} role="status">
            <span>
              We could not check earlier requests. You can still send this one safely.
            </span>
            <button type="button" onClick={help.reload}>
              Retry status check
            </button>
          </div>
        ) : help.refreshError ? (
          <div className={styles.lookupWarning} role="status">
            <span>Earlier request status may be out of date.</span>
            <button type="button" onClick={help.refresh}>
              Check again
            </button>
          </div>
        ) : null}
        {expanded ? (
          <form
            id={`requirement-help-form-${requirement.id}`}
            className={styles.form}
            onSubmit={submit}
          >
            <label htmlFor={`requirement-help-${requirement.id}`}>
              What do you need help with?
            </label>
            <textarea
              id={`requirement-help-${requirement.id}`}
              value={studentNote}
              onChange={(event) => setStudentNote(event.target.value)}
              minLength={1}
              maxLength={maximumStudentNoteLength}
              placeholder="Describe what is blocking you or what you need clarified."
              disabled={createRequest.status === "loading"}
              required
              autoFocus
              aria-describedby={`requirement-help-limit-${requirement.id}`}
            />
            <small
              id={`requirement-help-limit-${requirement.id}`}
              className={styles.formHint}
            >
              {maximumStudentNoteLength - studentNote.length} characters remaining
            </small>
            {createRequest.message ? (
              <p className={styles.error} role="alert">
                {createRequest.message} Your message is still here; try again when
                you are ready.
              </p>
            ) : null}
            <div className={styles.formActions}>
              <button
                className="button button--accent"
                type="submit"
                disabled={
                  createRequest.status === "loading" || !studentNote.trim()
                }
              >
                {createRequest.status === "loading"
                  ? "Sending request…"
                  : createRequest.status === "error"
                    ? "Try again"
                    : "Send help request"}
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => {
                  createRequest.reset();
                  setExpanded(false);
                }}
                disabled={createRequest.status === "loading"}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            className={`button button--secondary ${styles.openButton}`}
            type="button"
            aria-expanded="false"
            aria-controls={`requirement-help-form-${requirement.id}`}
            onClick={() => setExpanded(true)}
          >
            Request help
          </button>
        )}
      </div>
    </section>
  );
}

export function RequirementHelpRequestedStatus() {
  return (
    <span className={styles.helpRequestedStatus} role="status">
      <span aria-hidden="true" />
      Help requested
    </span>
  );
}
