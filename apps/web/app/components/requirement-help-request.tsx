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
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import StatusPill from "../design-system/primitives/StatusPill.jsx";
import Notice from "../design-system/patterns/Notice.jsx";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  createStudentHelpRequest,
  getStudentHelp,
} from "../lib/api-client";
import { useTenant } from "./tenant-provider";

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

/**
 * The route to a person, at the foot of the step — after Edward, never before
 * it (the door rule). It is the reference `help-note` sentence, and the ask
 * opens in place as a `form-panel`; what it sends is the production help
 * request, with the requirement named in it.
 */
export function RequirementHelpRequest({
  requirement,
  onHelpStateChange,
}: {
  requirement: StudentRequirementDetail;
  onHelpStateChange: (requested: boolean) => void;
}) {
  const { tenant, href } = useTenant();
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
      <Notice
        tone="working"
        icon="help"
        title="Your enrollment team has this"
        action={{ label: "View the conversation", href: href("/help") }}
      >
        Your question about {requirement.title} is with {tenant.shortName}. You
        can keep going with the step while they answer.
      </Notice>
    );
  }

  return (
    <div className="requirement-help">
      {help.status === "error" ? (
        <Notice
          tone="quiet"
          icon="info"
          action={{ label: "Check again", icon: "refresh", onClick: help.reload }}
        >
          Earlier requests could not be checked. You can still send this one safely.
        </Notice>
      ) : help.refreshError ? (
        <Notice
          tone="quiet"
          icon="info"
          action={{ label: "Check again", icon: "refresh", onClick: help.refresh }}
        >
          Earlier request status may be out of date.
        </Notice>
      ) : null}

      {expanded ? (
        <form
          id={`requirement-help-form-${requirement.id}`}
          className="requirement-form"
          onSubmit={submit}
        >
          <label className="field" htmlFor={`requirement-help-${requirement.id}`}>
            <span className="field-label">What do you need help with?</span>
            <span className="field-control">
              <textarea
                id={`requirement-help-${requirement.id}`}
                value={studentNote}
                onChange={(event) => setStudentNote(event.target.value)}
                minLength={1}
                maxLength={maximumStudentNoteLength}
                placeholder="Say what is blocking you or what you want cleared up."
                disabled={createRequest.status === "loading"}
                required
                autoFocus
                rows={4}
                aria-describedby={`requirement-help-limit-${requirement.id}`}
              />
            </span>
            <small
              id={`requirement-help-limit-${requirement.id}`}
              className="field-hint"
            >
              This step is named in your message, so the team answers with the
              right context. {maximumStudentNoteLength - studentNote.length}{" "}
              characters left.
            </small>
          </label>
          {createRequest.message ? (
            <p className="field-error" role="alert">
              <Icon name="alert" size={13} /> {createRequest.message} Your message
              is still here; try again when you are ready.
            </p>
          ) : null}
          <div className="upload-failed-actions">
            <Button
              kind="primary"
              icon="send"
              type="submit"
              pending={createRequest.status === "loading"}
              disabled={!studentNote.trim()}
            >
              {createRequest.status === "error" ? "Try again" : "Send to the enrollment team"}
            </Button>
            <button
              className="secondary-button"
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
        <div className="help-note">
          <Icon name="help" size={18} />
          <p>
            <strong>Still unsure?</strong> Ask your enrollment team about this exact
            step. Usually replies in 1 business day.{" "}
            <button
              className="link-button"
              type="button"
              aria-expanded="false"
              aria-controls={`requirement-help-form-${requirement.id}`}
              onClick={() => setExpanded(true)}
            >
              Write to them <Icon name="arrow" size={14} />
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

export function RequirementHelpRequestedStatus() {
  return (
    <StatusPill tone="wait" pulse>
      Help requested
    </StatusPill>
  );
}
