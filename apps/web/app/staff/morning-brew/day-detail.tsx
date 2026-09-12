"use client";

import { useState } from "react";
import { Avatar, EdwardButton } from "./cards";
import {
  CalendarThumbnail,
  CampaignThumbnail,
  SheetThumbnail,
  ThreadThumbnail,
  WorkThumbnail,
} from "./context-thumbnails";
import { topicById } from "./catalog";
import { DetailShell } from "./detail-shell";
import { MockProviderLink } from "./mock-provider-link";
import { Glyph } from "./glyphs";
import { emailPresentation, formatEmailTimestamp } from "./presentation";
import type {
  BrewBriefing,
  BrewDetailRef,
  BrewMeeting,
  BrewRequest,
  EdwardRequest,
} from "./types";

// Explicit relationships for this demo scenario. These are not inferred links,
// retrieved documents, or provider attachments.
const SCHOLARSHIP_CONTEXT = {
  request: "r-1",
  meeting: "m-leadership-huddle",
  priority: "p-commuter-outreach",
};
const MESSAGE = `Vivian,

I’d like your call on a $240K reallocation from the summer campaign into commuter-cohort aid before we close the enrollment packet Friday.

The concern is the tradeoff: pulling the spend now would cost us roughly 40 inquiries at the top of the funnel. But the commuter cohort is showing a more immediate risk. The deposit rate dropped 6.4 points over the past week, and 312 students currently have an aid file pending rather than a final decision.

Our latest model puts 82 deposits at risk, representing approximately $1.6M in net tuition. I think there’s a stronger case for protecting that existing pipeline, but I want your read before we move the budget.

If you’re comfortable with the reallocation, I’ll make sure the updated figures are reflected in the packet Friday morning.

Marcus`;

function WhyThis({ children }: { children: React.ReactNode }) {
  return (
    <div className="brew-why">
      <strong>Why you’re seeing this</strong>
      <p>{children}</p>
    </div>
  );
}

function RelatedContext({
  briefing,
  id,
  onOpen,
}: {
  briefing: BrewBriefing;
  id: string;
  onOpen: (detail: BrewDetailRef) => void;
}) {
  const [attachment, setAttachment] = useState<string | null>(null);
  if (![SCHOLARSHIP_CONTEXT.request, SCHOLARSHIP_CONTEXT.meeting].includes(id))
    return null;
  const request = briefing.requests.find(
    (item) => item.id === SCHOLARSHIP_CONTEXT.request,
  );
  const meeting = briefing.meetings.find(
    (item) => item.id === SCHOLARSHIP_CONTEXT.meeting,
  );
  const priority = briefing.priorities.find(
    (item) => item.id === SCHOLARSHIP_CONTEXT.priority,
  );
  return (
    <section className="brew-related">
      <h2>Related context</h2>
      <div className="brew-related__groups">
        <div>
          <h3>Attached to this</h3>
          <div className="brew-related__cards">
            <button
              type="button"
              className="brew-context-card"
              aria-expanded={attachment === "budget"}
              onClick={() =>
                setAttachment(attachment === "budget" ? null : "budget")
              }
            >
              <SheetThumbnail />
              <span className="brew-context-card__label">
                <i className="brew-file-mark is-sheet">XLS</i>
                <span>
                  <strong>Scholarship_Reallocation.xlsx</strong>
                  <small>48 KB · Sample</small>
                </span>
              </span>
            </button>
            <button
              type="button"
              className="brew-context-card"
              aria-expanded={attachment === "campaign"}
              onClick={() =>
                setAttachment(attachment === "campaign" ? null : "campaign")
              }
            >
              <CampaignThumbnail />
              <span className="brew-context-card__label">
                <i className="brew-file-mark is-pdf">PDF</i>
                <span>
                  <strong>Summer_Campaign.pdf</strong>
                  <small>1.2 MB · Sample</small>
                </span>
              </span>
            </button>
          </div>
        </div>
        <div>
          <h3>Elsewhere in your work</h3>
          <div className="brew-related__cards">
            {request ? (
              <button
                className="brew-context-card"
                type="button"
                onClick={() =>
                  request.id === id
                    ? setAttachment(attachment === "thread" ? null : "thread")
                    : onOpen({ kind: "request", id: request.id })
                }
              >
                <ThreadThumbnail request={request} />
                <span className="brew-context-card__label">
                  <i className="brew-file-mark is-mail">MAIL</i>
                  <span>
                    <strong>Scholarship reallocation conversation</strong>
                    <small>Email</small>
                  </span>
                </span>
              </button>
            ) : null}
            {meeting ? (
              <button
                className="brew-context-card"
                type="button"
                onClick={() =>
                  meeting.id === id
                    ? setAttachment(attachment === "meeting" ? null : "meeting")
                    : onOpen({ kind: "meeting", id: meeting.id })
                }
              >
                <CalendarThumbnail meeting={meeting} />
                <span className="brew-context-card__label">
                  <i className="brew-file-mark is-calendar">CAL</i>
                  <span>
                    <strong>{meeting.title}</strong>
                    <small>Calendar</small>
                  </span>
                </span>
              </button>
            ) : null}
            {priority ? (
              <button
                className="brew-context-card"
                type="button"
                onClick={() => onOpen({ kind: "priority", id: priority.id })}
              >
                <WorkThumbnail priority={priority} />
                <span className="brew-context-card__label">
                  <i className="brew-file-mark is-sheet">WORK</i>
                  <span>
                    <strong>{priority.title}</strong>
                    <small>Action Center</small>
                  </span>
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {attachment ? (
        <div
          className="brew-attachment-preview"
          role="region"
          aria-label="Sample attachment preview"
        >
          <strong>
            {attachment === "budget"
              ? "Scholarship reallocation · sample budget"
              : attachment === "campaign"
                ? "Summer campaign · sample brief"
                : attachment === "thread"
                  ? "Scholarship reallocation · conversation context"
                  : meeting?.title}
          </strong>
          <p>
            {attachment === "budget"
              ? "Reallocate $240,000 from the summer campaign to commuter-cohort aid. Total budget remains unchanged. Approval is requested before the Friday enrollment packet closes."
              : attachment === "meeting"
                ? meeting?.prep
                : "The proposal weighs roughly 40 fewer summer inquiries against 82 deposits at risk and approximately $1.6M in net tuition. Review the original email and the commuter outreach work item before deciding."}
          </p>
          <small>Illustrative context for this demo.</small>
        </div>
      ) : null}
    </section>
  );
}

function DraftPanel({
  id,
  heading,
  title,
  initial,
  value,
  onChange,
  onAskEdward,
  onRevision,
  sent,
  onSend,
}: {
  id: string;
  heading: string;
  title: string;
  initial: string;
  value: string | undefined;
  onChange: (id: string, text: string) => void;
  onAskEdward: () => void;
  onRevision: (instruction: string, draft: string) => void;
  sent?: string;
  onSend?: (id: string, text: string) => void;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const [instruction, setInstruction] = useState("");
  const text = value ?? initial;
  return (
    <aside
      className={`brew-draft-panel ${onSend ? "brew-draft-panel--email" : "brew-draft-panel--prep"}`}
    >
      <header>
        <h2>{heading}</h2>
        <div className="brew-draft-tools">
          <details>
            <summary aria-label="Draft options">···</summary>
            <div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(text);
                    setCopyStatus("Copied");
                  } catch {
                    setCopyStatus("Select the draft text to copy it.");
                  }
                }}
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(id, initial);
                  setCopyStatus("");
                }}
              >
                Reset draft
              </button>
            </div>
          </details>
          {!onSend ? (
            <EdwardButton
              label={`Ask Edward about ${title}`}
              onClick={onAskEdward}
            />
          ) : null}
        </div>
      </header>
      <textarea
        aria-label={heading}
        value={text}
        onChange={(event) => {
          onChange(id, event.target.value);
          setCopyStatus("");
        }}
      />
      {onSend ? (
        <form
          className="brew-draft-composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (instruction.trim()) onRevision(instruction, text);
          }}
        >
          <div>
            <input
              aria-label="Say what to change"
              placeholder="Say what to change"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
            />
            {instruction.trim() ? (
              <button
                className="brew-draft-revise"
                type="submit"
                aria-label="Ask Edward to revise draft"
              >
                <Glyph name="arrow" size={16} />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="button button--primary"
            disabled={!text.trim() || Boolean(sent)}
            onClick={() => onSend(id, text)}
          >
            {sent ? "Reply recorded" : "Send reply"}
          </button>
        </form>
      ) : null}
      <p className="brew-draft-panel__note" role="status">
        {copyStatus ||
          (sent
            ? "Reply recorded for this demo session. No email was sent."
            : onSend
              ? "Demo reply · Nothing is sent to your mailbox."
              : "Edward drafts; your edits stay in this session and are not saved to the record.")}
      </p>
    </aside>
  );
}

function meetingPrep(meeting: BrewMeeting, briefing: BrewBriefing) {
  const metrics = briefing.kpis
    .filter((kpi) => kpi.topic === meeting.topic)
    .slice(0, 3);
  return [
    `${meeting.title} · ${meeting.timeLabel} · ${meeting.durationMinutes} min`,
    "",
    "Why it matters",
    meeting.detail,
    "",
    "Before you walk in",
    meeting.prep,
    ...(metrics.length
      ? [
          "",
          "Numbers to have ready",
          ...metrics.map(
            (kpi) =>
              `• ${kpi.label}: ${kpi.display}${kpi.targetDisplay ? ` / goal ${kpi.targetDisplay}` : ""}${kpi.projection ? ` · projected ${kpi.projection.display} ${kpi.projection.byLabel}` : ""}`,
          ),
        ]
      : []),
    "",
    "Leave with",
    "A clear decision, an owner and an agreed next step.",
  ].join("\n");
}

export function DayDetail({
  detail,
  briefing,
  onBack,
  onAskEdward,
  onOpenDetail,
  onManagePreferences,
  drafts,
  onDraftChange,
  replies,
  onDemoReply,
}: {
  detail: BrewDetailRef;
  briefing: BrewBriefing;
  onBack: () => void;
  onAskEdward: (request: EdwardRequest) => void;
  onOpenDetail: (detail: BrewDetailRef) => void;
  onManagePreferences: () => void;
  drafts: Record<string, string>;
  onDraftChange: (id: string, text: string) => void;
  replies: Record<string, string>;
  onDemoReply: (id: string, text: string) => void;
}) {
  const [notRelevant, setNotRelevant] = useState<Record<string, boolean>>({});
  const [showAttendees, setShowAttendees] = useState(false);
  const meeting =
    detail.kind === "meeting"
      ? briefing.meetings.find((item) => item.id === detail.id)
      : undefined;
  const request =
    detail.kind === "request"
      ? briefing.requests.find((item) => item.id === detail.id)
      : undefined;
  if (!meeting && !request)
    return (
      <DetailShell
        title="This item is no longer in your briefing"
        eyebrow="Morning Brew"
        onBack={onBack}
      >
        <p>Return to Morning Brew to read your current items.</p>
      </DetailShell>
    );
  const item = (meeting ?? request) as BrewMeeting | BrewRequest;
  const title = meeting?.title ?? request!.subject;
  const ask = () =>
    onAskEdward({
      mode: "ask",
      context: title,
      greeting: `${briefing.reader.firstName}, what would you like to know about ${title}?`,
    });
  const state = request ? emailPresentation(request) : null;
  const timestamp = request
    ? formatEmailTimestamp(
        state?.receivedAt,
        briefing.updatedAt,
        request.receivedLabel,
      )
    : "";
  return (
    <DetailShell
      key={item.id}
      className={`brew-detail--day ${meeting ? "brew-detail--calendar" : "brew-detail--email"}`}
      headerMeta
      titleBadge={
        meeting?.priority === "high" || request?.important ? (
          <span className="brew-day-important">Important</span>
        ) : null
      }
      eyebrow={
        meeting ? `${topicById(meeting.topic)?.title} · Calendar` : "Email"
      }
      title={title}
      mark={<Glyph name={meeting ? "calendar" : "mail"} size={46} />}
      onBack={onBack}
      meta={
        meeting ? (
          <>
            <span>{meeting.timeLabel}</span>
            <span>
              <Glyph name="clock" size={13} /> {meeting.durationMinutes} min
            </span>
            <span>{meeting.attendees.length} guests</span>
            {meeting.id === "m-leadership-huddle" ? (
              <span>Weekly on weekdays · Virtual</span>
            ) : null}
          </>
        ) : (
          <>
            <span>
              From{" "}
              <span className="brew-sender-name">
                {request!.fromName}, {request!.fromRole}
              </span>
            </span>
            <time dateTime={state?.receivedAt}>{timestamp}</time>
          </>
        )
      }
      banner={
        request ? (
          <WhyThis>
            {replies[item.id]
              ? "Your demo reply is recorded for this session."
              : `${request.waitingLabel}${state?.pendingResponse ? " · Your response is requested" : ""}${request.important ? " · Marked important" : ""}`}
          </WhyThis>
        ) : (
          <div className="brew-meeting-summary">
            <div className="brew-meeting-summary__heading">
              <EdwardButton label={`Ask Edward about ${title}`} onClick={ask} />
              <span>Edward Insights</span>
            </div>
            <p>
              This {meeting!.durationMinutes}-minute {meeting!.title} brings
              leadership together to review{" "}
              {topicById(meeting!.topic)?.title.toLowerCase()} priorities, key
              trends and decisions. {meeting!.prep}
            </p>
          </div>
        )
      }
      aside={
        <DraftPanel
          key={item.id}
          id={item.id}
          title={title}
          onRevision={(instruction, text) =>
            onAskEdward({
              mode: "ask",
              context: title,
              question: `Revise this draft using this instruction: ${instruction}\n\nDraft:\n${text}`,
            })
          }
          heading={request ? "Draft for you" : "Your prep sheet"}
          initial={request?.draftReply ?? meetingPrep(meeting!, briefing)}
          value={drafts[item.id]}
          onChange={onDraftChange}
          onAskEdward={ask}
          sent={replies[item.id]}
          onSend={request ? onDemoReply : undefined}
        />
      }
      footer={
        <>
          <RelatedContext
            key={item.id}
            briefing={briefing}
            id={item.id}
            onOpen={onOpenDetail}
          />
          <footer className="brew-day-detail__foot">
            <button
              type="button"
              className="brew-relevance-button"
              aria-pressed={Boolean(notRelevant[item.id])}
              onClick={() =>
                setNotRelevant((current) => ({
                  ...current,
                  [item.id]: !current[item.id],
                }))
              }
            >
              {notRelevant[item.id]
                ? "Marked not relevant · Undo"
                : "Mark as not relevant"}
            </button>
            <button
              className="brew-link"
              type="button"
              onClick={onManagePreferences}
            >
              Manage preferences
            </button>
            <small role="status">
              {notRelevant[item.id]
                ? "Feedback noted for this session."
                : "Demo context · Sample attachments"}
            </small>
          </footer>
        </>
      }
    >
      {request ? (
        <>
          <h2>Message</h2>
          <div className="brew-message">
            <strong>
              {request.id === "r-1"
                ? "Summer Campaign Reallocation"
                : request.subject}
            </strong>
            <p>
              {request.id === "r-1"
                ? MESSAGE
                : `${briefing.reader.firstName},\n\n${request.summary}\n\n${request.fromName}`}
            </p>
          </div>
          <MockProviderLink
            label="Open the email in Outlook →"
            title={request.subject}
            meta={`From ${request.fromName} · ${timestamp}`}
            description={request.summary}
          />
        </>
      ) : (
        <>
          <h2>Brief</h2>
          <p>
            A {meeting!.durationMinutes}-minute meeting with{" "}
            {meeting!.attendees.length} guests at {meeting!.timeLabel}. Here is
            what to walk in knowing.
            <br />
            {meeting!.detail}.
          </p>
          <MockProviderLink
            label="Open the event in Outlook →"
            title={meeting!.title}
            meta={`${meeting!.timeLabel} · ${meeting!.durationMinutes} min · ${meeting!.attendees.length} guests`}
            description={meeting!.prep}
          />
          <section className="brew-meeting-link">
            <h2>Link of this meeting</h2>
            <MockProviderLink
              meeting
              label={`meet.audentra.example/${meeting!.id.replace(/^m-/, "")}`}
              title={meeting!.title}
              meta={`${meeting!.timeLabel} · ${meeting!.durationMinutes} min`}
              description={meeting!.detail}
            />
          </section>
          <section className="brew-detail__section brew-meeting-attendees">
            <h2>Attendees</h2>
            <button
              type="button"
              className="brew-attendee-toggle"
              aria-expanded={showAttendees}
              onClick={() => setShowAttendees(!showAttendees)}
            >
              {meeting!.attendees.slice(0, 4).map((name) => (
                <span key={name} title={name}>
                  <Avatar name={name} />
                </span>
              ))}
              <span>
                {meeting!.attendees.length > 4
                  ? `+${meeting!.attendees.length - 4}`
                  : "View names"}
              </span>
              <span className="sr-only">Show attendee names</span>
            </button>
            {showAttendees ? (
              <ul className="brew-attendee-roster">
                {meeting!.attendees.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            ) : null}
          </section>
          <WhyThis>
            An accepted invitation on your calendar today.{" "}
            {meeting!.organizer
              ? "You’re the organizer, so this also appears under Hosted."
              : "You’ve accepted the invitation."}
          </WhyThis>
        </>
      )}
    </DetailShell>
  );
}
