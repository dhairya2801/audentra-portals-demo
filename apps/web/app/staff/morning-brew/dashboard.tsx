"use client";

import { useMemo, useState } from "react";
import { useTenant } from "../../components/tenant-provider";
import { BREW_SOURCES } from "./catalog";
import { edwardKpiGreeting, levelOf } from "./data";
import { Glyph, OutlookMark } from "./glyphs";
import { InstitutionalPulse } from "./pulse";
import type {
  BrewBriefing,
  BrewDetailLevelId,
  BrewDetailRef,
  BrewMeeting,
  BrewNewsItem,
  BrewPreferences,
  BrewPriority,
  BrewRequest,
  EdwardRequest,
  MorningBrewNavigate,
} from "./types";

const ET = "America/New_York";

const clockFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: ET,
});
const countFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: ET,
});

/**
 * How many rows each day panel opens with, and how many more "View more"
 * reveals.
 *
 * The three panels sit side by side, so the numbers are shared rather than
 * per-section: a column that opened with six rows against its neighbours' four
 * would make the row of panels ragged before a single reader had chosen
 * anything. Expanding keeps the same panel height and scrolls inside it, so
 * opening one column never moves the page under the other two.
 */
const PANEL_ROWS = 4;
const PANEL_MORE = 5;

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((part) => part.slice(0, 1))
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** High / Medium / Low, said the same way in all three panels. */
const LEVEL_LABEL: Record<string, string> = {
  high: "High",
  urgent: "High",
  medium: "Medium",
  low: "Low",
};

/* ---------------------------------------------------------------- day panel */

interface PanelView<T> {
  id: string;
  label: string;
  /** What the view leaves out, said in the empty state when it leaves out all of it. */
  empty: string;
  filter: (item: T) => boolean;
}

/**
 * One of the three columns of the day: Calendar, Email, Action Center.
 *
 * All three are the same shape on purpose. Each opens on four rows at a fixed
 * height, offers a few ways to cut the list, and holds the next five behind
 * "View more" — which scrolls inside the panel rather than growing it, so the
 * three columns stay level however the reader works them.
 */
function DayPanel<T extends { id: string }>({
  id,
  title,
  glyph,
  tone,
  action,
  items,
  views,
  view,
  onView,
  emptyMessage,
  render,
}: {
  id: string;
  title: string;
  glyph: string;
  /** Which colour the panel's head mark carries. */
  tone: "rose" | "blue";
  action: React.ReactNode;
  items: T[];
  views: PanelView<T>[];
  view: string;
  onView: (next: string) => void;
  emptyMessage: string;
  render: (item: T) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const active = views.find((option) => option.id === view) ?? views[0];
  const filtered = useMemo(() => items.filter(active.filter), [items, active]);
  const limit = expanded ? PANEL_ROWS + PANEL_MORE : PANEL_ROWS;
  const shown = filtered.slice(0, limit);
  const hidden = filtered.length - shown.length;

  return (
    <section className="brew-panel" aria-labelledby={`${id}-title`}>
      <header className="brew-panel__head">
        <h2 className="brew-panel__title" id={`${id}-title`}>
          <i className={`brew-panel__mark brew-panel__mark--${tone}`} aria-hidden="true">
            <Glyph name={glyph} size={17} />
          </i>
          {title}
        </h2>
        {action}
      </header>

      <div className="brew-panel__views" role="tablist" aria-label={`How to read ${title}`}>
        {views.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={option.id === active.id}
            className={option.id === active.id ? "is-active" : undefined}
            onClick={() => {
              onView(option.id);
              setExpanded(false);
            }}
          >
            {option.label}
            <i>{items.filter(option.filter).length}</i>
          </button>
        ))}
      </div>

      <div className={expanded ? "brew-panel__body is-scrolling" : "brew-panel__body"}>
        {shown.length ? (
          <ul className={`brew-list brew-list--${id}`}>{shown.map(render)}</ul>
        ) : (
          <p className="brew-panel__empty">
            {filtered.length === items.length ? emptyMessage : active.empty}
          </p>
        )}
      </div>

      <footer className="brew-panel__foot">
        {hidden > 0 ? (
          <button className="brew-more" type="button" onClick={() => setExpanded(true)}>
            View more
          </button>
        ) : expanded && filtered.length > PANEL_ROWS ? (
          <button className="brew-more" type="button" onClick={() => setExpanded(false)}>
            View less
          </button>
        ) : (
          <span className="brew-more brew-more--rest">All {filtered.length} shown</span>
        )}
      </footer>
    </section>
  );
}

/** The first three guests, then a count. The row is a pointer, not a roster. */
function Attendees({ names }: { names: string[] }) {
  if (!names.length) return null;
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;
  return (
    <span className="brew-attendees">
      {shown.map((name) => (
        <i title={name} key={name}>
          <Glyph name="applications" size={10} />
        </i>
      ))}
      {rest > 0 ? <b>+{rest}</b> : null}
      <span className="sr-only">{names.join(", ")}</span>
    </span>
  );
}

/* --------------------------------------------------------------------- news */

/**
 * Higher Ed News — the one band that is not a count of this tenant's records,
 * and the only one that links off the platform. Every card carries its
 * publisher and its date for exactly that reason: the reader can go and check
 * it, which is not something a KPI ever asks of them.
 */
function NewsSection({
  news,
  level,
  onViewAll,
}: {
  news: BrewNewsItem[];
  /** At "With Context" each story says what it lands on here. */
  level: BrewDetailLevelId;
  onViewAll: () => void;
}) {
  return (
    <section className="brew-news" aria-labelledby="brew-news-title">
      <header className="brew-section-head">
        <h2 id="brew-news-title">
          <i className="brew-section-head__mark brew-section-head__mark--navy" aria-hidden="true">
            <Glyph name="broadcast" size={19} />
          </i>
          Higher Ed News
          <small>Curated for you</small>
        </h2>
        <div className="brew-section-head__actions">
          <button className="brew-link" type="button" onClick={onViewAll}>
            View all news <Glyph name="arrow" size={13} />
          </button>
        </div>
      </header>

      <ol className="brew-news__rail">
        {news.map((item) => (
          <li className="brew-news-card" key={item.id}>
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
              {level === "glance" ? (
                <p className="brew-news-card__read">{item.readMinutes} min read</p>
              ) : (
                <>
                  <p className="brew-news-card__bearing">{item.bearing}</p>
                  <p className="brew-news-card__read">{item.readMinutes} min read</p>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>

      <p className="brew-news__basis">
        An outside editorial feed, not your records. Nothing here is counted into a figure above.
      </p>
    </section>
  );
}

function EdwardChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="brew-edward-chip" type="button" onClick={onClick}>
      <span aria-hidden="true">E</span> {label}
    </button>
  );
}

/* ---------------------------------------------------------------- the views */

const MEETING_VIEWS: PanelView<BrewMeeting>[] = [
  {
    id: "all",
    label: "All",
    empty: "Nothing is on the calendar today.",
    filter: () => true,
  },
  {
    id: "high",
    label: "High",
    empty: "Nothing today is marked high priority.",
    filter: (meeting) => meeting.priority === "high",
  },
  {
    id: "morning",
    label: "Morning",
    empty: "Your morning is clear.",
    filter: (meeting) => meeting.startsAtMinutes < 12 * 60,
  },
  {
    id: "mine",
    label: "Mine",
    empty: "You are not the organizer of anything today.",
    filter: (meeting) => meeting.organizer,
  },
];

const REQUEST_VIEWS: PanelView<BrewRequest>[] = [
  {
    id: "all",
    label: "All",
    empty: "Your inbox is empty this morning.",
    filter: () => true,
  },
  {
    id: "important",
    label: "Important",
    empty: "Nothing this morning is flagged important.",
    filter: (request) => request.important,
  },
  {
    id: "unread",
    label: "Unread",
    empty: "Nothing is unread. Everything this morning has been opened.",
    filter: (request) => request.unread,
  },
  {
    id: "urgent",
    label: "Urgent",
    empty: "Nothing in the inbox is marked urgent.",
    filter: (request) => request.priority === "urgent",
  },
];

const PRIORITY_VIEWS: PanelView<BrewPriority>[] = [
  {
    id: "all",
    label: "All",
    empty: "No queue needs a decision from you this morning.",
    filter: () => true,
  },
  {
    id: "high",
    label: "High",
    empty: "Nothing is running at high priority.",
    filter: (priority) => priority.level === "High",
  },
  {
    id: "mine",
    label: "Mine",
    empty: "Nothing here is waiting on you specifically.",
    filter: (priority) => priority.ownedByReader,
  },
  {
    id: "week",
    label: "This week",
    empty: "Nothing here has to move this week.",
    filter: (priority) => priority.window === "Today" || priority.window === "This week",
  },
];

/* ---------------------------------------------------------------- dashboard */

export function MorningBrewDashboard({
  briefing,
  preferences,
  navigate,
  onOpenDetail,
  onAskEdward,
  onCustomize,
  onManageConnections,
}: {
  briefing: BrewBriefing;
  preferences: BrewPreferences;
  navigate: MorningBrewNavigate;
  onOpenDetail: (ref: BrewDetailRef) => void;
  onAskEdward: (request: EdwardRequest) => void;
  onCustomize: () => void;
  onManageConnections: () => void;
}) {
  const tenantRuntime = useTenant();
  const generatedAt = new Date(briefing.updatedAt);
  const updatedClock = clockFormatter.format(generatedAt);
  const fullDate = dateFormatter.format(generatedAt);
  const alerts =
    briefing.glance.requestsAwaitingReply +
    briefing.priorities.filter((priority) => priority.level === "High").length;
  const includedCount = BREW_SOURCES.filter(
    (source) => preferences.sources[source.id].enabled,
  ).length;

  const [meetingView, setMeetingView] = useState("all");
  const [requestView, setRequestView] = useState("all");
  const [priorityView, setPriorityView] = useState("all");

  const showMeetings = preferences.sources.calendar.enabled;
  const calendarLevel = levelOf(preferences, "calendar");
  const showRequests = preferences.sources.email.enabled;
  const emailLevel = levelOf(preferences, "email");
  const actionLevel = levelOf(preferences, "actions");
  const newsLevel = levelOf(preferences, "news");
  const pulseLevel = levelOf(preferences, "pulse");
  // How much of a finding is printed is the reader's own answer for
  // Institutional Intelligence, not a separate setting they had to find.
  const intelligenceLevel = levelOf(preferences, "intelligence");
  const showReading = intelligenceLevel !== "glance";
  const showPriorities = briefing.priorities.length > 0;
  const showDayGrid = showMeetings || showRequests || showPriorities;
  const emptyBriefing =
    !briefing.insights.length && !briefing.kpis.length && !briefing.news.length && !showDayGrid;

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
            <Glyph name="refresh" size={12} /> Last updated {updatedClock}
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
            title={`${briefing.reader.name} · ${briefing.reader.email}`}
            aria-label={`Customize ${briefing.reader.name}'s Morning Brew`}
          >
            {initialsOf(briefing.reader.name)}
          </button>
        </div>
      </header>

      <section className="brew-hero">
        <div className="brew-hero__greeting">
          <h1>Good Morning {briefing.greetingName},</h1>
          <p className="brew-hero__deck">{briefing.deck}</p>
          <p className="brew-hero__meta">
            <Glyph name="clock" size={14} /> Read time: ~{briefing.readTimeMinutes} min
          </p>
          {/* The read-across belongs to Institutional Intelligence, so it only
              appears when the reader asked that section for the long version. */}
          {intelligenceLevel === "deep" && briefing.bullets.length ? (
            <ul className="brew-hero__bullets">
              {briefing.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="brew-hero__cards">
          <button
            className="brew-glance"
            type="button"
            onClick={() =>
              showRequests
                ? onOpenDetail({ kind: "request", id: briefing.requests[0]?.id ?? "" })
                : onManageConnections()
            }
          >
            <span className="brew-glance__head">
              <i className="brew-glance__icon brew-glance__icon--plain" aria-hidden="true">
                <OutlookMark size={18} />
              </i>
              Outlook
            </span>
            <strong>{showRequests ? countFormatter.format(briefing.glance.requests) : "—"}</strong>
            <small>{showRequests ? "Unread emails" : "Turned off"}</small>
            <em>
              {showRequests
                ? `${briefing.glance.requestsAwaitingReply} High priority`
                : "Switch it on to see who is waiting"}
            </em>
            <span className="brew-glance__link">
              {showRequests ? "View highlights" : "Turn it on"} <Glyph name="arrow" size={13} />
            </span>
          </button>

          <button
            className="brew-glance"
            type="button"
            onClick={() =>
              showMeetings
                ? onOpenDetail({ kind: "meeting", id: briefing.meetings[0]?.id ?? "" })
                : onManageConnections()
            }
          >
            <span className="brew-glance__head">
              <i className="brew-glance__icon brew-glance__icon--calendar" aria-hidden="true">
                <Glyph name="calendar" size={15} />
              </i>
              Calendar
            </span>
            <strong>{showMeetings ? countFormatter.format(briefing.glance.meetings) : "—"}</strong>
            <small>{showMeetings ? "Meetings today" : "Turned off"}</small>
            <em>
              {showMeetings
                ? `${briefing.glance.meetingsHighPriority} High priority`
                : "Switch it on to see the day"}
            </em>
            <span className="brew-glance__link">
              {showMeetings ? "View agenda" : "Turn it on"} <Glyph name="arrow" size={13} />
            </span>
          </button>

          <div className="brew-glance brew-glance--links">
            <span className="brew-glance__head">
              <i className="brew-glance__icon brew-glance__icon--link" aria-hidden="true">
                <Glyph name="links" size={15} />
              </i>
              Quick links
            </span>
            <ul>
              {briefing.quickLinks.map((link) => (
                <li key={link.id}>
                  <button type="button" onClick={() => navigate(link.destination)}>
                    {link.label}
                    <Glyph name="chevron" size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {emptyBriefing ? (
        <section className="brew-empty" aria-live="polite">
          <span aria-hidden="true">◔</span>
          <div>
            <strong>Nothing to report in the topics you follow.</strong>
            <p>
              Every section you switched on came back empty against today&rsquo;s canonical
              records. That is the whole answer — there is no fallback content to show in its
              place.
            </p>
          </div>
          <button className="button button--primary" type="button" onClick={onCustomize}>
            Follow more topics
          </button>
        </section>
      ) : null}

      {briefing.insights.length ? (
        <section className="brew-insights" aria-labelledby="brew-insights-title">
          <header className="brew-section-head">
            <h2 id="brew-insights-title">
              <i
                className="brew-section-head__mark brew-section-head__mark--blue"
                aria-hidden="true"
              >
                <Glyph name="sparkle" size={20} />
              </i>
              Institutional Intelligence
              <small>Insights that may impact enrollment and your attention today.</small>
            </h2>
            <div className="brew-section-head__actions">
              <EdwardChip
                label="Ask for the students"
                onClick={() => onAskEdward({ mode: "insights", context: "today's attention list" })}
              />
              <button className="brew-link" type="button" onClick={() => navigate("students")}>
                View all insights <Glyph name="arrow" size={13} />
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
                    {insight.severity === "positive"
                      ? "Positive"
                      : insight.severity === "high"
                        ? "High"
                        : "Medium"}
                  </span>
                </div>

                <p className="brew-insight__summary">{insight.summary}</p>
                <p className="brew-insight__projection">{insight.projection}</p>

                {showReading ? (
                  <p className="brew-insight__stats">{insight.stats[intelligenceLevel]}</p>
                ) : null}
                {showReading ? (
                  <p className="brew-insight__reading">
                    {intelligenceLevel === "deep" ? insight.deepDive : insight.context}
                  </p>
                ) : null}

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
                  <p>{insight.recommendations[intelligenceLevel]}</p>
                </div>

                <footer className="brew-insight__foot">
                  <span>Impact: {insight.impactLevel}</span>
                  <span>Confidence: {insight.confidence}%</span>
                  <button
                    className="brew-link"
                    type="button"
                    onClick={() => onOpenDetail({ kind: "insight", id: insight.id })}
                  >
                    View details <Glyph name="arrow" size={13} />
                  </button>
                </footer>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <InstitutionalPulse
        kpis={briefing.kpis}
        level={pulseLevel}
        readerFirstName={briefing.reader.firstName}
        refreshedAt={`${updatedClock} ET`}
        cycleLabel={briefing.cycleLabel}
        onOpenKpi={(id: string) => onOpenDetail({ kind: "kpi", id })}
        onAskEdwardFor={(kpi) =>
          onAskEdward({
            mode: "cohort",
            context: kpi.label,
            greeting: edwardKpiGreeting(briefing.reader.firstName, kpi.label),
          })
        }
        onOpenDashboard={() => navigate("overview")}
      />

      {showDayGrid ? (
        <div className="brew-day-grid">
          {showMeetings ? (
            <DayPanel
              id="meetings"
              title="Calendar"
              glyph="calendar"
              tone="rose"
              action={
                <EdwardChip
                  label="Prep me"
                  onClick={() =>
                    onAskEdward({
                      mode: "summarize",
                      context: "today's meetings",
                    })
                  }
                />
              }
              items={briefing.meetings}
              views={MEETING_VIEWS}
              view={meetingView}
              onView={setMeetingView}
              emptyMessage="Nothing is on today's calendar for the topics you follow."
              render={(meeting) => (
                <li key={meeting.id}>
                  <span className={`brew-dot brew-dot--${meeting.priority}`} aria-hidden="true" />
                  <time>
                    {meeting.timeLabel}
                    <small>{meeting.durationMinutes} min</small>
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
                    {calendarLevel !== "glance" && meeting.priority === "high" ? (
                      <p className="brew-prep-line">
                        <span aria-hidden="true">✎</span> {meeting.prep}
                      </p>
                    ) : null}
                    <Attendees names={meeting.attendees} />
                    {calendarLevel === "deep" ? (
                      <p className="brew-guests">{meeting.attendees.join(", ")}</p>
                    ) : null}
                  </div>
                  <span className={`brew-chip brew-chip--${meeting.priority}`}>
                    {LEVEL_LABEL[meeting.priority]}
                  </span>
                </li>
              )}
            />
          ) : null}

          {showRequests ? (
            <DayPanel
              id="emails"
              title="Email"
              glyph="mail"
              tone="rose"
              action={
                <EdwardChip
                  label="Summarize"
                  onClick={() =>
                    onAskEdward({ mode: "summarize", context: "this morning's inbox" })
                  }
                />
              }
              items={briefing.requests}
              views={REQUEST_VIEWS}
              view={requestView}
              onView={setRequestView}
              emptyMessage="Nothing is waiting on a reply from you this morning."
              render={(request) => (
                <li key={request.id}>
                  <span
                    className={`brew-dot brew-dot--${
                      request.priority === "urgent" ? "high" : request.priority
                    }`}
                    aria-hidden="true"
                  />
                  <time>{request.receivedLabel}</time>
                  <div>
                    <h3>
                      <button
                        className="brew-stretch"
                        type="button"
                        onClick={() => onOpenDetail({ kind: "request", id: request.id })}
                      >
                        {request.subject}
                      </button>
                    </h3>
                    <p className="brew-email__body">{request.summary}</p>
                    <p className="brew-email__from">
                      {request.fromName} <span>· {request.fromRole}</span>
                    </p>
                    {/* "With Context" is where a row starts saying what it is
                        waiting on, which is the cue the setup card promises. */}
                    {emailLevel !== "glance" ? (
                      <p className="brew-row__cue">
                        {request.waitingLabel}
                        {request.assigneeName ? ` · with ${request.assigneeName}` : " · unassigned"}
                        {emailLevel === "deep" && request.important ? " · flagged important" : ""}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`brew-chip brew-chip--${
                      request.priority === "urgent" ? "high" : request.priority
                    }`}
                  >
                    {LEVEL_LABEL[request.priority]}
                  </span>
                </li>
              )}
            />
          ) : null}

          {showPriorities ? (
            <DayPanel
              id="priorities"
              title="Action Center"
              glyph="actions"
              tone="blue"
              action={
                <EdwardChip
                  label="Summarize"
                  onClick={() => onAskEdward({ mode: "summarize", context: "today's queues" })}
                />
              }
              items={briefing.priorities}
              views={PRIORITY_VIEWS}
              view={priorityView}
              onView={setPriorityView}
              emptyMessage="No queue needs a decision from you this morning."
              render={(priority) => (
                <li key={priority.id}>
                  <span
                    className={`brew-priority-flag brew-priority-flag--${priority.level.toLowerCase()}`}
                    aria-hidden="true"
                  >
                    <Glyph name="flag" size={16} />
                  </span>
                  <div>
                    <span className="brew-row__top">
                      <h3>
                        <button
                          className="brew-stretch"
                          type="button"
                          onClick={() => onOpenDetail({ kind: "priority", id: priority.id })}
                        >
                          {priority.title}
                        </button>
                      </h3>
                      <i className={`brew-chip brew-chip--${priority.level.toLowerCase()}`}>
                        {priority.level}
                      </i>
                    </span>
                    <p>{priority.detail}</p>
                    {/* "With Context" adds the next step and who owns it, which
                        is the difference between a queue and a decision. */}
                    {actionLevel !== "glance" ? (
                      <p className="brew-prep-line">
                        <span aria-hidden="true">→</span> {priority.steps[0]}
                      </p>
                    ) : null}
                    {actionLevel !== "glance" ? (
                      <p className="brew-row__cue">
                        {priority.window}
                        {priority.ownedByReader ? " · yours to move" : " · someone else's to report"}
                      </p>
                    ) : null}
                    {actionLevel === "deep" ? (
                      <p className="brew-row__facts">
                        {priority.breakdown
                          .map((row) => `${row.label}: ${row.value}`)
                          .join("  ·  ")}
                      </p>
                    ) : null}
                  </div>
                </li>
              )}
            />
          ) : null}

          {!showMeetings || !showRequests ? (
            <section className="brew-connect-card">
              <span aria-hidden="true">
                <Glyph name="arrow" size={18} />
              </span>
              <div>
                <strong>Want more of your morning in here?</strong>
                <p>
                  {!showMeetings && !showRequests
                    ? "Switch on Calendar and Email and we'll add today's meetings and the messages waiting on a reply."
                    : !showMeetings
                      ? "Switch on Calendar and we'll add today's meetings, who is in them, and which ones carry a decision."
                      : "Switch on Email and we'll pull out the messages waiting on your reply this morning."}
                </p>
                <small>
                  {includedCount} of {BREW_SOURCES.length} sources switched on
                </small>
              </div>
              <button className="button button--primary" type="button" onClick={onManageConnections}>
                Change what&rsquo;s in it
              </button>
            </section>
          ) : null}
        </div>
      ) : null}

      {briefing.news.length ? (
        <NewsSection
          news={briefing.news}
          level={newsLevel}
          onViewAll={() => navigate("knowledge")}
        />
      ) : null}

      <footer className="brew-colophon">
        <p>
          All times in Eastern Time (ET) &nbsp;·&nbsp; Data as of {fullDate} {updatedClock}
        </p>
        <div>
          <button type="button" onClick={onCustomize}>
            Customize brief
          </button>
          <button type="button" onClick={onManageConnections}>
            Change what&rsquo;s in it
          </button>
          <button
            className="brew-feedback"
            type="button"
            onClick={() => onAskEdward({ mode: "ask", context: "this briefing", question: "" })}
          >
            Have feedback? <Glyph name="actions" size={14} />
          </button>
        </div>
      </footer>

      <p className="brew-disclaimer">
        <b>Demo data.</b> Every figure above is illustrative and no student record was read to
        produce it. Nothing on this page is modelled, projected, or generated by a language model,
        except the dotted forecast line, which is the current pace continued and is drawn as a
        different kind of line for that reason. {tenantRuntime.tenant.shortName} daily edition.
      </p>
    </div>
  );
}
