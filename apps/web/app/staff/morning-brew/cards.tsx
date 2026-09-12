"use client";

import { topicById } from "./catalog";
import { Glyph } from "./glyphs";
import {
  emailPresentation,
  formatEmailTimestamp,
  initialsOf,
  insightPreviewActions,
} from "./presentation";
import type {
  BrewDetailLevelId,
  BrewInsight,
  BrewMeeting,
  BrewNewsItem,
  BrewPriority,
  BrewRequest,
} from "./types";

export function EdwardButton({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return onClick ? (
    <button
      className="brew-kpi__edward"
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <span aria-hidden="true">E</span>
    </button>
  ) : (
    <span className="brew-kpi__edward" aria-hidden="true">
      <span>E</span>
    </span>
  );
}

export function Avatar({ name, photo }: { name: string; photo?: string }) {
  return (
    <span className="brew-person-avatar" aria-hidden="true">
      {photo ? <img src={photo} alt="" /> : initialsOf(name)}
    </span>
  );
}

export function Attendees({ names }: { names: string[] }) {
  return (
    <span className="brew-attendees">
      {names.slice(0, 3).map((name) => (
        <i title={name} key={name}>
          {initialsOf(name)}
        </i>
      ))}
      {names.length > 3 ? <b>+{names.length - 3}</b> : null}
      <span className="sr-only">{names.join(", ")}</span>
    </span>
  );
}

export function IntelligenceCard({
  insight,
  level,
  preview = false,
  onOpen,
  onAskEdward,
}: {
  insight: BrewInsight;
  level: BrewDetailLevelId;
  preview?: boolean;
  onOpen?: () => void;
  onAskEdward?: () => void;
}) {
  return (
    <article
      className={`brew-insight brew-insight--${insight.severity}${preview ? " brew-insight--preview" : ""}`}
    >
      <div className="brew-insight__top">
        <span className="brew-insight__rank" aria-hidden="true">
          <Glyph
            name={topicById(insight.topic)?.icon ?? "students"}
            size={15}
          />
        </span>
        <h3>
          <button className="brew-stretch" type="button" onClick={onOpen}>
            {insight.title}
          </button>
        </h3>
        <EdwardButton
          label={`Ask Edward about ${insight.title}`}
          onClick={onAskEdward}
        />
      </div>

      <p className="brew-insight__summary">
        {preview
          ? insight.stats.glance
              .split(" · ")
              .slice(0, 2)
              .map((stat) => <span key={stat}>{stat}</span>)
          : insight.summary}
      </p>
      {!preview ? (
        <p className="brew-insight__projection">{insight.projection}</p>
      ) : null}

      {!preview && level !== "glance" ? (
        <p className="brew-insight__stats">{insight.stats[level]}</p>
      ) : null}
      {!preview && level !== "glance" ? (
        <p className="brew-insight__reading">
          {level === "deep" ? insight.deepDive : insight.context}
        </p>
      ) : null}

      <div className="brew-insight__impact">
        <small>Potential impact · {insight.impactLevel}</small>
        <div>
          {(preview ? insight.impact.slice(0, 1) : insight.impact).map(
            (chip) => (
              <span
                className={`brew-impact brew-impact--${chip.tone}`}
                key={chip.label}
              >
                {chip.label}
              </span>
            ),
          )}
        </div>
      </div>

      {!preview || level !== "glance" ? (
        <div className="brew-insight__action">
          <small>Recommended action</small>
          <p>
            {preview
              ? (insightPreviewActions[insight.id] ??
                insight.recommendations.glance)
              : insight.recommendations[level]}
          </p>
        </div>
      ) : null}

      {level === "deep" && insight.detail.students.length > 0 ? (
        <div className="brew-insight__cohort">
          <small>In the cohort</small>
          <ul>
            {insight.detail.students.slice(0, 2).map((student) => (
              <li key={student.id}>
                <Avatar name={student.name} />
                <span>
                  <strong>{student.name}</strong>
                  {!preview ? <small>{student.program}</small> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <footer className="brew-insight__foot">
        <button className="brew-link" type="button" onClick={onOpen}>
          View details <Glyph name="arrow" size={13} />
        </button>
      </footer>
    </article>
  );
}

export function EmailRow({
  request,
  level,
  referenceDate,
  onOpen,
  replied = false,
}: {
  replied?: boolean;
  request: BrewRequest;
  level: BrewDetailLevelId;
  referenceDate: string;
  onOpen?: () => void;
}) {
  const state = emailPresentation(request);
  const signal = replied ? "read" : state.signal;
  const signalLabel = replied ? "Replied in demo" : state.label;
  return (
    <li className="brew-email-row">
      <span
        className={`brew-email-signal is-${signal}`}
        role="img"
        aria-label={signalLabel}
        title={signalLabel}
      >
        {signal === "unread" ? (
          <i />
        ) : signal === "read" ? (
          <Glyph name="mail" size={14} />
        ) : (
          <Glyph name={signal === "pending" ? "reply" : "flag"} size={14} />
        )}
      </span>
      <Avatar name={request.fromName} photo={state.avatarUrl} />
      <div className="brew-email-row__content">
        <div className="brew-email-row__sender">
          <strong>{request.fromName}</strong>
          <time dateTime={state.receivedAt}>
            {formatEmailTimestamp(
              state.receivedAt,
              referenceDate,
              request.receivedLabel,
            )}
          </time>
        </div>
        <p className="brew-email-row__role">{request.fromRole}</p>
        <h3>
          <button className="brew-stretch" type="button" onClick={onOpen}>
            {request.subject}
          </button>
        </h3>
        {level !== "glance" ? (
          <p className="brew-email__body">{request.summary}</p>
        ) : null}
        {level === "deep" ? (
          <p className="brew-row__cue">{request.waitingLabel}</p>
        ) : null}
      </div>
    </li>
  );
}

export function CalendarRow({
  meeting,
  level,
  onOpen,
}: {
  meeting: BrewMeeting;
  level: BrewDetailLevelId;
  onOpen?: () => void;
}) {
  return (
    <li className="brew-calendar-row">
      <time>
        {meeting.timeLabel}
        <small>{meeting.durationMinutes} min</small>
      </time>
      <div>
        <h3>
          <button className="brew-stretch" type="button" onClick={onOpen}>
            {meeting.title}
          </button>
        </h3>
        <p>{meeting.detail}</p>
        {level !== "glance" ? (
          <p className="brew-prep-line">{meeting.prep}</p>
        ) : null}
        <div className="brew-calendar-row__foot">
          <Attendees names={meeting.attendees} />
          <small>
            {meeting.organizer ? "Hosting" : "Attending"}
            {meeting.priority === "high" ? " · Important" : ""}
          </small>
        </div>
        {level === "deep" ? (
          <p className="brew-guests">{meeting.attendees.join(", ")}</p>
        ) : null}
      </div>
    </li>
  );
}

export function PriorityRow({
  priority,
  level,
  onOpen,
}: {
  priority: BrewPriority;
  level: BrewDetailLevelId;
  onOpen?: () => void;
}) {
  return (
    <li>
      <span
        className={`brew-priority-flag brew-priority-flag--${priority.level.toLowerCase()}`}
        aria-hidden="true"
      >
        <Glyph name="flag" size={16} />
      </span>
      <div>
        <span className="brew-row__top">
          <h3>
            <button className="brew-stretch" type="button" onClick={onOpen}>
              {priority.title}
            </button>
          </h3>
          <i className={`brew-chip brew-chip--${priority.level.toLowerCase()}`}>
            Priority · {priority.level}
          </i>
        </span>
        <p>{priority.detail}</p>
        {/* "With Context" adds the next step and who owns it, which
                        is the difference between a queue and a decision. */}
        {level !== "glance" ? (
          <p className="brew-prep-line">
            <span aria-hidden="true">→</span> {priority.steps[0]}
          </p>
        ) : null}
        {level !== "glance" ? (
          <p className="brew-row__cue">
            {priority.window}
            {priority.ownedByReader
              ? " · yours to move"
              : " · someone else's to report"}
          </p>
        ) : null}
        {level === "deep" ? (
          <p className="brew-row__facts">
            {priority.breakdown
              .map((row) => `${row.label}: ${row.value}`)
              .join("  ·  ")}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function NewsCard({
  item,
  level,
}: {
  item: BrewNewsItem;
  level: BrewDetailLevelId;
}) {
  return (
    <li className="brew-news-card">
      <img
        className="brew-news-card__cover"
        src={item.image}
        alt={item.imageAlt}
        loading="lazy"
        width={200}
        height={200}
      />
      <div className="brew-news-card__body">
        <span className="brew-news-card__byline">
          {item.publisher}
          <b>{item.publishedLabel}</b>
        </span>
        <h3>
          <a href={item.url} target="_blank" rel="noreferrer noopener">
            {item.title}
          </a>
        </h3>
        {/* Read time carries the same clock the hero's does, so the two
                  places that estimate a read look like one habit. */}
        {level === "glance" ? (
          <p className="brew-news-card__read">
            <Glyph name="clock" size={11} /> {item.readMinutes} min read
          </p>
        ) : (
          <>
            <p className="brew-news-card__bearing">{item.bearing}</p>
            <p className="brew-news-card__read">
              <Glyph name="clock" size={11} /> {item.readMinutes} min read
            </p>
          </>
        )}
      </div>
    </li>
  );
}
