"use client";

import { useMemo, useState } from "react";
import { useTenant } from "../../components/tenant-provider";
import { BREW_SOURCES } from "./catalog";
import { edwardKpiGreeting, levelOf } from "./data";
import { Glyph, OutlookMark } from "./glyphs";
import { CalendarRow, EdwardButton, EmailRow, IntelligenceCard, NewsCard, PriorityRow } from "./cards";
import { emailPresentation, initialsOf } from "./presentation";
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
}: {
  news: BrewNewsItem[];
  /** At "With Context" each story says what it lands on here. */
  level: BrewDetailLevelId;
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

      </header>

      <ol className="brew-news__rail">
        {news.map((item) => (
          <NewsCard key={item.id} item={item} level={level} />
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
    <EdwardButton label={`Ask Edward · ${label}`} onClick={onClick} />
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
    label: "Important",
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
    label: "Hosted",
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
    id: "pending",
    label: "Pending response",
    empty: "No email is waiting for your response.",
    filter: (request) => emailPresentation(request).pendingResponse,
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
    label: "Important",
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
  onOpenDetail,
  onAskEdward,
  onCustomize,
  onManageConnections,
  replies = {},
}: {
  briefing: BrewBriefing;
  replies?: Record<string, string>;
  preferences: BrewPreferences;
  onOpenDetail: (ref: BrewDetailRef) => void;
  onAskEdward: (request: EdwardRequest) => void;
  onCustomize: () => void;
  onManageConnections: () => void;
}) {
  const tenantRuntime = useTenant();
  const generatedAt = new Date(briefing.updatedAt);
  const updatedClock = clockFormatter.format(generatedAt);
  const fullDate = dateFormatter.format(generatedAt);
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
  const showActions = preferences.sources.actions.enabled;
  const actionLevel = levelOf(preferences, "actions");
  const newsLevel = levelOf(preferences, "news");
  const pulseLevel = levelOf(preferences, "pulse");
  // How much of a finding is printed is the reader's own answer for
  // Institutional Intelligence, not a separate setting they had to find.
  const intelligenceLevel = levelOf(preferences, "intelligence");
  const showPriorities = briefing.priorities.length > 0;
  const showDayGrid = showMeetings || showRequests || showPriorities;
  const emptyBriefing =
    !briefing.insights.length && !briefing.kpis.length && !briefing.news.length && !showDayGrid;

  return (
    <div className="brew">
      <header className="brew-masthead">
        <div className="brew-masthead__title">
          <span className="brew-cup" aria-hidden="true" />
          <div>
            <strong>Morning Brew</strong>
            <small>Your daily enrollment briefing</small>
          </div>
        </div>
        <div className="brew-masthead__meta">
          <span className="brew-masthead__updated">
            <Glyph name="clock" size={12} /> Updated {updatedClock}
          </span>
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
            <Glyph name="clock" size={14} /> Estimated read time · {briefing.readTimeMinutes} min
          </p>
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
            <strong>{showRequests ? countFormatter.format(briefing.requests.length) : "—"}</strong>
            <small>{showRequests ? "Emails in your brief" : "Turned off"}</small>
            <em>
              {showRequests
                ? `${briefing.requests.filter(request => emailPresentation(request).pendingResponse && !replies[request.id]).length} pending response`
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
                ? `${briefing.glance.meetingsHighPriority} important meetings`
                : "Switch it on to see the day"}
            </em>
            <span className="brew-glance__link">
              {showMeetings ? "View agenda" : "Turn it on"} <Glyph name="arrow" size={13} />
            </span>
          </button>

          {/* The third card is a count like the two beside it, not a menu: the
              queues waiting on a decision this morning, read from the same
              list the Action Center panel prints further down. */}
          <button
            className="brew-glance"
            type="button"
            onClick={() =>
              showActions
                ? onOpenDetail({ kind: "priority", id: briefing.priorities[0]?.id ?? "" })
                : onManageConnections()
            }
          >
            <span className="brew-glance__head">
              <i className="brew-glance__icon brew-glance__icon--action" aria-hidden="true">
                <Glyph name="actions" size={15} />
              </i>
              Action center
            </span>
            <strong>{showActions ? countFormatter.format(briefing.glance.priorities) : "—"}</strong>
            <small>{showActions ? "Queues waiting on you" : "Turned off"}</small>
            <em>
              {showActions
                ? `${briefing.glance.prioritiesHighPriority} High priority`
                : "Switch it on to see the queues"}
            </em>
            <span className="brew-glance__link">
              {showActions ? "View queues" : "Turn it on"} <Glyph name="arrow" size={13} />
            </span>
          </button>
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

          </header>

          <div className="brew-insight-grid">
            {briefing.insights.map((insight) => (
              <IntelligenceCard key={insight.id} insight={insight} level={intelligenceLevel}
                onOpen={() => onOpenDetail({ kind: "insight", id: insight.id })}
                onAskEdward={() => onAskEdward({ mode: "cohort", context: insight.cohort.question })} />
            ))}
          </div>
        </section>
      ) : null}

      <InstitutionalPulse
        kpis={briefing.kpis}
        level={pulseLevel}
        readerFirstName={briefing.reader.firstName}
        refreshedAt={`${updatedClock} ET`}
        onOpenKpi={(id: string) => onOpenDetail({ kind: "kpi", id })}
        onAskEdwardFor={(kpi) =>
          onAskEdward({
            mode: "cohort",
            context: kpi.label,
            greeting: edwardKpiGreeting(briefing.reader.firstName, kpi.label),
          })
        }
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
              render={(meeting) => <CalendarRow key={meeting.id} meeting={meeting} level={calendarLevel} onOpen={() => onOpenDetail({ kind: "meeting", id: meeting.id })} />}
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
              views={REQUEST_VIEWS.map(view => ({ ...view, filter: (request: BrewRequest) => (view.id === "pending" || view.id === "unread") && replies[request.id] ? false : view.filter(request) }))}
              view={requestView}
              onView={setRequestView}
              emptyMessage="Nothing is waiting on a reply from you this morning."
              render={(request) => <EmailRow key={request.id} request={request} level={emailLevel} referenceDate={briefing.updatedAt} replied={Boolean(replies[request.id])} onOpen={() => onOpenDetail({ kind: "request", id: request.id })} />}
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
              render={(priority) => <PriorityRow key={priority.id} priority={priority} level={actionLevel} onOpen={() => onOpenDetail({ kind: "priority", id: priority.id })} />}
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
