"use client";

import { useTenant } from "../../components/tenant-provider";
import { BREW_CONNECTORS } from "./catalog";
import { EnrollmentPulse } from "./pulse";
import type {
  BrewBriefing,
  BrewDetailRef,
  BrewPreferences,
  BrewTimeframeId,
  EdwardRequest,
  MorningBrewDestination,
} from "./types";

const ET = "America/New_York";

const clockFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: ET,
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: ET,
});

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((part) => part.slice(0, 1))
    .join("")
    .slice(0, 2)
    .toUpperCase();

function EdwardChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="brew-edward-chip" type="button" onClick={onClick}>
      <span aria-hidden="true">E</span> {label}
    </button>
  );
}

export function MorningBrewDashboard({
  briefing,
  preferences,
  staffName,
  navigate,
  onOpenDetail,
  onAskEdward,
  onCustomize,
  onManageConnections,
}: {
  briefing: BrewBriefing;
  preferences: BrewPreferences;
  staffName: string;
  navigate: (destination: MorningBrewDestination) => void;
  onOpenDetail: (ref: BrewDetailRef) => void;
  onAskEdward: (request: EdwardRequest) => void;
  onCustomize: () => void;
  onManageConnections: () => void;
}) {
  const tenantRuntime = useTenant();
  const generatedAt = new Date(briefing.updatedAt);
  const updatedClock = clockFormatter.format(generatedAt);
  const fullDate = dateFormatter.format(generatedAt);
  const deliveryClock = `${briefing.deliveryLabel} AM ET`;
  const alerts =
    briefing.emails.filter((email) => email.priority === "high").length +
    briefing.priorities.filter((priority) => priority.level === "High").length;
  const connectedCount = BREW_CONNECTORS.filter((connector) => preferences.connectors[connector.id]).length;

  const showCalendar = preferences.connectors.calendar;
  const showEmail = preferences.connectors.outlook;
  const showPriorities = briefing.priorities.length > 0;
  const showDayGrid = showCalendar || showEmail || showPriorities;

  return (
    <div className="brew">
      <header className="brew-masthead">
        <div className="brew-masthead__brand">
          <span className="brew-masthead__mark" aria-hidden="true">
            A
          </span>
          <strong>Audentra</strong>
        </div>
        <div className="brew-masthead__title">
          <span className="brew-cup" aria-hidden="true" />
          <div>
            <strong>Morning Brew</strong>
            <small>Your daily enrollment briefing</small>
          </div>
        </div>
        <div className="brew-masthead__meta">
          <span className="brew-masthead__updated">
            <i aria-hidden="true">↻</i> Last updated {updatedClock}
          </span>
          <button
            className="brew-masthead__bell"
            type="button"
            onClick={() => navigate("messages")}
            aria-label={`${alerts} items need attention`}
          >
            <span aria-hidden="true">🔔</span>
            {alerts ? <i aria-hidden="true">{alerts}</i> : null}
          </button>
          <button
            className="brew-masthead__avatar"
            type="button"
            onClick={onCustomize}
            aria-label="Customize your Morning Brew"
          >
            {initialsOf(staffName)}
          </button>
        </div>
      </header>

      <section className="brew-hero">
        <div className="brew-hero__greeting">
          <h1>Good Morning {briefing.greetingName},</h1>
          <p>{briefing.deck}</p>
          <p className="brew-hero__read">
            <span aria-hidden="true">◷</span> Read time: ~{briefing.readTimeMinutes} min
          </p>
          <small>All times as of {deliveryClock}</small>
        </div>

        <div className="brew-hero__cards">
          <button
            className="brew-glance"
            type="button"
            onClick={() => (showEmail ? onOpenDetail({ kind: "email", id: briefing.emails[0]?.id ?? "" }) : onManageConnections())}
          >
            <span className="brew-glance__head">
              <i className="brew-glance__icon brew-glance__icon--mail" aria-hidden="true">
                ✉
              </i>
              Outlook
            </span>
            <strong>{showEmail ? briefing.inbox.unread : "—"}</strong>
            <small>{showEmail ? "Unread emails" : "Not connected"}</small>
            <em>{showEmail ? `${briefing.inbox.highPriority} High priority` : "Connect to see highlights"}</em>
            <span className="brew-glance__link">
              {showEmail ? "View highlights" : "Connect"} <i aria-hidden="true">→</i>
            </span>
          </button>

          <button
            className="brew-glance"
            type="button"
            onClick={() =>
              showCalendar ? onOpenDetail({ kind: "meeting", id: briefing.meetings[0]?.id ?? "" }) : onManageConnections()
            }
          >
            <span className="brew-glance__head">
              <i className="brew-glance__icon brew-glance__icon--calendar" aria-hidden="true">
                ▦
              </i>
              Calendar
            </span>
            <strong>{showCalendar ? briefing.inbox.meetings : "—"}</strong>
            <small>{showCalendar ? "Meetings today" : "Not connected"}</small>
            <em>
              {showCalendar ? `${briefing.inbox.meetingsHighPriority} High priority` : "Connect to see your agenda"}
            </em>
            <span className="brew-glance__link">
              {showCalendar ? "View agenda" : "Connect"} <i aria-hidden="true">→</i>
            </span>
          </button>

          <div className="brew-glance brew-glance--links">
            <span className="brew-glance__head">
              <i className="brew-glance__icon brew-glance__icon--link" aria-hidden="true">
                ⚯
              </i>
              Quick links
            </span>
            <ul>
              {briefing.quickLinks.map((link) => (
                <li key={link.id}>
                  <button type="button" onClick={() => navigate(link.destination)}>
                    {link.label}
                    <i aria-hidden="true">›</i>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {briefing.insights.length ? (
        <section className="brew-insights" aria-labelledby="brew-insights-title">
          <header className="brew-panel-head">
            <div>
              <p className="brew-eyebrow" id="brew-insights-title">
                <span aria-hidden="true">✦</span> Emerging AI insights for you
              </p>
              <p>Insights that may impact enrollment and need your attention today.</p>
            </div>
            <div className="brew-panel-head__actions">
              <EdwardChip
                label="Ask for insights"
                onClick={() => onAskEdward({ mode: "insights", context: "today's insights" })}
              />
              <button className="brew-link" type="button" onClick={() => navigate("overview")}>
                View all insights <span aria-hidden="true">→</span>
              </button>
            </div>
          </header>

          <div className="brew-insight-grid">
            {briefing.insights.map((insight, index) => (
              <article className={`brew-insight brew-insight--${insight.severity}`} key={insight.id}>
                <div className="brew-insight__top">
                  <span className="brew-insight__rank" aria-hidden="true">
                    {index + 1}
                  </span>
                  <h3>
                    <button
                      className="brew-stretch"
                      type="button"
                      onClick={() => onOpenDetail({ kind: "insight", id: insight.id })}
                    >
                      {insight.title}
                    </button>
                  </h3>
                  <span className={`brew-chip brew-chip--${insight.severity}`}>
                    {insight.severity === "positive" ? "Positive" : insight.severity === "high" ? "High" : "Medium"}
                  </span>
                </div>

                <p className="brew-insight__summary">{insight.summary}</p>
                <p className="brew-insight__projection">{insight.projection}</p>

                <div className="brew-insight__impact">
                  <small>{insight.impactLabel}</small>
                  <div>
                    {insight.impact.map((chip) => (
                      <span className={`brew-impact brew-impact--${chip.tone}`} key={chip.label}>
                        {chip.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="brew-insight__action">
                  <small>Recommended action</small>
                  <p>{insight.recommendedAction}</p>
                </div>

                <footer className="brew-insight__foot">
                  <span>
                    Impact: <b>{insight.impactLevel}</b> &nbsp;·&nbsp; Confidence: <b>{insight.confidence}%</b>
                  </span>
                  <button
                    className="brew-link"
                    type="button"
                    onClick={() => onOpenDetail({ kind: "insight", id: insight.id })}
                  >
                    View details <span aria-hidden="true">→</span>
                  </button>
                </footer>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <EnrollmentPulse
        kpis={briefing.kpis}
        refreshedAt={`${updatedClock} ET`}
        onOpenKpi={(id: string, timeframe: BrewTimeframeId) => onOpenDetail({ kind: "kpi", id, timeframe })}
        onAskEdward={() => onAskEdward({ mode: "insights", context: "the enrollment pulse" })}
        onOpenDashboard={() => navigate("overview")}
      />

      {briefing.changes.length ? (
        <section className="brew-changes" aria-labelledby="brew-changes-title">
          <header className="brew-panel-head">
            <div>
              <p className="brew-eyebrow" id="brew-changes-title">
                <span aria-hidden="true">↻</span> Since yesterday
              </p>
              <p>What actually moved in the last 24 hours across your teams.</p>
            </div>
            <div className="brew-panel-head__actions">
              <EdwardChip
                label="Summarize"
                onClick={() => onAskEdward({ mode: "summarize", context: "what changed since yesterday" })}
              />
            </div>
          </header>

          <ol className="brew-change-rail">
            {briefing.changes.map((change) => (
              <li className={`brew-change brew-change--${change.tone}`} key={change.id}>
                <time>{change.time}</time>
                <h3>
                  <button
                    className="brew-stretch"
                    type="button"
                    onClick={() => onOpenDetail({ kind: "change", id: change.id })}
                  >
                    {change.title}
                  </button>
                </h3>
                <p>{change.detail}</p>
                <span className="brew-change__foot">
                  {change.metric ? <b>{change.metric}</b> : null}
                  <i className={`brew-source brew-source--${change.source}`}>
                    {change.source === "workspace" ? "Live workspace" : "Modeled"}
                  </i>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {showDayGrid ? (
        <div className="brew-day-grid">
          {showCalendar ? (
            <section className="brew-panel" aria-labelledby="brew-calendar-title">
              <header className="brew-panel__head">
                <p className="brew-eyebrow" id="brew-calendar-title">
                  <span aria-hidden="true">▦</span> Today&rsquo;s calendar
                </p>
                <EdwardChip
                  label="Prep me"
                  onClick={() => onAskEdward({ mode: "prep", context: "today's calendar" })}
                />
              </header>
              <ul className="brew-list brew-list--meetings">
                {briefing.meetings.map((meeting) => (
                  <li key={meeting.id}>
                    <span className={`brew-dot brew-dot--${meeting.priority}`} aria-hidden="true" />
                    <time>
                      {meeting.time}
                      <small>{meeting.duration}</small>
                    </time>
                    <div>
                      <h3>
                        <button
                          className="brew-stretch"
                          type="button"
                          onClick={() => onOpenDetail({ kind: "meeting", id: meeting.id })}
                        >
                          {meeting.title}
                        </button>
                      </h3>
                      <p>{meeting.detail}</p>
                      <span className="brew-avatars">
                        {meeting.attendees.map((attendee) => (
                          <i key={attendee}>{attendee}</i>
                        ))}
                        {meeting.extraAttendees ? <b>{meeting.extraAttendees}</b> : null}
                      </span>
                    </div>
                    <span className={`brew-chip brew-chip--${meeting.priority}`}>
                      {meeting.priority === "high"
                        ? "High priority"
                        : meeting.priority === "medium"
                          ? "Medium priority"
                          : "Low priority"}
                    </span>
                  </li>
                ))}
              </ul>
              <footer className="brew-panel__foot">
                <button className="brew-link" type="button" onClick={() => navigate("overview")}>
                  View full calendar <span aria-hidden="true">→</span>
                </button>
              </footer>
            </section>
          ) : null}

          {showEmail ? (
            <section className="brew-panel" aria-labelledby="brew-email-title">
              <header className="brew-panel__head">
                <p className="brew-eyebrow" id="brew-email-title">
                  <span aria-hidden="true">✉</span> Email highlights
                </p>
                <EdwardChip
                  label="Summarize"
                  onClick={() => onAskEdward({ mode: "summarize", context: "today's email highlights" })}
                />
              </header>
              <ul className="brew-list brew-list--emails">
                {briefing.emails.map((email) => (
                  <li key={email.id}>
                    <span className={`brew-dot brew-dot--${email.priority}`} aria-hidden="true" />
                    <div>
                      <span className="brew-email__top">
                        <i className={`brew-chip brew-chip--${email.priority}`}>
                          {email.priority === "high" ? "High" : email.priority === "medium" ? "Medium" : "Low"}
                        </i>
                        <time>{email.time}</time>
                      </span>
                      <h3>
                        <button
                          className="brew-stretch"
                          type="button"
                          onClick={() => onOpenDetail({ kind: "email", id: email.id })}
                        >
                          {email.subject}
                        </button>
                      </h3>
                      <p>{email.summary}</p>
                      <span className="brew-row-actions">
                        <button type="button" onClick={() => onOpenDetail({ kind: "email", id: email.id })}>
                          View email
                        </button>
                        <button
                          className="is-edward"
                          type="button"
                          onClick={() =>
                            onAskEdward({ mode: "draft_reply", context: email.subject, emailId: email.id })
                          }
                        >
                          <span aria-hidden="true">E</span> Draft reply
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <footer className="brew-panel__foot">
                <button className="brew-link" type="button" onClick={() => navigate("messages")}>
                  View all emails <span aria-hidden="true">→</span>
                </button>
              </footer>
            </section>
          ) : null}

          {showPriorities ? (
            <section className="brew-panel" aria-labelledby="brew-priorities-title">
              <header className="brew-panel__head">
                <p className="brew-eyebrow" id="brew-priorities-title">
                  <span aria-hidden="true">⚑</span> Today&rsquo;s priorities
                </p>
                <EdwardChip
                  label="Summarize"
                  onClick={() => onAskEdward({ mode: "summarize", context: "today's priorities" })}
                />
              </header>
              <ul className="brew-list brew-list--priorities">
                {briefing.priorities.map((priority) => (
                  <li key={priority.id}>
                    <span className={`brew-priority-icon brew-priority-icon--${priority.level.toLowerCase()}`} aria-hidden="true">
                      {priority.icon}
                    </span>
                    <div>
                      <span className="brew-email__top">
                        <h3>
                          <button
                            className="brew-stretch"
                            type="button"
                            onClick={() => onOpenDetail({ kind: "priority", id: priority.id })}
                          >
                            {priority.title}
                          </button>
                        </h3>
                        <i className={`brew-chip brew-chip--${priority.level.toLowerCase()}`}>{priority.level}</i>
                      </span>
                      <p>{priority.detail}</p>
                      <span className="brew-row-actions">
                        <button type="button" onClick={() => navigate(priority.destination)}>
                          {priority.linkLabel} →
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <footer className="brew-panel__foot">
                <button className="brew-link" type="button" onClick={() => navigate("tasks")}>
                  View all work <span aria-hidden="true">→</span>
                </button>
              </footer>
            </section>
          ) : null}

          {!showCalendar || !showEmail ? (
            <section className="brew-connect-card">
              <span aria-hidden="true">↗</span>
              <div>
                <strong>Make it your morning</strong>
                <p>
                  {!showCalendar && !showEmail
                    ? "Connect your calendar and inbox to see today's agenda and the messages that need a decision."
                    : !showCalendar
                      ? "Connect your calendar to see today's agenda and prep notes."
                      : "Connect your inbox to see the messages that need a decision before noon."}
                </p>
                <small>
                  {connectedCount} of {BREW_CONNECTORS.length} sources connected
                </small>
              </div>
              <button className="button button--primary" type="button" onClick={onManageConnections}>
                Manage connections
              </button>
            </section>
          ) : null}
        </div>
      ) : null}

      {briefing.news.length ? (
        <section className="brew-news" aria-labelledby="brew-news-title">
          <header className="brew-panel-head">
            <div>
              <h2 id="brew-news-title">
                <span className="brew-panel-head__glyph" aria-hidden="true">
                  ◎
                </span>
                Higher Ed News
              </h2>
              <p>Curated for you</p>
            </div>
            <div className="brew-panel-head__actions">
              <EdwardChip
                label="Why it matters"
                onClick={() => onAskEdward({ mode: "insights", context: "today's higher ed news" })}
              />
              <button className="brew-link" type="button" onClick={() => navigate("knowledge")}>
                View all news <span aria-hidden="true">→</span>
              </button>
            </div>
          </header>

          <div className="brew-news-grid">
            {briefing.news.map((item) => (
              <article className="brew-news-card" key={item.id}>
                <img src={item.image} alt={item.imageAlt} loading="lazy" />
                <div>
                  <span className="brew-news-card__meta">
                    <b>{item.sourceName}</b>
                    <time>{item.published}</time>
                  </span>
                  <h3>
                    <button
                      className="brew-stretch"
                      type="button"
                      onClick={() => onOpenDetail({ kind: "news", id: item.id })}
                    >
                      {item.headline}
                    </button>
                  </h3>
                  <small>{item.readTime}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="brew-colophon">
        <p>
          All times in Eastern Time (ET) &nbsp;·&nbsp; {fullDate}, {updatedClock} &nbsp;·&nbsp;{" "}
          {tenantRuntime.tenant.shortName} daily edition
        </p>
        <div>
          <button type="button" onClick={onCustomize}>
            Customize brief
          </button>
          <button type="button" onClick={onManageConnections}>
            Manage connections
          </button>
          <button
            className="brew-feedback"
            type="button"
            onClick={() => onAskEdward({ mode: "ask", context: "this briefing", question: "" })}
          >
            Have feedback? <span aria-hidden="true">💬</span>
          </button>
        </div>
      </footer>

      <p className="brew-disclaimer">
        Items labeled &ldquo;Live workspace&rdquo; are derived from your Audentra data. Insights, connector
        content, and external news are synthetic demonstration material.
      </p>
    </div>
  );
}
