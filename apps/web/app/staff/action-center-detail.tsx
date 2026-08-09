"use client";

import type {
  StaffActionCenter,
  StaffAiProcessingState,
  StaffCallRecording,
  StaffCommunicationChannel,
  StaffInteraction,
  StaffWorkItemDetail,
  StaffWorkItemStatus,
} from "@vv/contracts";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ApiClientError,
  completeStaffInteraction,
  createStaffWorkComment,
  getStaffCallRecordingContent,
  getStaffWorkItemDetail,
  recordStaffCommunication,
  requestStaffAiRefresh,
  retryStaffCallTranscription,
  startStaffInteraction,
  updateStaffWorkItem,
  uploadStaffCallRecording,
} from "../lib/api-client";

type DetailTab = "overview" | "next_step" | "outcomes" | "comments" | "history";

const tabs: Array<{ id: DetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "next_step", label: "Next Step" },
  { id: "outcomes", label: "Outcomes" },
  { id: "comments", label: "Comments" },
  { id: "history", label: "History" },
];

const channels: Array<{
  id: StaffCommunicationChannel;
  label: string;
  guidance: string;
}> = [
  { id: "voice", label: "Phone call", guidance: "Best for a live conversation" },
  { id: "email", label: "Email", guidance: "Best for detailed information" },
  { id: "portal", label: "Portal message", guidance: "Delivered in the student portal" },
  { id: "sms", label: "Text message", guidance: "Record a concise mobile follow-up" },
];

function ActionChannelIcon({
  channel,
}: {
  channel: StaffCommunicationChannel | null;
}) {
  if (channel === "voice") {
    return (
      <svg viewBox="0 0 24 24" role="img" aria-label="Phone call">
        <path d="M7.1 3.5 9.7 7l-1.8 2.2c1.2 2.6 3.3 4.7 5.9 5.9l2.2-1.8 3.5 2.6-.8 3.4c-.2.8-.9 1.3-1.7 1.2C9.8 19.7 4.3 14.2 3.5 7c-.1-.8.4-1.5 1.2-1.7l2.4-.8Z" />
      </svg>
    );
  }
  if (channel === "email") {
    return (
      <svg viewBox="0 0 24 24" role="img" aria-label="Email">
        <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
        <path d="m5 7 7 5 7-5" />
      </svg>
    );
  }
  if (channel === "sms" || channel === "portal") {
    return (
      <svg viewBox="0 0 24 24" role="img" aria-label={channel === "sms" ? "Text message" : "Portal message"}>
        <path d="M5.5 5h13A2.5 2.5 0 0 1 21 7.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-5.5 3v-3.5A2.5 2.5 0 0 1 3 14.2V7.5A2.5 2.5 0 0 1 5.5 5Z" />
        <path d="M7 9h10M7 13h7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Enrollment action">
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 3.5h6V7H9zM8.5 11h7M8.5 15h5" />
    </svg>
  );
}

const terminalStatuses = new Set<StaffWorkItemStatus>(["done", "cancelled"]);

function dateTime(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function detailSignature(detail: StaffWorkItemDetail) {
  return JSON.stringify({
    work: [detail.workItem.version, detail.workItem.updatedAt],
    taskInsight: [detail.taskInsight.version, detail.taskInsight.state],
    summary: [detail.studentSummary.version, detail.studentSummary.state],
    interactions: detail.interactions.map((interaction) => [
      interaction.id,
      interaction.version,
      interaction.sourceVersion,
      interaction.coveredSourceVersion,
      interaction.outcome?.version ?? null,
      interaction.aiState,
      interaction.recordings.map((recording) => [
        recording.id,
        recording.status,
        recording.version,
        recording.currentTranscript?.version ?? null,
      ]),
    ]),
    comments: detail.comments.map((comment) => comment.id),
    history: detail.workItem.history.map((event) => event.id),
  });
}

function aiLabel(state: StaffAiProcessingState) {
  switch (state) {
    case "pending":
      return "Queued";
    case "running":
      return "Generating";
    case "ready":
      return "Ready";
    case "stale":
      return "Updating";
    case "failed_retryable":
      return "Needs retry";
    case "dead_letter":
      return "Review required";
    default:
      return "Not generated";
  }
}

function isAiBusy(state: StaffAiProcessingState) {
  return state === "pending" || state === "running" || state === "stale";
}

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 409) {
      return "This action changed in another session. The latest version has been loaded.";
    }
    if (error.status === 404) {
      return "This action is no longer active. Return to the board for the current work.";
    }
    return error.message;
  }
  return "The action could not be completed. Try again without losing your entered text.";
}

export function ActionCenterDetail({
  workItemId,
  center,
  currentStaffId,
  presentation = "page",
  onBack,
  onChanged,
}: {
  workItemId: string;
  center: StaffActionCenter;
  currentStaffId: string;
  presentation?: "page" | "dialog";
  onBack: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<StaffWorkItemDetail | null>(null);
  const detailRef = useRef<StaffWorkItemDetail | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<StaffWorkItemDetail | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [channel, setChannel] = useState<StaffCommunicationChannel>("voice");
  const [activeInteractionId, setActiveInteractionId] = useState<string | null>(null);

  const applyDetail = useCallback((next: StaffWorkItemDetail) => {
    detailRef.current = next;
    setDetail(next);
    setFatalError(null);
    setAvailableUpdate(null);
    setChannel(
      next.workItem.selectedChannel ??
        next.interactions[0]?.selectedChannel ??
        next.taskInsight.suggestedChannel ??
        "voice",
    );
    setActiveInteractionId((current) =>
      next.interactions.some((interaction) => interaction.id === current)
        ? current
        : (next.interactions[0]?.id ?? null),
    );
  }, []);

  const fetchLatest = useCallback(
    async (mode: "replace" | "compare" = "replace", signal?: AbortSignal) => {
      const next = await getStaffWorkItemDetail(workItemId, signal);
      const current = detailRef.current;
      if (
        mode === "compare" &&
        current &&
        detailSignature(current) !== detailSignature(next)
      ) {
        setAvailableUpdate(next);
      } else if (mode === "replace" || !current) {
        applyDetail(next);
      }
      return next;
    },
    [applyDetail, workItemId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchLatest("replace", controller.signal)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setFatalError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [fetchLatest]);

  useEffect(() => {
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible" && !busy) {
        void fetchLatest("compare").catch(() => undefined);
      }
    }, 10_000);
    return () => window.clearInterval(poll);
  }, [busy, fetchLatest]);

  const runMutation = async (
    label: string,
    mutation: () => Promise<StaffWorkItemDetail | void>,
    success: string,
  ) => {
    setBusy(label);
    setMessage(null);
    try {
      const next = await mutation();
      if (next) applyDetail(next);
      else await fetchLatest("replace");
      setMessage(success);
      onChanged();
      return true;
    } catch (error) {
      setMessage(errorMessage(error));
      if (error instanceof ApiClientError && (error.status === 404 || error.status === 409)) {
        await fetchLatest("replace").catch(() => undefined);
      }
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="action-detail-state">Loading the action record...</div>;
  }
  if (!detail || fatalError) {
    return (
      <div className="action-detail-state" role="alert">
        <h2>Action unavailable</h2>
        <p>{fatalError ?? "The action record could not be loaded."}</p>
        <button type="button" onClick={onBack}>Return to task board</button>
      </div>
    );
  }

  const item = detail.workItem;
  const activeInteraction =
    detail.interactions.find((interaction) => interaction.id === activeInteractionId) ??
    detail.interactions[0] ??
    null;
  const selectedChannel = channels.find((candidate) => candidate.id === channel)!;
  const isTerminal = terminalStatuses.has(item.status);

  const start = async () => {
    if (isTerminal) return null;
    const succeeded = await runMutation(
      "start-interaction",
      () =>
        startStaffInteraction(
          item.id,
          {
            expectedWorkItemVersion: item.version,
            channel,
            objective: item.title,
          },
          crypto.randomUUID(),
        ),
      `${selectedChannel.label} selected.`,
    );
    return succeeded ? detailRef.current : null;
  };

  const retryAi = async (
    scope: "interaction" | "student_summary" | "task_insight" | "both",
  ) => {
    await runMutation(
      "ai-refresh",
      () =>
        requestStaffAiRefresh(item.id, {
          expectedWorkItemVersion: item.version,
          scope,
          ...((scope === "interaction" || scope === "both") && activeInteraction
            ? { interactionId: activeInteraction.id }
            : {}),
        }),
      "AI refresh queued. Source records remain available while it runs.",
    );
  };

  return (
    <section
      className={"action-detail action-detail--" + presentation}
      aria-label={`Action ${item.key}`}
    >
      {availableUpdate ? (
        <div className="action-update-banner" role="status">
          <div>
            <strong>New activity is available</strong>
            <span>
              A message, outcome, or AI summary changed. Your current form values were not
              replaced.
            </span>
          </div>
          <button type="button" onClick={() => applyDetail(availableUpdate)}>
            Load update
          </button>
        </div>
      ) : null}

      {presentation === "page" ? (
        <button className="action-back" type="button" onClick={onBack}>
          Back to task board
        </button>
      ) : null}
      <header className="action-detail__header">
        <div className="action-detail__identity">
          <span className="action-detail__channel" aria-hidden="true">
            <ActionChannelIcon channel={item.selectedChannel} />
          </span>
          <div>
            <p className="action-breadcrumb">My work / Enrollment activity center / {item.key}</p>
            <h1>{item.title}</h1>
            <div className="action-detail__meta">
              <span className={`action-status action-status--${item.status}`}>
                {readable(item.status)}
              </span>
              <span className={`staff-priority staff-priority--${item.priority}`}>
                {item.priority} priority
              </span>
              <span>{item.key}</span>
              <span>Due {dateTime(item.dueAt)}</span>
            </div>
          </div>
        </div>
        <div className="action-detail__header-actions">
          <button
            className="action-primary-button"
            type="button"
            disabled={isTerminal}
            onClick={() => setTab("outcomes")}
          >
            {isTerminal ? readable(item.status) : "Mark complete"}
          </button>
          <button type="button" onClick={() => setTab("overview")}>More</button>
        </div>
      </header>

      <nav className="action-tabs" aria-label="Action sections">
        {tabs.map((candidate) => (
          <button
            type="button"
            className={tab === candidate.id ? "is-active" : undefined}
            aria-current={tab === candidate.id ? "page" : undefined}
            onClick={() => setTab(candidate.id)}
            key={candidate.id}
          >
            {candidate.label}
            {candidate.id === "comments" && detail.comments.length > 0
              ? ` (${detail.comments.length})`
              : ""}
          </button>
        ))}
      </nav>

      {message ? <p className="action-inline-message" role="status">{message}</p> : null}

      <div className="action-detail__layout">
        <main className="action-detail__main">
          {tab === "overview" ? (
            <OverviewTab
              detail={detail}
              busy={busy}
              onUpdate={async (input) => {
                await runMutation(
                  "work-update",
                  async () => {
                    await updateStaffWorkItem(item.id, {
                      expectedVersion: item.version,
                      ...input,
                    });
                  },
                  "Action updated.",
                );
              }}
              onRetry={(scope) => void retryAi(scope)}
            />
          ) : null}

          {tab === "next_step" ? (
            <NextStepTab
              itemTerminal={isTerminal}
              detail={detail}
              channel={channel}
              activeInteraction={activeInteraction}
              busy={busy}
              onChannel={setChannel}
              onStart={() => void start()}
              onRecord={async (event) => {
                event.preventDefault();
                const formElement = event.currentTarget;
                const form = new FormData(formElement);
                const body = String(form.get("body") ?? "").trim();
                if (!body) return;
                let working = detailRef.current;
                let interaction =
                  working?.interactions.find((candidate) => candidate.id === activeInteractionId) ??
                  working?.interactions[0] ??
                  null;
                if (!interaction || interaction.completedAt) {
                  working = await start();
                  interaction = working?.interactions[0] ?? null;
                }
                if (!interaction) return;
                const succeeded = await runMutation(
                  "record-communication",
                  () =>
                    recordStaffCommunication(
                      interaction.id,
                      {
                        expectedInteractionVersion: interaction.version,
                        channel,
                        direction: String(form.get("direction")) as "inbound" | "outbound",
                        subject: String(form.get("subject") ?? "").trim() || null,
                        body,
                      },
                      crypto.randomUUID(),
                    ),
                  channel === "portal"
                    ? "Portal message delivered and added to the outcome timeline."
                    : "Communication recorded and queued for outcome enrichment.",
                );
                if (succeeded) formElement.reset();
              }}
            />
          ) : null}

          {tab === "outcomes" ? (
            <OutcomesTab
              detail={detail}
              interaction={activeInteraction}
              busy={busy}
              onChooseInteraction={setActiveInteractionId}
              onRetry={(scope) => void retryAi(scope)}
              onUploadRecording={(interactionId, file, consentConfirmed) =>
                runMutation(
                  "recording-upload",
                  () =>
                    uploadStaffCallRecording(
                      interactionId,
                      file,
                      consentConfirmed,
                      crypto.randomUUID(),
                    ),
                  "The original recording is stored and transcription is queued.",
                )
              }
              onRetryTranscription={(recording) =>
                runMutation(
                  `transcription-retry-${recording.id}`,
                  () =>
                    retryStaffCallTranscription(recording.id, {
                      expectedRecordingVersion: recording.version,
                    }),
                  recording.currentTranscript
                    ? "A new transcript revision is queued. The current transcript remains available."
                    : "Transcription is queued again. The original recording remains available.",
                )
              }
              onComplete={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const outcomeCode = String(form.get("outcomeCode") ?? "");
                const resolutionCode = String(form.get("resolutionCode") ?? "");
                const nextStep = String(form.get("nextStep") ?? "").trim() || null;
                const followUpValue = String(form.get("followUpAt") ?? "").trim();
                const followUpAt = followUpValue
                  ? new Date(followUpValue).toISOString()
                  : null;
                const succeeded = await runMutation(
                  "complete",
                  async () => {
                    if (activeInteraction) {
                      return completeStaffInteraction(activeInteraction.id, {
                        expectedInteractionVersion: activeInteraction.version,
                        expectedWorkItemVersion: item.version,
                        outcomeCode,
                        resolutionCode,
                        nextStep,
                        followUpAt,
                      });
                    }
                    await updateStaffWorkItem(item.id, {
                      expectedVersion: item.version,
                      status: followUpAt ? "follow_up_required" : "done",
                      outcomeCode,
                      resolutionCode,
                      nextStep,
                      followUpAt,
                    });
                  },
                  followUpAt
                    ? "Outcome saved and follow-up scheduled."
                    : "Outcome saved and action completed.",
                );
                if (succeeded) setTab("outcomes");
              }}
            />
          ) : null}

          {tab === "comments" ? (
            <CommentsTab
              detail={detail}
              busy={busy}
              onSubmit={async (event) => {
                event.preventDefault();
                const formElement = event.currentTarget;
                const body = String(new FormData(formElement).get("body") ?? "").trim();
                if (!body) return;
                const succeeded = await runMutation(
                  "comment",
                  () =>
                    createStaffWorkComment(
                      item.id,
                      { expectedWorkItemVersion: item.version, body },
                      crypto.randomUUID(),
                    ),
                  "Comment added to the shared record.",
                );
                if (succeeded) formElement.reset();
              }}
            />
          ) : null}

          {tab === "history" ? <HistoryTab detail={detail} /> : null}
        </main>

        <RightRail
          detail={detail}
          center={center}
          currentStaffId={currentStaffId}
          busy={busy}
          onUpdate={async (input) => {
            await runMutation(
              "rail-work-update",
              async () => {
                await updateStaffWorkItem(item.id, {
                  expectedVersion: item.version,
                  ...input,
                });
              },
              "Task ownership updated.",
            );
          }}
        />
      </div>
    </section>
  );
}

function OverviewTab({
  detail,
  busy,
  onUpdate,
  onRetry,
}: {
  detail: StaffWorkItemDetail;
  busy: string | null;
  onUpdate: (input: {
    status?: StaffWorkItemStatus;
    blockerCode?: string | null;
    blockerDetail?: string | null;
    blockerReviewAt?: string | null;
    terminalReason?: string | null;
    note?: string;
  }) => Promise<void>;
  onRetry: (scope: "task_insight" | "student_summary") => void;
}) {
  const item = detail.workItem;
  const insight = detail.taskInsight;
  const summary = detail.studentSummary;
  return (
    <div className="action-panel-stack">
      <section className="action-card action-overview-card">
        <p className="eyebrow">What is this about?</p>
        <h2>{item.title}</h2>
        <p>{insight.summary ?? item.description}</p>
        <div className="action-purpose-grid">
          <article>
            <strong>Why this matters</strong>
            <p>{insight.whyThisMatters ?? `This ${readable(item.actionType)} can affect the student's enrollment or onboarding progress.`}</p>
          </article>
          <article>
            <strong>What we are trying to do</strong>
            <p>{insight.objective ?? item.nextStep ?? "Resolve the issue with a clear, documented next action."}</p>
          </article>
          <article>
            <strong>Success looks like</strong>
            <p>{insight.successDefinition ?? "A recorded outcome, an informed student, and either a completed action or a dated follow-up."}</p>
          </article>
        </div>
      </section>

      <div className="action-two-column">
        <section className="action-card">
          <p className="eyebrow">Context at a glance</p>
          <dl className="action-fact-list">
            <div><dt>Current status</dt><dd>{readable(item.status)}</dd></div>
            <div><dt>Attempts</dt><dd>{item.attemptCount}</dd></div>
            <div><dt>Selected channel</dt><dd>{item.selectedChannel ?? "Not chosen"}</dd></div>
            <div><dt>Follow-up</dt><dd>{dateTime(item.followUpAt)}</dd></div>
          </dl>
        </section>
        <section className="action-card action-ai-card">
          <div className="action-card-heading">
            <div>
              <p className="eyebrow">Suggested approach (AI)</p>
              <h2>{aiLabel(insight.state)}</h2>
            </div>
            <span className={`action-ai-state action-ai-state--${insight.state}`}>
              {aiLabel(insight.state)}
            </span>
          </div>
          <p>{insight.suggestedApproach ?? "The suggested approach is waiting for the task insight run."}</p>
          {insight.suggestedChannel ? <p><strong>Recommended channel:</strong> {readable(insight.suggestedChannel)}</p> : null}
          <button
            type="button"
            disabled={Boolean(busy) || isAiBusy(insight.state)}
            onClick={() => onRetry("task_insight")}
          >
            {isAiBusy(insight.state)
              ? "Task insight refresh queued"
              : insight.state === "failed_retryable" || insight.state === "dead_letter"
                ? "Retry task insight"
                : "Refresh task insight"}
          </button>
        </section>
      </div>

      <section className="action-card action-ai-card">
          <div className="action-card-heading">
            <div>
              <p className="eyebrow">Student summary (AI)</p>
              <h2>{aiLabel(summary.state)}</h2>
            </div>
            <span className={`action-ai-state action-ai-state--${summary.state}`}>
              {aiLabel(summary.state)}
            </span>
          </div>
          <p>
            {summary.summary ??
              "No summary has been generated yet. Canonical student records remain available."}
          </p>
          {summary.keyFacts.length > 0 ? (
            <ul>{summary.keyFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
          ) : null}
          <button
            type="button"
            disabled={Boolean(busy) || isAiBusy(summary.state)}
            onClick={() => onRetry("student_summary")}
          >
            {isAiBusy(summary.state)
              ? "Student summary refresh queued"
              : summary.state === "failed_retryable" || summary.state === "dead_letter"
                ? "Retry student summary"
                : "Refresh student summary"}
          </button>
      </section>

      {!terminalStatuses.has(item.status) ? (
        <form
          className="action-card action-operational-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const status = String(form.get("status")) as StaffWorkItemStatus;
            const blockerReview = String(form.get("blockerReviewAt") ?? "");
            void onUpdate({
              status,
              blockerCode: String(form.get("blockerCode") ?? "").trim() || null,
              blockerDetail: String(form.get("blockerDetail") ?? "").trim() || null,
              blockerReviewAt: blockerReview ? new Date(blockerReview).toISOString() : null,
              terminalReason: String(form.get("terminalReason") ?? "").trim() || null,
              note: String(form.get("note") ?? "").trim() || undefined,
            });
          }}
        >
          <div className="action-card-heading">
            <div><p className="eyebrow">Operational state</p><h2>Block, cancel, or reopen work</h2></div>
          </div>
          <div className="action-form-grid">
            <label>Status
              <select name="status" defaultValue={item.status}>
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="follow_up_required">Follow-up required</option>
                <option value="blocked">Blocked</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label>Blocker code<input name="blockerCode" defaultValue={item.blocker?.code ?? ""} /></label>
            <label className="action-form-span">Blocker or cancellation detail
              <textarea name="blockerDetail" defaultValue={item.blocker?.detail ?? ""} />
            </label>
            <label>Review blocker at<input name="blockerReviewAt" type="datetime-local" /></label>
            <label>Cancellation reason<input name="terminalReason" defaultValue={item.terminalReason ?? ""} /></label>
            <label className="action-form-span">Audit note<textarea name="note" /></label>
          </div>
          <button type="submit" disabled={Boolean(busy)}>Save operational state</button>
        </form>
      ) : null}
    </div>
  );
}

function NextStepTab({
  itemTerminal,
  detail,
  channel,
  activeInteraction,
  busy,
  onChannel,
  onStart,
  onRecord,
}: {
  itemTerminal: boolean;
  detail: StaffWorkItemDetail;
  channel: StaffCommunicationChannel;
  activeInteraction: StaffInteraction | null;
  busy: string | null;
  onChannel: (channel: StaffCommunicationChannel) => void;
  onStart: () => void;
  onRecord: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const studentName = detail.workItem.student.preferredName;
  return (
    <div className="action-panel-stack">
      <section className="action-card">
        <p className="eyebrow">1. Choose how you want to reach out</p>
        <h2>Pick the channel that fits the next action</h2>
        <div className="action-channel-grid">
          {channels.map((candidate) => (
            <button
              type="button"
              className={channel === candidate.id ? "is-selected" : undefined}
              aria-pressed={channel === candidate.id}
              onClick={() => onChannel(candidate.id)}
              key={candidate.id}
            >
              <span className="action-channel-option__icon" aria-hidden="true">
                <ActionChannelIcon channel={candidate.id} />
              </span>
              <strong>{candidate.label}</strong>
              <span className="action-channel-option__guidance">{candidate.guidance}</span>
            </button>
          ))}
        </div>
        <button
          className="action-secondary-button"
          type="button"
          disabled={itemTerminal || Boolean(busy)}
          onClick={onStart}
        >
          Start a new {channels.find((candidate) => candidate.id === channel)?.label.toLowerCase()}
        </button>
      </section>

      <div className="action-two-column">
        <section className="action-card">
          <p className="eyebrow">2. Quick guide</p>
          <h2>Conversation guidance</h2>
          <div className="action-script">
            <strong>Opening</strong>
            <p>
              Hi {studentName}, this is your enrollment team. I&apos;m reaching out about {" "}
              {detail.workItem.title.toLowerCase()}.
            </p>
            <strong>Key points</strong>
            <p>{detail.taskInsight.suggestedApproach ?? "Confirm the student received the relevant information, identify what is preventing the next step, and agree on one clear follow-up date."}</p>
            {detail.taskInsight.suggestedChannel ? (
              <small>AI channel recommendation: {readable(detail.taskInsight.suggestedChannel)}</small>
            ) : null}
          </div>
        </section>
        <section className="action-card action-ai-card">
          <p className="eyebrow">Student insights (AI)</p>
          <h2>{aiLabel(detail.studentSummary.state)}</h2>
          <p>{detail.studentSummary.summary ?? "Insights are waiting for the first enrichment run."}</p>
          {detail.studentSummary.risks.length > 0 ? (
            <ul>{detail.studentSummary.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul>
          ) : null}
        </section>
      </div>

      <form className="action-card action-communication-form" onSubmit={onRecord}>
        <div className="action-card-heading">
          <div>
            <p className="eyebrow">3. Record the interaction</p>
            <h2>{channel === "portal" ? "Send and record" : "Add the channel result"}</h2>
          </div>
          {activeInteraction ? <span>Interaction v{activeInteraction.version}</span> : null}
        </div>
        {channel !== "portal" ? (
          <p className="action-honesty-note">
            External {channel} delivery is not connected in this environment. This form records
            communication that occurred in the approved channel; portal messages are delivered live.
          </p>
        ) : null}
        <div className="action-form-grid">
          <label>Direction
            <select name="direction" defaultValue="outbound">
              <option value="outbound">Staff to student</option>
              <option value="inbound">Student to staff</option>
            </select>
          </label>
          <label>Subject<input name="subject" maxLength={500} /></label>
          <label className="action-form-span">
            {channel === "voice" ? "Call transcript or notes" : "Message or response"}
            <textarea name="body" required maxLength={12_000} rows={7} />
          </label>
        </div>
        <button type="submit" disabled={itemTerminal || Boolean(busy)}>
          {channel === "portal" ? "Deliver portal message" : `Record ${channel} result`}
        </button>
      </form>
    </div>
  );
}

const maximumCallRecordingBytes = 10 * 1024 * 1024;

function fileSize(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function recordingStatus(recording: StaffCallRecording) {
  switch (recording.status) {
    case "uploading":
      return "Securing original recording";
    case "queued":
      return "Queued for transcription";
    case "transcribing":
      return "Transcription in progress";
    case "ready":
      return "Transcript ready";
    case "upload_failed":
      return "Upload failed - select the original file again";
    case "failed_retryable":
      return "Transcription failed - safe to retry";
    case "dead_letter":
      return "Automatic retries exhausted - staff review required";
    case "pending_configuration":
      return "Waiting for transcription configuration";
  }
}

function RecordingPlayer({ recording }: { recording: StaffCallRecording }) {
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    void getStaffCallRecordingContent(recording.id, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [recording.id, recording.version]);

  if (error) return <p className="action-recording-error">{error}</p>;
  if (!source) return <p className="action-recording-loading">Loading secured audio...</p>;
  if (recording.mimeType.startsWith("video/")) {
    return <video controls preload="metadata" src={source} />;
  }
  return <audio controls preload="metadata" src={source} />;
}

function CallRecordingPanel({
  interaction,
  busy,
  onUpload,
  onRetry,
}: {
  interaction: StaffInteraction;
  busy: string | null;
  onUpload: (
    interactionId: string,
    file: File,
    consentConfirmed: boolean,
  ) => Promise<boolean>;
  onRetry: (recording: StaffCallRecording) => Promise<boolean>;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const selected = form.get("recording");
    const consentConfirmed = form.get("consent") === "on";
    if (!(selected instanceof File) || selected.size === 0) {
      setFormError("Choose the original call recording before uploading.");
      return;
    }
    if (selected.size > maximumCallRecordingBytes) {
      setFormError("Choose a recording no larger than 10 MB.");
      return;
    }
    if (!consentConfirmed) {
      setFormError("Confirm that the participants consented to recording and transcription.");
      return;
    }
    setFormError(null);
    if (await onUpload(interaction.id, selected, consentConfirmed)) formElement.reset();
  };

  return (
    <section className="action-card action-call-recordings">
      <div className="action-card-heading">
        <div>
          <p className="eyebrow">2. Call recording and transcript</p>
          <h2>Original evidence and revision-safe transcription</h2>
        </div>
        <span>{interaction.recordings.length} recording{interaction.recordings.length === 1 ? "" : "s"}</span>
      </div>
      <p className="action-recording-safety">
        The original recording is retained even if speech-to-text fails. Transcript retries create
        a new revision; they never overwrite the audio or an earlier transcript.
      </p>

      {interaction.recordings.length > 0 ? (
        <div className="action-recording-list">
          {interaction.recordings.map((recording) => {
            const earlierTranscripts = recording.transcriptHistory.filter(
              (revision) => revision.version !== recording.currentTranscript?.version,
            );
            const retryable = ![
              "uploading",
              "queued",
              "transcribing",
              "upload_failed",
            ].includes(recording.status);
            return (
              <article className="action-recording" key={recording.id}>
                <header>
                  <div>
                    <strong>{recording.fileName}</strong>
                    <span>{fileSize(recording.sizeBytes)} - uploaded {dateTime(recording.uploadedAt)}</span>
                  </div>
                  <span className={`action-recording-status action-recording-status--${recording.status}`}>
                    {recordingStatus(recording)}
                  </span>
                </header>
                {recording.status !== "upload_failed" ? (
                  <RecordingPlayer
                    key={`${recording.id}-${recording.version}`}
                    recording={recording}
                  />
                ) : null}
                {recording.lastError ? (
                  <p className="action-recording-error">{recording.lastError}</p>
                ) : null}
                {recording.currentTranscript ? (
                  <div className="action-recording-transcript">
                    <div>
                      <strong>Transcript revision {recording.currentTranscript.version}</strong>
                      <span>
                        {recording.currentTranscript.language ?? "Language not reported"} - {dateTime(recording.currentTranscript.generatedAt)}
                      </span>
                    </div>
                    <p>{recording.currentTranscript.transcript}</p>
                  </div>
                ) : (
                  <p className="action-recording-loading">
                    The audio is available now. The transcript will appear here when processing
                    completes.
                  </p>
                )}
                {earlierTranscripts.length > 0 ? (
                  <details className="action-transcript-history">
                    <summary>Earlier transcript revisions ({earlierTranscripts.length})</summary>
                    {earlierTranscripts.map((revision) => (
                      <article key={revision.id}>
                        <strong>Revision {revision.version}</strong>
                        <span>{dateTime(revision.generatedAt)}</span>
                        <p>{revision.transcript}</p>
                      </article>
                    ))}
                  </details>
                ) : null}
                <div className="action-recording-actions">
                  {retryable ? (
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void onRetry(recording)}
                    >
                      {recording.currentTranscript ? "Regenerate transcript" : "Retry transcription"}
                    </button>
                  ) : null}
                  {recording.status === "upload_failed" ? (
                    <span>Use the upload form below with the same original file.</span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p>No call recording has been attached to this interaction.</p>
      )}

      <form className="action-recording-upload" onSubmit={upload}>
        <label>
          Recording file
          <input
            name="recording"
            type="file"
            accept=".flac,.m4a,.mp3,.mp4,.ogg,.wav,.webm,audio/*,video/mp4,video/webm"
            required
          />
          <small>FLAC, MP3, MP4, M4A, OGG, WAV, or WebM; maximum 10 MB.</small>
        </label>
        <label className="action-recording-consent">
          <input name="consent" type="checkbox" required />
          I confirm the participants consented to recording and external speech-to-text
          processing.
        </label>
        {formError ? <p className="action-recording-error" role="alert">{formError}</p> : null}
        <button type="submit" disabled={Boolean(busy)}>Store and transcribe</button>
      </form>
    </section>
  );
}

function OutcomesTab({
  detail,
  interaction,
  busy,
  onChooseInteraction,
  onRetry,
  onUploadRecording,
  onRetryTranscription,
  onComplete,
}: {
  detail: StaffWorkItemDetail;
  interaction: StaffInteraction | null;
  busy: string | null;
  onChooseInteraction: (id: string) => void;
  onRetry: (scope: "interaction" | "student_summary" | "both") => void;
  onUploadRecording: (
    interactionId: string,
    file: File,
    consentConfirmed: boolean,
  ) => Promise<boolean>;
  onRetryTranscription: (recording: StaffCallRecording) => Promise<boolean>;
  onComplete: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <div className="action-panel-stack">
      {detail.interactions.length > 1 ? (
        <label className="action-interaction-picker">Interaction
          <select value={interaction?.id ?? ""} onChange={(event) => onChooseInteraction(event.target.value)}>
            {detail.interactions.map((candidate, index) => (
              <option value={candidate.id} key={candidate.id}>
                #{detail.interactions.length - index} - {readable(candidate.status)} - {candidate.selectedChannel ?? "mixed"}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="action-outcome-grid">
        <section className="action-card">
          <p className="eyebrow">1. Interaction outcome</p>
          <h2>{interaction?.outcome?.outcomeCode ? readable(interaction.outcome.outcomeCode) : "Awaiting outcome"}</h2>
          <dl className="action-fact-list">
            <div><dt>Resolution</dt><dd>{interaction?.outcome?.resolutionCode ? readable(interaction.outcome.resolutionCode) : "Not generated"}</dd></div>
            <div><dt>Next step</dt><dd>{interaction?.outcome?.nextStep ?? detail.workItem.nextStep ?? "Not set"}</dd></div>
            <div><dt>Follow-up</dt><dd>{interaction?.outcome?.followUpRequired ? "Required" : "Not indicated"}</dd></div>
            <div><dt>Coverage</dt><dd>{interaction ? `${interaction.coveredSourceVersion} of ${interaction.sourceVersion}` : "No sources"}</dd></div>
          </dl>
        </section>
        {interaction &&
        (interaction.selectedChannel === "voice" || interaction.recordings.length > 0) ? (
          <CallRecordingPanel
            interaction={interaction}
            busy={busy}
            onUpload={onUploadRecording}
            onRetry={onRetryTranscription}
          />
        ) : null}
        <section className="action-card action-transcript-card">
          <div className="action-card-heading">
            <div><p className="eyebrow">Source evidence</p><h2>Communication timeline</h2></div>
            <span>{interaction?.communications.length ?? 0} events</span>
          </div>
          {interaction?.communications.length ? (
            <ol className="action-transcript">
              {interaction.communications.map((communication) => (
                <li key={communication.id}>
                  <div>
                    <strong>{communication.direction === "inbound" ? detail.workItem.student.preferredName : "Staff"}</strong>
                    <span>{communication.channel} - {dateTime(communication.occurredAt)}</span>
                  </div>
                  <p>{communication.body ?? "No text was captured for this event."}</p>
                  <small>{readable(communication.deliveryStatus)}</small>
                </li>
              ))}
            </ol>
          ) : <p>No communication has been recorded.</p>}
        </section>
        <section className="action-card action-ai-card">
          <div className="action-card-heading">
            <div><p className="eyebrow">3. AI outcome summary</p><h2>{interaction ? aiLabel(interaction.aiState) : "Not requested"}</h2></div>
            <span className={`action-ai-state action-ai-state--${interaction?.aiState ?? "not_requested"}`}>
              {aiLabel(interaction?.aiState ?? "not_requested")}
            </span>
          </div>
          <p>{interaction?.outcome?.summary ?? "The source communication is visible while the summary is generated."}</p>
          {interaction?.outcome?.channelResults.length ? (
            <ul>{interaction.outcome.channelResults.map((result) => <li key={`${result.channel}:${result.result}`}>{result.channel}: {result.result}</li>)}</ul>
          ) : null}
          {interaction ? (
            <button
              type="button"
              disabled={Boolean(busy) || isAiBusy(interaction.aiState)}
              onClick={() => onRetry("both")}
            >
              {isAiBusy(interaction.aiState)
                ? "Outcome and student summary refresh queued"
                : interaction.aiState === "failed_retryable" ||
                    interaction.aiState === "dead_letter"
                  ? "Retry outcome and student summaries"
                  : "Refresh outcome and student summaries"}
            </button>
          ) : null}
        </section>
        <section className="action-card">
          <p className="eyebrow">4. Suggested follow-up</p>
          <h2>{interaction?.outcome?.followUpRequired ? "Follow-up recommended" : "Review before closing"}</h2>
          <p>{interaction?.outcome?.nextStep ?? detail.studentSummary.nextSteps[0] ?? "Confirm the final result and choose whether another contact is needed."}</p>
        </section>
      </div>

      {!terminalStatuses.has(detail.workItem.status) ? (
        <form className="action-card action-completion-form" onSubmit={onComplete}>
          <p className="eyebrow">Record the official outcome</p>
          <h2>Complete or schedule follow-up</h2>
          <p>AI text is advisory. These fields are the staff-confirmed CRM outcome.</p>
          <div className="action-form-grid">
            <label>Outcome
              <select name="outcomeCode" required defaultValue={interaction?.outcome?.outcomeCode ?? "student_reached"}>
                <option value="student_reached">Student reached</option>
                <option value="no_response">No response</option>
                <option value="information_received">Information received</option>
                <option value="document_received">Document received</option>
                <option value="needs_staff_review">Needs staff review</option>
              </select>
            </label>
            <label>Resolution
              <select name="resolutionCode" required defaultValue={interaction?.outcome?.resolutionCode ?? "questions_answered"}>
                <option value="questions_answered">Questions answered</option>
                <option value="resolved_by_staff">Resolved by staff</option>
                <option value="awaiting_student">Awaiting student</option>
                <option value="escalated_to_leader">Escalated to leader</option>
                <option value="human_review_opened">Human review opened</option>
              </select>
            </label>
            <label className="action-form-span">Next step<textarea name="nextStep" defaultValue={interaction?.outcome?.nextStep ?? detail.workItem.nextStep ?? ""} /></label>
            <label>Follow up at<input name="followUpAt" type="datetime-local" /></label>
          </div>
          <button type="submit" disabled={Boolean(busy)}>Save official outcome</button>
        </form>
      ) : null}

      {isAiBusy(detail.aiState) ? (
        <p className="action-processing-note">AI enrichment is running in the background. You can leave this page safely.</p>
      ) : null}
      {detail.aiState === "dead_letter" ? (
        <button type="button" onClick={() => onRetry("both")} disabled={Boolean(busy)}>Retry all AI projections</button>
      ) : null}
    </div>
  );
}

function CommentsTab({
  detail,
  busy,
  onSubmit,
}: {
  detail: StaffWorkItemDetail;
  busy: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <section className="action-card">
      <form className="action-comment-form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="action-comment">Add a comment</label>
        <textarea id="action-comment" name="body" required maxLength={2_000} placeholder="Add a comment for the team..." />
        <button type="submit" disabled={Boolean(busy)}>Post</button>
      </form>
      <div className="action-comments">
        {detail.comments.map((comment) => (
          <article key={comment.id}>
            <div className="action-avatar">{comment.author.name.slice(0, 1)}</div>
            <div><strong>{comment.author.name}</strong><span>{dateTime(comment.createdAt)}</span><p>{comment.body}</p></div>
          </article>
        ))}
        {detail.comments.length === 0 ? <p>No team comments yet.</p> : null}
      </div>
    </section>
  );
}

function HistoryTab({ detail }: { detail: StaffWorkItemDetail }) {
  return (
    <section className="action-card">
      <h2>Most recent first</h2>
      <ol className="action-history">
        {detail.workItem.history.map((event) => (
          <li key={event.id}>
            <span className="action-history__dot" />
            <div><strong>{readable(event.action)}</strong><p>{event.message}</p></div>
            <div><span>{event.actorName}</span><time>{dateTime(event.occurredAt)}</time></div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RightRail({
  detail,
  center,
  currentStaffId,
  busy,
  onUpdate,
}: {
  detail: StaffWorkItemDetail;
  center: StaffActionCenter;
  currentStaffId: string;
  busy: string | null;
  onUpdate: (input: {
    assigneeId?: string | null;
    escalated?: boolean;
    note?: string;
  }) => Promise<void>;
}) {
  const item = detail.workItem;
  const remaining = useMemo(() => {
    if (!item.dueAt) return "No SLA due date";
    const milliseconds =
      new Date(item.dueAt).getTime() - new Date(detail.generatedAt).getTime();
    if (milliseconds <= 0) return "Past due";
    const hours = Math.ceil(milliseconds / 3_600_000);
    return hours > 48 ? `${Math.ceil(hours / 24)} days remaining` : `${hours} hours remaining`;
  }, [detail.generatedAt, item.dueAt]);
  return (
    <aside className="action-detail__rail">
      <section className="action-card action-student-card">
        <div className="action-student-card__identity">
          <span>{item.student.preferredName.slice(0, 1)}</span>
          <div><h2>{item.student.name}</h2><p>{item.student.programName} - Class of {item.student.classYear}</p></div>
        </div>
      </section>
      <section className="action-card">
        <h2>Task details</h2>
        <dl className="action-fact-list">
          <div><dt>Task type</dt><dd>{readable(item.actionType)}</dd></div>
          <div><dt>Task group</dt><dd>{item.component}</dd></div>
          <div><dt>Priority</dt><dd>{item.priority}</dd></div>
          <div><dt>Created</dt><dd>{dateTime(item.createdAt)}</dd></div>
        </dl>
        <div className="action-rail-controls">
          <label>
            <span>Owner</span>
            <select
              value={item.assignee?.id ?? ""}
              disabled={Boolean(busy)}
              onChange={(event) =>
                void onUpdate({
                  assigneeId: event.target.value || null,
                  note: "Owner changed from the Enrollment Action Center.",
                })
              }
            >
              <option value="">Unassigned</option>
              {[...center.staff]
                .sort((left, right) => {
                  if (left.id === currentStaffId) return -1;
                  if (right.id === currentStaffId) return 1;
                  return left.name.localeCompare(right.name);
                })
                .map((staff) => (
                  <option value={staff.id} key={staff.id}>
                    {staff.id === currentStaffId
                      ? "@me · " + staff.name
                      : staff.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="action-rail-escalation">
            <input
              type="checkbox"
              checked={item.escalated}
              disabled={Boolean(busy)}
              onChange={(event) =>
                void onUpdate({
                  escalated: event.target.checked,
                  note: event.target.checked
                    ? "Escalated from the Enrollment Action Center."
                    : "Escalation cleared from the Enrollment Action Center.",
                })
              }
            />
            Escalate for leader review
          </label>
        </div>
      </section>
      <section className="action-card">
        <h2>SLA</h2>
        <dl className="action-fact-list">
          <div><dt>Due</dt><dd>{dateTime(item.dueAt)}</dd></div>
          <div><dt>Time remaining</dt><dd>{remaining}</dd></div>
          <div><dt>Status</dt><dd>{item.escalated ? "Escalated" : "On track"}</dd></div>
        </dl>
      </section>
      <section className="action-card">
        <h2>Related</h2>
        <ul className="action-related-list">
          {detail.relatedItems.map((related) => (
            <li key={related.id}>{related.key} - {related.title}</li>
          ))}
          {detail.relatedItems.length === 0 ? <li>No related open work</li> : null}
        </ul>
        <small>{center.items.filter((candidate) => candidate.student.id === item.student.id).length} actions for this student</small>
      </section>
    </aside>
  );
}
