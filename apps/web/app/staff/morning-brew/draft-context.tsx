"use client";
import { useState } from "react";
import type { BrewBriefing, BrewRequest } from "./types";
import {
  detectsMeetingRequest,
  meetingStart,
  proposalDraft,
  relatedMeetings,
} from "./email-context";
const localInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
export function DraftContext({
  request,
  briefing,
  draft,
  onChange,
}: {
  request: BrewRequest;
  briefing: BrewBriefing;
  draft: string;
  onChange: (text: string) => void;
}) {
  const matches = relatedMeetings(request, briefing),
    candidate = matches[0];
  const [open, setOpen] = useState(false),
    [time, setTime] = useState(() =>
      candidate ? localInput(meetingStart(candidate, briefing.updatedAt)) : "",
    ),
    [updated, setUpdated] = useState(false);
  const detected = detectsMeetingRequest(request);
  return (
    <div className="brew-draft-context">
      {detected ? (
        <section
          className="brew-proposed-time"
          aria-label="Meeting request proposal"
        >
          <strong>
            <span aria-hidden="true">◷</span> Meeting request detected
          </strong>
          <p>
            {candidate
              ? `Consider your existing ${candidate.title}, ${candidate.timeLabel} ET, before adding another meeting.`
              : "Choose a time to propose to the recipient."}
          </p>
          <small>
            Demo day ·{" "}
            {new Date(briefing.updatedAt).toLocaleDateString("en-US", {
              dateStyle: "long",
            })}
            . Neither your live calendar nor the recipient’s availability has
            been checked.
          </small>
          <label>
            Proposed start · {Intl.DateTimeFormat().resolvedOptions().timeZone}
            <input
              type="datetime-local"
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                setUpdated(false);
              }}
            />
          </label>
          <div className="brew-proposal-actions">
            <button
              type="button"
              disabled={!time}
              onClick={() => {
                onChange(proposalDraft(draft, time));
                setUpdated(true);
              }}
            >
              Regenerate reply with this time
            </button>
            <button
              type="button"
              disabled
              title="No connected calendar invitation capability"
            >
              Create calendar invite
            </button>
          </div>
          <p className="brew-context-note">
            Calendar invitations require a connected provider and an authorized
            invitation endpoint. Nothing is sent by updating a draft.
          </p>
          {updated ? (
            <p role="status">
              Draft updated with the proposed time. Review it before sending.
            </p>
          ) : null}
        </section>
      ) : null}
      <button
        type="button"
        className="brew-calendar-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open
          ? "Hide calendar context"
          : "Check calendar & related conversations"}{" "}
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <section
          className="brew-calendar-inspector"
          aria-label="Calendar context"
        >
          <strong>Your demo day · Eastern Time</strong>
          <p>
            Inspect the sample agenda here; your reply stays in the editor. Live
            calendar access and historical provider conversations are
            unavailable.
          </p>
          {briefing.meetings.map((m) => (
            <details key={m.id}>
              <summary>
                <time>{m.timeLabel}</time> {m.title}
              </summary>
              <p>
                {m.durationMinutes} minutes · {m.attendees.join(", ")}
              </p>
              <p>{m.detail}</p>
              <p>
                Recurrence:{" "}
                {m.id === "m-leadership-huddle"
                  ? "Weekly on weekdays (demo)"
                  : "not supplied"}
                . Last/next occurrence and discussion notes: not supplied.
              </p>
            </details>
          ))}
          <h3>Related conversation context</h3>
          {briefing.requests
            .filter((r) => r.id !== request.id && r.topic === request.topic)
            .slice(0, 3)
            .map((r) => (
              <details key={r.id}>
                <summary>{r.subject}</summary>
                <p>
                  {r.fromName} · {r.receivedLabel} in the demo briefing
                </p>
                <p>{r.summary}</p>
              </details>
            ))}
        </section>
      ) : null}
    </div>
  );
}
