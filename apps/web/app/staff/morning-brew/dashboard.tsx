"use client";

import { useTenant } from "../../components/tenant-provider";
import { BREW_INCLUDES } from "./catalog";
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
  const alerts =
    briefing.glance.requestsAwaitingReply +
    briefing.priorities.filter((priority) => priority.level === "High").length;
  const includedCount = BREW_INCLUDES.filter((include) => preferences.include[include.id]).length;

  const showDeadlines = preferences.include.deadlines;
  const showRequests = preferences.include.requests;
  const showImpact = preferences.insightDetail !== "headline";
  const showRecommendation = preferences.insightDetail === "full";
  const showPriorities = briefing.priorities.length > 0;
  const showDayGrid = showDeadlines || showRequests || showPriorities;
  const emptyBriefing =
    !briefing.insights.length &&
    !briefing.kpis.length &&
    !briefing.changes.length &&
    !showDayGrid;

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
            <i aria-hidden="true">↻</i> Read at {updatedClock}
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
          {briefing.bullets.length ? (
            <ul className="brew-hero__bullets">
              {briefing.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
          <p className="brew-hero__read">
            <span aria-hidden="true">◷</span> Read time: ~{briefing.readTimeMinutes} min
          </p>
          <small>
            {briefing.students} students on the roster · changes cover {briefing.windowLabel}
          </small>
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
              <i className="brew-glance__icon brew-glance__icon--mail" aria-hidden="true">
                ✉
              </i>
              Student requests
            </span>
            <strong>{showRequests ? briefing.glance.requests : "—"}</strong>
            <small>{showRequests ? "Active conversations" : "Turned off"}</small>
            <em>
              {showRequests
                ? `${briefing.glance.requestsAwaitingReply} awaiting a first reply`
                : "Switch it on to see who is waiting"}
            </em>
            <span className="brew-glance__link">
              {showRequests ? "View requests" : "Turn it on"} <i aria-hidden="true">→</i>
            </span>
          </button>

          <button
            className="brew-glance"
            type="button"
            onClick={() =>
              showDeadlines
                ? onOpenDetail({ kind: "deadline", id: briefing.deadlines[0]?.id ?? "" })
                : onManageConnections()
            }
          >
            <span className="brew-glance__head">
              <i className="brew-glance__icon brew-glance__icon--calendar" aria-hidden="true">
                ▦
              </i>
              Deadlines
            </span>
            <strong>{showDeadlines ? briefing.glance.deadlinesOverdue : "—"}</strong>
            <small>{showDeadlines ? "Students past a due date" : "Turned off"}</small>
            <em>
              {showDeadlines
                ? `${briefing.glance.deadlinesThisWeek} with a date inside the week`
                : "Switch it on to see the runway"}
            </em>
            <span className="brew-glance__link">
              {showDeadlines ? "View runway" : "Turn it on"} <i aria-hidden="true">→</i>
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
          <header className="brew-panel-head">
            <div>
              <p className="brew-eyebrow" id="brew-insights-title">
                <span aria-hidden="true">✦</span> What needs attention
              </p>
              <p>Cohorts that are stuck today, ranked by how much they hold up.</p>
            </div>
            <div className="brew-panel-head__actions">
              <EdwardChip
                label="Ask for the students"
                onClick={() => onAskEdward({ mode: "insights", context: "today's attention list" })}
              />
              <button className="brew-link" type="button" onClick={() => navigate("students")}>
                Open the roster <span aria-hidden="true">→</span>
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
                      ? "Clear"
                      : insight.severity === "high"
                        ? "High"
                        : "Medium"}
                  </span>
                </div>

                <p className="brew-insight__summary">{insight.summary}</p>
                {showImpact ? <p className="brew-insight__projection">{insight.scope}</p> : null}

                {showImpact ? (
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
                ) : null}

                {showRecommendation ? (
                  <div className="brew-insight__action">
                    <small>Recommended action · {insight.label}</small>
                    <p>{insight.recommendedAction}</p>
                  </div>
                ) : null}

                <footer className="brew-insight__foot">
                  <span>
                    Priority: <b>{insight.impactLevel}</b> &nbsp;·&nbsp; <b>Canonical records</b>
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
        timeframes={briefing.timeframes}
        refreshedAt={`${updatedClock} ET`}
        students={briefing.students}
        onOpenKpi={(id: string, timeframe: BrewTimeframeId) =>
          onOpenDetail({ kind: "kpi", id, timeframe })
        }
        onAskEdward={() => onAskEdward({ mode: "insights", context: "the enrollment funnel" })}
        onOpenDashboard={() => navigate("overview")}
      />

      {briefing.changes.length ? (
        <section className="brew-changes" aria-labelledby="brew-changes-title">
          <header className="brew-panel-head">
            <div>
              <p className="brew-eyebrow" id="brew-changes-title">
                <span aria-hidden="true">↻</span> Since yesterday
              </p>
              <p>Canonical records written in {briefing.windowLabel}.</p>
            </div>
            <div className="brew-panel-head__actions">
              <EdwardChip
                label="Summarize"
                onClick={() =>
                  onAskEdward({ mode: "summarize", context: "what changed since yesterday" })
                }
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
                  <b>{change.metric}</b>
                  <i className="brew-source brew-source--workspace">
                    {change.exact ? "Canonical" : "Last write"}
                  </i>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {showDayGrid ? (
        <div className="brew-day-grid">
          {showDeadlines ? (
            <section className="brew-panel" aria-labelledby="brew-deadlines-title">
              <header className="brew-panel__head">
                <p className="brew-eyebrow" id="brew-deadlines-title">
                  <span aria-hidden="true">▦</span> Deadlines ahead
                </p>
                <EdwardChip
                  label="Who is affected?"
                  onClick={() =>
                    onAskEdward({
                      mode: "cohort",
                      context: "Which students have a requirement due in the next 7 days?",
                    })
                  }
                />
              </header>
              {briefing.deadlines.length ? (
                <ul className="brew-list brew-list--meetings brew-list--deadlines">
                  {briefing.deadlines.map((deadline) => (
                    <li key={deadline.id}>
                      <span
                        className={`brew-dot brew-dot--${deadline.priority}`}
                        aria-hidden="true"
                      />
                      <time>
                        {deadline.dueLabel}
                        <small>{deadline.relativeLabel}</small>
                      </time>
                      <div>
                        <h3>
                          <button
                            className="brew-stretch"
                            type="button"
                            onClick={() => onOpenDetail({ kind: "deadline", id: deadline.id })}
                          >
                            {deadline.title}
                          </button>
                        </h3>
                        <p>{deadline.detail}</p>
                        {preferences.deadlineNextStep && deadline.priority === "high" ? (
                          <p className="brew-prep-line">
                            <span aria-hidden="true">✎</span> {deadline.nextStep}
                          </p>
                        ) : null}
                        <span className="brew-count-pill">
                          {deadline.students} {deadline.students === 1 ? "student" : "students"}
                        </span>
                      </div>
                      <span className={`brew-chip brew-chip--${deadline.priority}`}>
                        {deadline.bucket === "overdue"
                          ? "Overdue"
                          : deadline.bucket === "today"
                            ? "Today"
                            : deadline.bucket === "this_week"
                              ? "This week"
                              : "This month"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="brew-panel__empty">
                  No requirement due dates or offer deadlines fall inside the next 30 days for the
                  topics you follow.
                </p>
              )}
              <footer className="brew-panel__foot">
                <button className="brew-link" type="button" onClick={() => navigate("journeys")}>
                  Open enrollment journeys <span aria-hidden="true">→</span>
                </button>
              </footer>
            </section>
          ) : null}

          {showRequests ? (
            <section className="brew-panel" aria-labelledby="brew-requests-title">
              <header className="brew-panel__head">
                <p className="brew-eyebrow" id="brew-requests-title">
                  <span aria-hidden="true">✉</span> Student requests
                </p>
                <EdwardChip
                  label="Summarize"
                  onClick={() =>
                    onAskEdward({ mode: "summarize", context: "today's student requests" })
                  }
                />
              </header>
              {briefing.requests.length ? (
                <ul className="brew-list brew-list--emails">
                  {briefing.requests.map((request) => (
                    <li key={request.id}>
                      <span
                        className={`brew-dot brew-dot--${
                          request.priority === "urgent" || request.priority === "high"
                            ? "high"
                            : request.priority
                        }`}
                        aria-hidden="true"
                      />
                      <div>
                        <span className="brew-email__top">
                          <i
                            className={`brew-chip brew-chip--${
                              request.status === "new" ? "high" : "medium"
                            }`}
                          >
                            {request.status === "new"
                              ? "No reply yet"
                              : request.status === "waiting_on_student"
                                ? "With the student"
                                : "Open"}
                          </i>
                          <time>{request.waitingLabel}</time>
                        </span>
                        <h3>
                          <button
                            className="brew-stretch"
                            type="button"
                            onClick={() => onOpenDetail({ kind: "request", id: request.id })}
                          >
                            {request.subject}
                          </button>
                        </h3>
                        <p>
                          {request.studentName} · {request.summary}
                        </p>
                        <span className="brew-row-actions">
                          <button
                            type="button"
                            onClick={() => onOpenDetail({ kind: "request", id: request.id })}
                          >
                            View request
                          </button>
                          <button type="button" onClick={() => navigate("messages")}>
                            Reply in Messages
                          </button>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="brew-panel__empty">
                  No active student support conversations are waiting on your team.
                </p>
              )}
              <footer className="brew-panel__foot">
                <button className="brew-link" type="button" onClick={() => navigate("messages")}>
                  Open Messages <span aria-hidden="true">→</span>
                </button>
              </footer>
            </section>
          ) : null}

          {showPriorities ? (
            <section className="brew-panel" aria-labelledby="brew-priorities-title">
              <header className="brew-panel__head">
                <p className="brew-eyebrow" id="brew-priorities-title">
                  <span aria-hidden="true">⚑</span> Today&rsquo;s queues
                </p>
                <EdwardChip
                  label="Summarize"
                  onClick={() => onAskEdward({ mode: "summarize", context: "today's queues" })}
                />
              </header>
              <ul className="brew-list brew-list--priorities">
                {briefing.priorities.map((priority) => (
                  <li key={priority.id}>
                    <span
                      className={`brew-priority-icon brew-priority-icon--${priority.level.toLowerCase()}`}
                      aria-hidden="true"
                    >
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
                        <i className={`brew-chip brew-chip--${priority.level.toLowerCase()}`}>
                          {priority.level}
                        </i>
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

          {!showDeadlines || !showRequests ? (
            <section className="brew-connect-card">
              <span aria-hidden="true">↗</span>
              <div>
                <strong>Want more of your morning in here?</strong>
                <p>
                  {!showDeadlines && !showRequests
                    ? "Switch on deadlines and student requests and we'll add the dated obligations and the conversations waiting on a reply."
                    : !showDeadlines
                      ? "Switch on deadlines and we'll add the requirement dates and offer deadlines landing soon."
                      : "Switch on student requests and we'll pull out the support conversations waiting on your team."}
                </p>
                <small>
                  {includedCount} of {BREW_INCLUDES.length} switched on
                </small>
              </div>
              <button className="button button--primary" type="button" onClick={onManageConnections}>
                Change what&rsquo;s in it
              </button>
            </section>
          ) : null}
        </div>
      ) : null}

      <section className="brew-coverage" aria-labelledby="brew-coverage-title">
        <p className="brew-eyebrow" id="brew-coverage-title">
          <span aria-hidden="true">◎</span> What this briefing does and does not cover
        </p>
        <ul className="brew-coverage__notes">
          {briefing.coverage.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <details className="brew-coverage__details">
          <summary>Metrics this briefing will not show ({briefing.coverage.unsupported.length})</summary>
          <dl>
            {briefing.coverage.unsupported.map((item) => (
              <div key={item.metric}>
                <dt>{item.metric}</dt>
                <dd>{item.reason}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

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
            Change what&rsquo;s in it
          </button>
          <button
            className="brew-feedback"
            type="button"
            onClick={() => onAskEdward({ mode: "ask", context: "this briefing", question: "" })}
          >
            Ask Edward <span aria-hidden="true">💬</span>
          </button>
        </div>
      </footer>

      <p className="brew-disclaimer">
        Every figure above is a count of canonical records in your Audentra database, read at{" "}
        {updatedClock} ET. Nothing on this page is modelled, projected, or generated by a language
        model.
      </p>
    </div>
  );
}
