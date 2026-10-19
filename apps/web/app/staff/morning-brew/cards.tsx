"use client";

import { useId, useState } from "react";
import styles from "./intelligence.module.css";
import { topicById } from "./catalog";
import { Glyph } from "./glyphs";
import {
  emailPresentation,
  formatEmailTimestamp,
  initialsOf,
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
  const [showWhy, setShowWhy] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const whyId = useId();
  const evidenceId = useId();
  const topic = topicById(insight.topic);
  // Reformat the supplied figures only; do not infer new forecasts or exposure.
  const splitFigure = (label: string) => {
    const match = label.match(/^([+−≈-]?\$?[\d,.]+(?:[MK%]|pp)?)(?:\s+(.+))?$/);
    const heading = match?.[2] ?? (label.includes("$") ? "Tuition Impact" : "Projected Impact");
    return {
      value: match?.[1] ?? label,
      label: heading.replace(/\b[a-z]/g, (letter) => letter.toUpperCase()),
    };
  };
  const signal = splitFigure(insight.stats.glance.split(" · ")[0]);

  return (
    <article
      className={`brew-insight ${styles.card}${preview ? ` ${styles.preview}` : ""}`}
      data-level={level}
    >
      <div className={styles.topline}>
        <span className={styles.category}>
          <Glyph name={topic?.icon ?? "students"} size={12} />
          {topic?.title ?? insight.label}
        </span>
        <div className={styles.controls}>
          <span className={styles.confidence}>{insight.confidence}% confidence</span>
          <EdwardButton label={`Ask Edward about ${insight.title}`} onClick={onAskEdward} />
        </div>
      </div>
      <h3 className={styles.title}>
        <button className="brew-stretch" type="button" onClick={onOpen}>{insight.title}</button>
      </h3>
      <p className={styles.summary}>{insight.summary}</p>

      <div className={styles.forecast}>
        <div className={styles.forecastHead}>
          <span>Forecasted impact</span>
          {level !== "glance" ? (
            <div
              className={styles.whyWrap}
              onMouseEnter={() => setShowWhy(true)}
              onMouseLeave={(event) => {
                if (!event.currentTarget.contains(document.activeElement)) setShowWhy(false);
              }}
              onFocus={() => setShowWhy(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setShowWhy(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setShowWhy(false);
                }
              }}
            >
              <button type="button" className={styles.disclosure} aria-expanded={showWhy}
                aria-describedby={whyId} onClick={() => setShowWhy(true)}>
                <span aria-hidden="true">ⓘ</span> Why it matters
              </button>
              <div className={styles.whyTooltip} id={whyId} role="tooltip" hidden={!showWhy}>
                <strong>Why it matters</strong>
                <p>{insight.projection}</p>
                <p>{insight.context}</p>
              </div>
            </div>
          ) : <span className={styles.impactLevel}>{insight.impactLevel} impact</span>}
        </div>
        <dl className={styles.figures}>
          {level !== "glance" ? <div><dt>{signal.label}</dt><dd>{signal.value}</dd></div> : null}
          {insight.impact.map((chip) => {
            const figure = splitFigure(chip.label);
            return <div key={chip.label} data-tone={chip.tone}><dt>{figure.label}</dt><dd>{figure.value}</dd></div>;
          })}
        </dl>
      </div>

      <div className={styles.recommendation}>
        <small>Recommended next move</small>
        <p>{insight.recommendations[level]}</p>
      </div>

      {level === "deep" ? <div className={styles.deep}>
        <small>Behind the signal</small>
        <p>{insight.deepDive}</p>
        <p className={styles.stats}>{insight.stats.deep}</p>
        {insight.detail.students.length > 0 ? <ul className={styles.cohort}>
          {insight.detail.students.slice(0, 2).map((student) => <li key={student.id}>
            <Avatar name={student.name} /><span><strong>{student.name}</strong><small>{student.program}</small></span>
          </li>)}
        </ul> : null}
      </div> : null}

      <footer className={styles.footer}>
        <button type="button" className={styles.evidenceToggle} aria-expanded={showEvidence}
          aria-controls={evidenceId} onClick={() => setShowEvidence(!showEvidence)}>
          Why am I seeing this? <span aria-hidden="true">{showEvidence ? "⌃" : "⌄"}</span>
        </button>
        <button className="brew-link" type="button" onClick={onOpen}>
          View details <Glyph name="arrow" size={13} />
        </button>
      </footer>
      {showEvidence ? <div className={styles.evidence} id={evidenceId}>
        <strong>Underlying signal · {topic?.title ?? insight.label}</strong>
        <p>{insight.context}</p>
        {insight.detail.evidence.length ? <ul>{insight.detail.evidence.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      </div> : null}
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
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <li className="brew-news-card">
      {imageFailed ? (
        <span className="brew-news-card__cover brew-news-card__fallback" aria-hidden="true">
          {item.publisherMark}
        </span>
      ) : (
        <img
          className="brew-news-card__cover"
          src={item.image}
          onError={() => setImageFailed(true)}
          alt={item.imageAlt}
          loading="lazy"
          width={200}
          height={200}
        />
      )}
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
