"use client";

import { useMemo, useState } from "react";
import { useTenant } from "../../components/tenant-provider";
import { BREW_SOURCES } from "./catalog";
import { edwardKpiGreeting, levelOf } from "./data";
import { Glyph, OutlookMark } from "./glyphs";
import {
  CalendarRow,
  EdwardButton,
  EmailRow,
  IntelligenceCard,
  NewsCard,
  PriorityRow,
} from "./cards";
import { briefEmailCategory, briefEmailCounts } from "./presentation";
import { LiveNews } from "./live-news";
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
          <i
            className={`brew-panel__mark brew-panel__mark--${tone}`}
            aria-hidden="true"
          >
            <Glyph name={glyph} size={17} />
          </i>
          {title}
        </h2>
        {action}
      </header>

      <div
        className="brew-panel__views"
        role="tablist"
        aria-label={`How to read ${title}`}
      >
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

      <div
        className={
          expanded ? "brew-panel__body is-scrolling" : "brew-panel__body"
        }
      >
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
          <button
            className="brew-more"
            type="button"
            onClick={() => setExpanded(true)}
          >
            View more
          </button>
        ) : expanded && filtered.length > PANEL_ROWS ? (
          <button
            className="brew-more"
            type="button"
            onClick={() => setExpanded(false)}
          >
            View less
          </button>
        ) : (
          <span className="brew-more brew-more--rest">
            All {filtered.length} shown
          </span>
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
          <i
            className="brew-section-head__mark brew-section-head__mark--navy"
            aria-hidden="true"
          >
            <Glyph name="broadcast" size={19} />
          </i>
          Higher Ed News
          <small>Demo preview</small>
        </h2>
      </header>

      <ol className="brew-news__rail">
        {news.map((item) => (
          <NewsCard key={item.id} item={item} level={level} />
        ))}
      </ol>

      <p className="brew-news__basis">
        An outside editorial feed, not your records. These are saved demo examples;
        the current publisher feed loads when you open your briefing.
      </p>
    </section>
  );
}

function EdwardChip({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return <EdwardButton label={`Ask Edward · ${label}`} onClick={onClick} />;
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
    empty: "No messages match the brief rule.",
    filter: () => true,
  },
  {
    id: "important",
    label: "Important unread",
    empty: "No important unread messages.",
    filter: (r) => briefEmailCategory(r) === "important",
  },
  {
    id: "pending",
    label: "Your response",
    empty: "No messages need your response.",
    filter: (r) => briefEmailCategory(r) === "pending",
  },
  {
    id: "waiting",
    label: "Waiting on replies",
    empty: "No replies are outstanding.",
    filter: (r) => briefEmailCategory(r) === "waiting",
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
    filter: (priority) =>
      priority.window === "Today" || priority.window === "This week",
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
  liveNews = false,
}: {
  briefing: BrewBriefing;
  replies?: Record<string, string>;
  liveNews?: boolean;
  preferences: BrewPreferences;
  onOpenDetail: (ref: BrewDetailRef) => void;
  onAskEdward: (request: EdwardRequest) => void;
  onCustomize: () => void;
  onManageConnections: () => void;
}) {
  const tenantRuntime = useTenant();
  const emailCounts = briefEmailCounts(briefing.requests, replies);
  const eligibleEmails = [
    ...new Map(briefing.requests.map((r) => [r.id, r])).values(),
  ].filter((r) => briefEmailCategory(r, !!replies[r.id]));
  const generatedAt = new Date(briefing.updatedAt);
  const updatedClock = clockFormatter.format(generatedAt);
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
    !briefing.insights.length &&
    !briefing.kpis.length &&
    !briefing.news.length &&
    !showDayGrid;

  return (
    <div className="brew">
      <section className="brew-hero">
        <div className="brew-hero__greeting">
          <span className="brew-hero__eyebrow">
            MORNING BREW · Your daily enrollment briefing
          </span>
          <h1>Good Morning {briefing.greetingName},</h1>
          <p className="brew-hero__deck">{briefing.deck}</p>
          <p className="brew-hero__meta">
            <Glyph name="clock" size={14} /> Estimated read time ·{" "}
            {briefing.readTimeMinutes} min
          </p>
        </div>

        <div className="brew-hero__coffee" aria-hidden="true" />
        <div className="brew-hero__cards">
          <button
            className="brew-glance"
            type="button"
            onClick={() =>
              showRequests
                ? onOpenDetail({
                    kind: "request",
                    id: eligibleEmails[0]?.id ?? "",
                  })
                : onManageConnections()
            }
          >
            <span className="brew-glance__head">
              <i
                className="brew-glance__icon brew-glance__icon--plain"
                aria-hidden="true"
              >
                <OutlookMark size={18} />
              </i>
              Outlook
            </span>
            <strong>
              {showRequests ? countFormatter.format(emailCounts.total) : "—"}
            </strong>
            <small>
              {showRequests ? "Emails in your brief" : "Turned off"}
            </small>
            <span
              className="brew-email-counts"
              title="Each message is counted once: waiting on reply, then important unread, then pending your response."
            >
              {showRequests ? (
                <>
                  <span>
                    <b>{emailCounts.important}</b> Important unread
                  </span>
                  <span>
                    <b>{emailCounts.pending}</b> Pending your response
                  </span>
                  <span>
                    <b>{emailCounts.waiting}</b> Waiting on replies
                  </span>
                </>
              ) : (
                "Switch it on to see who is waiting"
              )}
            </span>
            <span className="brew-glance__link">
              {showRequests ? "View highlights" : "Turn it on"}{" "}
              <Glyph name="arrow" size={13} />
            </span>
          </button>

          <button
            className="brew-glance"
            type="button"
            onClick={() =>
              showMeetings
                ? onOpenDetail({
                    kind: "meeting",
                    id: briefing.meetings[0]?.id ?? "",
                  })
                : onManageConnections()
            }
          >
            <span className="brew-glance__head">
              <i
                className="brew-glance__icon brew-glance__icon--calendar"
                aria-hidden="true"
              >
                <Glyph name="calendar" size={15} />
              </i>
              Calendar
            </span>
            <strong>
              {showMeetings
                ? countFormatter.format(briefing.glance.meetings)
                : "—"}
            </strong>
            <small>{showMeetings ? "Meetings today" : "Turned off"}</small>
            <em>
              {showMeetings
                ? `${briefing.glance.meetingsHighPriority} important meetings`
                : "Switch it on to see the day"}
            </em>
            <span className="brew-glance__link">
              {showMeetings ? "View agenda" : "Turn it on"}{" "}
              <Glyph name="arrow" size={13} />
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
                ? onOpenDetail({
                    kind: "priority",
                    id: briefing.priorities[0]?.id ?? "",
                  })
                : onManageConnections()
            }
          >
            <span className="brew-glance__head">
              <i
                className="brew-glance__icon brew-glance__icon--action"
                aria-hidden="true"
              >
                <Glyph name="actions" size={15} />
              </i>
              Action center
            </span>
            <strong>
              {showActions
                ? countFormatter.format(briefing.glance.priorities)
                : "—"}
            </strong>
            <small>
              {showActions ? "Queues waiting on you" : "Turned off"}
            </small>
            <em>
              {showActions
                ? `${briefing.glance.prioritiesHighPriority} High priority`
                : "Switch it on to see the queues"}
            </em>
            <span className="brew-glance__link">
              {showActions ? "View queues" : "Turn it on"}{" "}
              <Glyph name="arrow" size={13} />
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
              Every section you switched on came back empty against
              today&rsquo;s canonical records. That is the whole answer — there
              is no fallback content to show in its place.
            </p>
          </div>
          <button
            className="button button--primary"
            type="button"
            onClick={onCustomize}
          >
            Follow more topics
          </button>
        </section>
      ) : null}

      {briefing.insights.length ? (
        <section
          className="brew-insights"
          aria-labelledby="brew-insights-title"
        >
          <header className="brew-section-head">
            <h2 id="brew-insights-title">
              <i
                className="brew-section-head__mark brew-section-head__mark--blue"
                aria-hidden="true"
              >
                <Glyph name="sparkle" size={20} />
              </i>
              Institutional Intelligence
              <small>
                Insights that may impact enrollment and your attention today.
              </small>
            </h2>
          </header>

          <div className="brew-insight-grid">
            {briefing.insights.map((insight) => (
              <IntelligenceCard
                key={insight.id}
                insight={insight}
                level={intelligenceLevel}
                onOpen={() => onOpenDetail({ kind: "insight", id: insight.id })}
                onAskEdward={() =>
                  onAskEdward({
                    mode: "cohort",
                    sourceId: insight.id,
                    context: insight.cohort.question,
                  })
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      <InstitutionalPulse
        kpis={briefing.kpis}
        level={pulseLevel}
        readerFirstName={briefing.greetingName}
        refreshedAt={`${updatedClock} ET`}
        onOpenKpi={(id: string) => onOpenDetail({ kind: "kpi", id })}
        onAskEdwardFor={(kpi, comparison) =>
          onAskEdward({
            mode: "cohort",
            sourceId: kpi.id,
            pulseComparison: comparison,
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
              render={(meeting) => (
                <CalendarRow
                  key={meeting.id}
                  meeting={meeting}
                  level={calendarLevel}
                  onOpen={() =>
                    onOpenDetail({ kind: "meeting", id: meeting.id })
                  }
                />
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
                    onAskEdward({
                      mode: "summarize",
                      context: "this morning's inbox",
                    })
                  }
                />
              }
              items={eligibleEmails}
              views={REQUEST_VIEWS.map((view) => ({
                ...view,
                filter: (request: BrewRequest) =>
                  view.id === "all" ||
                  briefEmailCategory(request, !!replies[request.id]) ===
                    view.id,
              }))}
              view={requestView}
              onView={setRequestView}
              emptyMessage="No messages match the three categories in your brief."
              render={(request) => (
                <EmailRow
                  key={request.id}
                  request={request}
                  level={emailLevel}
                  referenceDate={briefing.updatedAt}
                  replied={Boolean(replies[request.id])}
                  onOpen={() =>
                    onOpenDetail({ kind: "request", id: request.id })
                  }
                />
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
                  onClick={() =>
                    onAskEdward({
                      mode: "summarize",
                      context: "today's queues",
                    })
                  }
                />
              }
              items={briefing.priorities}
              views={PRIORITY_VIEWS}
              view={priorityView}
              onView={setPriorityView}
              emptyMessage="No queue needs a decision from you this morning."
              render={(priority) => (
                <PriorityRow
                  key={priority.id}
                  priority={priority}
                  level={actionLevel}
                  onOpen={() =>
                    onOpenDetail({ kind: "priority", id: priority.id })
                  }
                />
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
              <button
                className="button button--primary"
                type="button"
                onClick={onManageConnections}
              >
                Change what&rsquo;s in it
              </button>
            </section>
          ) : null}
        </div>
      ) : null}

      {preferences.sources.news.enabled ? (
        liveNews ? (
          <LiveNews />
        ) : (
          <NewsSection news={briefing.news} level={newsLevel} />
        )
      ) : null}

      <footer className="brew-colophon brew-colophon--simple">
        <button type="button" onClick={onCustomize}>
          Change what&rsquo;s in it <Glyph name="next" size={14} />
        </button>
      </footer>

      <p className="brew-disclaimer">
        <b>Demo data.</b> Pulse, Intelligence, email, calendar and action
        items use the pinned demo day; their figures are illustrative. The dotted forecast line extends current demo pace. Higher Ed
        News is retrieved separately from the publisher and carries its own
        publication dates. {tenantRuntime.tenant.shortName} daily edition.
      </p>
    </div>
  );
}
