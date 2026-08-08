"use client";

import { BREW_TIMEFRAMES, teamById } from "./catalog";
import {
  BREW_CHANGES,
  BREW_EMAILS,
  BREW_INSIGHTS,
  BREW_KPIS,
  BREW_MEETINGS,
  BREW_NEWS,
  BREW_PRIORITIES,
  formatBrewNumber,
} from "./data";
import type { BrewBriefing, BrewDetailRef, EdwardRequest, MorningBrewDestination } from "./types";

const DESTINATION_LABELS: Record<MorningBrewDestination, string> = {
  overview: "Enrollment dashboard",
  outreach: "Outreach workspace",
  tasks: "Work items",
  students: "Student directory",
  messages: "Messages",
  campus_life: "Campus life",
  academics: "Academics",
  journeys: "Journeys",
  knowledge: "Knowledge base",
  edward: "Edward",
};

const WIDTH = 680;
const HEIGHT = 150;
const PAD = 10;
const SLOT = (series: { label: string }[]) => (WIDTH - PAD * 2) / series.length;
const CENTRE = (series: { label: string }[], index: number) => PAD + SLOT(series) * index + SLOT(series) / 2;

function ChartGrid() {
  return (
    <>
      {[0, 0.25, 0.5, 0.75, 1].map((step) => (
        <line className="brew-chart__grid" x1={PAD} x2={WIDTH - PAD} y1={HEIGHT * step} y2={HEIGHT * step} key={step} />
      ))}
    </>
  );
}

/**
 * A trend of one measure. Drawn as a line on a padded domain — a zero-anchored
 * bar chart flattens series like "deposit rate 44.2% → 38.2%" into a solid block.
 */
function TrendPlot({ series, unit }: { series: { label: string; value: number }[]; unit: string }) {
  const values = series.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = Math.max((high - low) * 0.22, Math.abs(high) * 0.02, Number.EPSILON);
  const min = low - pad;
  const range = high + pad - min;
  const points = series.map((point, index) => ({
    x: CENTRE(series, index),
    y: HEIGHT - ((point.value - min) / range) * HEIGHT,
  }));
  const path = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${unit} by period`}>
      <ChartGrid />
      <polygon className="brew-chart__area" points={`${points[0].x},${HEIGHT} ${path} ${points[points.length - 1].x},${HEIGHT}`} />
      <polyline className="brew-chart__line" points={path} />
      {points.map((point, index) => (
        <circle className="brew-chart__node" cx={point.x} cy={point.y} r={4} key={series[index].label} />
      ))}
    </svg>
  );
}

/** Two measures per period, zero-anchored so the bar lengths stay comparable. */
function BarPlot({ series }: { series: { label: string; value: number; benchmark?: number }[] }) {
  const values = series.flatMap((point) => [point.value, point.benchmark ?? point.value]);
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, Number.EPSILON);
  const barWidth = Math.min(26, SLOT(series) * 0.36);
  const yFor = (value: number) => HEIGHT - ((value - min) / range) * HEIGHT;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Values by period against benchmark">
      <ChartGrid />
      {series.map((point, index) => {
        const centre = CENTRE(series, index);
        return (
          <g key={point.label}>
            {point.benchmark !== undefined ? (
              <rect
                className="brew-chart__benchmark"
                x={centre + 2}
                y={yFor(point.benchmark)}
                width={barWidth}
                height={Math.max(2, HEIGHT - yFor(point.benchmark))}
                rx={3}
              />
            ) : null}
            <rect
              className="brew-chart__bar"
              x={centre - barWidth - 2}
              y={yFor(point.value)}
              width={barWidth}
              height={Math.max(2, HEIGHT - yFor(point.value))}
              rx={3}
            />
          </g>
        );
      })}
    </svg>
  );
}

function BrewChart({
  series,
  unit,
  benchmarkLabel,
}: {
  series: { label: string; value: number; benchmark?: number }[];
  unit: string;
  benchmarkLabel?: string;
}) {
  const hasBenchmark = series.some((point) => point.benchmark !== undefined);
  const first = series[0]?.value;
  const last = series[series.length - 1]?.value;

  return (
    <figure className="brew-chart">
      <figcaption>
        <span>
          {unit}
          {!hasBenchmark && series.length > 1 ? (
            <b>
              {" "}
              {first} → {last}
            </b>
          ) : null}
        </span>
        {hasBenchmark ? (
          <span className="brew-chart__legend">
            <i className="is-current" aria-hidden="true" /> This cycle
            <i className="is-benchmark" aria-hidden="true" /> {benchmarkLabel ?? "Benchmark"}
          </span>
        ) : null}
      </figcaption>
      {hasBenchmark ? <BarPlot series={series} /> : <TrendPlot series={series} unit={unit} />}
      <div className="brew-chart__axis" style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}>
        {series.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </figure>
  );
}

function DetailShell({
  eyebrow,
  title,
  meta,
  actions,
  children,
  onBack,
}: {
  eyebrow: string;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <article className="brew-detail">
      <button className="brew-detail__back" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> Back to Morning Brew
      </button>
      <header className="brew-detail__head">
        <p className="brew-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {meta ? <div className="brew-detail__meta">{meta}</div> : null}
        {actions ? <div className="brew-detail__actions">{actions}</div> : null}
      </header>
      <div className="brew-detail__body">{children}</div>
    </article>
  );
}

function NotFound({ onBack }: { onBack: () => void }) {
  return (
    <DetailShell eyebrow="Morning Brew" title="That item is no longer in today's brief" onBack={onBack}>
      <p className="brew-detail__lede">
        Your briefing was rebuilt with different preferences, so this item is not part of today&rsquo;s edition.
      </p>
    </DetailShell>
  );
}

export function MorningBrewDetail({
  detail,
  briefing,
  onBack,
  navigate,
  onAskEdward,
}: {
  detail: BrewDetailRef;
  briefing: BrewBriefing;
  onBack: () => void;
  navigate: (destination: MorningBrewDestination) => void;
  onAskEdward: (request: EdwardRequest) => void;
}) {
  const openWorkspace = (destination?: MorningBrewDestination) =>
    destination ? (
      <button className="button button--primary" type="button" onClick={() => navigate(destination)}>
        Open {DESTINATION_LABELS[destination]} <span aria-hidden="true">→</span>
      </button>
    ) : null;

  if (detail.kind === "insight") {
    const insight = BREW_INSIGHTS.find((item) => item.id === detail.id);
    if (!insight) return <NotFound onBack={onBack} />;
    const team = teamById(insight.team);
    return (
      <DetailShell
        eyebrow={`${insight.label} · ${team?.title ?? "Institution"}`}
        title={insight.title}
        onBack={onBack}
        meta={
          <>
            <span className={`brew-chip brew-chip--${insight.severity}`}>
              {insight.severity === "positive" ? "Positive" : insight.severity === "high" ? "High" : "Medium"}
            </span>
            <span>
              Impact <b>{insight.impactLevel}</b>
            </span>
            <span>
              Confidence <b>{insight.confidence}%</b>
            </span>
            <span className={`brew-source brew-source--${insight.source}`}>
              {insight.source === "workspace" ? "Live workspace" : "Modeled"}
            </span>
          </>
        }
        actions={
          <>
            {openWorkspace(insight.destination)}
            <button
              className="button button--secondary"
              type="button"
              onClick={() => onAskEdward({ mode: "insights", context: insight.title })}
            >
              Ask Edward about this
            </button>
          </>
        }
      >
        <p className="brew-detail__lede">{insight.projection}</p>

        <div className="brew-detail__impact">
          {insight.impact.map((chip) => (
            <span className={`brew-impact brew-impact--${chip.tone}`} key={chip.label}>
              {chip.label}
            </span>
          ))}
        </div>

        {insight.detail.narrative.map((paragraph) => (
          <p key={paragraph.slice(0, 40)}>{paragraph}</p>
        ))}

        <section className="brew-detail__section">
          <h2>What is driving it</h2>
          <div className="brew-stat-grid">
            {insight.detail.drivers.map((driver) => (
              <div className="brew-stat" key={driver.label}>
                <small>{driver.label}</small>
                <strong>{driver.value}</strong>
                <p>{driver.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="brew-detail__section">
          <h2>Trend</h2>
          <BrewChart series={insight.detail.trend} unit={insight.detail.trendUnit} />
        </section>

        <section className="brew-detail__section">
          <h2>Recommended actions</h2>
          <ol className="brew-action-list">
            {insight.detail.actions.map((action) => (
              <li key={action.title}>
                <div>
                  <strong>{action.title}</strong>
                  <p>{action.detail}</p>
                </div>
                <span>
                  <b>{action.owner}</b>
                  <small>{action.due}</small>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {insight.detail.students.length ? (
          <section className="brew-detail__section">
            <h2>Students behind this signal</h2>
            <ul className="brew-student-list">
              {insight.detail.students.map((student) => (
                <li key={student.name}>
                  <span className={`brew-risk brew-risk--${student.risk}`}>{student.risk}</span>
                  <div>
                    <strong>{student.name}</strong>
                    <small>{student.program}</small>
                  </div>
                  <p>{student.note}</p>
                </li>
              ))}
            </ul>
            <button className="brew-link" type="button" onClick={() => navigate("students")}>
              Open the full student list <span aria-hidden="true">→</span>
            </button>
          </section>
        ) : null}

        <section className="brew-detail__section brew-detail__section--quiet">
          <h2>How this was produced</h2>
          <ul className="brew-note-list">
            {insight.detail.evidence.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      </DetailShell>
    );
  }

  if (detail.kind === "kpi") {
    const kpi = BREW_KPIS.find((item) => item.id === detail.id);
    if (!kpi) return <NotFound onBack={onBack} />;
    const frame = kpi.frames[detail.timeframe];
    const team = teamById(kpi.team);
    return (
      <DetailShell
        eyebrow={`Enrollment pulse · ${team?.title ?? "Institution"}`}
        title={kpi.label}
        onBack={onBack}
        meta={
          <>
            <span>
              <b>{formatBrewNumber(frame.numeric, kpi.format)}</b> {frame.window.toLowerCase()}
            </span>
            <span className={frame.favorable ? "brew-delta" : "brew-delta brew-delta--watch"}>
              {frame.direction === "up" ? "▲" : frame.direction === "down" ? "▼" : "■"} {frame.delta}{" "}
              {frame.comparison}
            </span>
            <span>Updated {kpi.detail.updated}</span>
          </>
        }
        actions={
          <>
            {openWorkspace("overview")}
            <button
              className="button button--secondary"
              type="button"
              onClick={() => onAskEdward({ mode: "insights", context: kpi.label })}
            >
              Ask Edward about this
            </button>
          </>
        }
      >
        <p className="brew-detail__lede">{kpi.detail.definition}</p>
        <p className="brew-detail__owner">Owned by {kpi.detail.owner}</p>

        <section className="brew-detail__section">
          <h2>Every comparison period</h2>
          <div className="brew-frame-grid">
            {BREW_TIMEFRAMES.map((entry) => {
              const value = kpi.frames[entry.id];
              return (
                <div
                  className={entry.id === detail.timeframe ? "brew-frame is-active" : "brew-frame"}
                  key={entry.id}
                >
                  <small>{entry.label}</small>
                  <strong>{formatBrewNumber(value.numeric, kpi.format)}</strong>
                  <span className={value.favorable ? "brew-delta" : "brew-delta brew-delta--watch"}>
                    {value.direction === "up" ? "▲" : value.direction === "down" ? "▼" : "■"} {value.delta}
                  </span>
                  <p>{value.note}</p>
                  <i>
                    {value.target} · {value.targetProgress}%
                  </i>
                </div>
              );
            })}
          </div>
        </section>

        <section className="brew-detail__section">
          <h2>History</h2>
          <BrewChart
            series={kpi.detail.history.map((point) => ({
              label: point.label,
              value: point.value,
              benchmark: point.benchmark,
            }))}
            unit={kpi.detail.historyUnit}
            benchmarkLabel="Last cycle / plan"
          />
        </section>

        <section className="brew-detail__section">
          <h2>By segment</h2>
          <table className="brew-table">
            <thead>
              <tr>
                <th scope="col">Segment</th>
                <th scope="col">Value</th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              {kpi.detail.segments.map((segment) => (
                <tr key={segment.label}>
                  <th scope="row">{segment.label}</th>
                  <td>{segment.value}</td>
                  <td className={segment.favorable ? "brew-delta" : "brew-delta brew-delta--watch"}>
                    {segment.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="brew-detail__section brew-detail__section--quiet">
          <h2>What to keep in mind</h2>
          <ul className="brew-note-list">
            {kpi.detail.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      </DetailShell>
    );
  }

  if (detail.kind === "meeting") {
    const meeting = BREW_MEETINGS.find((item) => item.id === detail.id);
    if (!meeting) return <NotFound onBack={onBack} />;
    return (
      <DetailShell
        eyebrow="Today's calendar"
        title={meeting.title}
        onBack={onBack}
        meta={
          <>
            <span>
              <b>{meeting.time}</b> · {meeting.duration}
            </span>
            <span>{meeting.location}</span>
            <span className={`brew-chip brew-chip--${meeting.priority}`}>
              {meeting.priority === "high" ? "High priority" : meeting.priority === "medium" ? "Medium" : "Low"}
            </span>
          </>
        }
        actions={
          <>
            {openWorkspace(meeting.destination)}
            <button
              className="button button--secondary"
              type="button"
              onClick={() => onAskEdward({ mode: "prep", context: meeting.title })}
            >
              Prepare me with Edward
            </button>
          </>
        }
      >
        <p className="brew-detail__lede">{meeting.detail}</p>
        <p className="brew-detail__owner">Organized by {meeting.organizer}</p>

        <section className="brew-detail__section">
          <h2>Agenda</h2>
          <ol className="brew-ordered">
            {meeting.agenda.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        <section className="brew-detail__section">
          <h2>What you should walk in knowing</h2>
          <ul className="brew-note-list brew-note-list--accent">
            {meeting.prep.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="brew-detail__section">
          <h2>Attendees</h2>
          <span className="brew-avatars brew-avatars--large">
            {meeting.attendees.map((attendee) => (
              <i key={attendee}>{attendee}</i>
            ))}
            {meeting.extraAttendees ? <b>{meeting.extraAttendees}</b> : null}
          </span>
        </section>
      </DetailShell>
    );
  }

  if (detail.kind === "email") {
    const email = BREW_EMAILS.find((item) => item.id === detail.id);
    if (!email) return <NotFound onBack={onBack} />;
    return (
      <DetailShell
        eyebrow="Email highlights"
        title={email.subject}
        onBack={onBack}
        meta={
          <>
            <span>
              <b>{email.sender}</b> · {email.senderRole}
            </span>
            <span>{email.time}</span>
            <span className={`brew-chip brew-chip--${email.priority}`}>
              {email.priority === "high" ? "High" : email.priority === "medium" ? "Medium" : "Low"}
            </span>
          </>
        }
        actions={
          <>
            <button
              className="button button--primary"
              type="button"
              onClick={() => onAskEdward({ mode: "draft_reply", context: email.subject, emailId: email.id })}
            >
              Draft a response with Edward
            </button>
            {openWorkspace(email.destination)}
          </>
        }
      >
        <section className="brew-detail__section">
          <h2>What they are asking</h2>
          <ul className="brew-note-list brew-note-list--accent">
            {email.asks.map((ask) => (
              <li key={ask}>{ask}</li>
            ))}
          </ul>
        </section>

        <section className="brew-detail__section">
          <h2>Message</h2>
          <div className="brew-message">
            {email.body.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>
        </section>

        {email.thread.length ? (
          <section className="brew-detail__section">
            <h2>Earlier in this thread</h2>
            <ul className="brew-thread">
              {email.thread.map((entry) => (
                <li key={`${entry.sender}-${entry.time}`}>
                  <span>
                    <strong>{entry.sender}</strong>
                    <time>{entry.time}</time>
                  </span>
                  <p>{entry.excerpt}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </DetailShell>
    );
  }

  if (detail.kind === "priority") {
    const priority = briefing.priorities.find((item) => item.id === detail.id)
      ?? BREW_PRIORITIES.find((item) => item.id === detail.id);
    if (!priority) return <NotFound onBack={onBack} />;
    const team = teamById(priority.team);
    return (
      <DetailShell
        eyebrow={`Today's priorities · ${team?.title ?? "Institution"}`}
        title={priority.title}
        onBack={onBack}
        meta={
          <>
            <span className={`brew-chip brew-chip--${priority.level.toLowerCase()}`}>{priority.level}</span>
            <span>{priority.window}</span>
            <span className={`brew-source brew-source--${priority.source}`}>
              {priority.source === "workspace" ? "Live workspace" : "Modeled"}
            </span>
          </>
        }
        actions={
          <>
            {openWorkspace(priority.destination)}
            <button
              className="button button--secondary"
              type="button"
              onClick={() => onAskEdward({ mode: "summarize", context: priority.title })}
            >
              Ask Edward to summarize
            </button>
          </>
        }
      >
        <p className="brew-detail__lede">{priority.detail}</p>

        <section className="brew-detail__section">
          <h2>The numbers</h2>
          <div className="brew-stat-grid">
            {priority.breakdown.map((entry) => (
              <div className="brew-stat" key={entry.label}>
                <small>{entry.label}</small>
                <strong>{entry.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="brew-detail__section">
          <h2>How to clear it</h2>
          <ol className="brew-ordered">
            {priority.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      </DetailShell>
    );
  }

  if (detail.kind === "change") {
    const change = briefing.changes.find((item) => item.id === detail.id)
      ?? BREW_CHANGES.find((item) => item.id === detail.id);
    if (!change) return <NotFound onBack={onBack} />;
    const team = teamById(change.team);
    return (
      <DetailShell
        eyebrow={`Since yesterday · ${team?.title ?? "Institution"}`}
        title={change.title}
        onBack={onBack}
        meta={
          <>
            <span>{change.time}</span>
            {change.metric ? (
              <span className={change.tone === "positive" ? "brew-delta" : "brew-delta brew-delta--watch"}>
                {change.metric}
              </span>
            ) : null}
            <span className={`brew-source brew-source--${change.source}`}>
              {change.source === "workspace" ? "Live workspace" : "Modeled"}
            </span>
          </>
        }
        actions={
          <>
            {openWorkspace(change.destination)}
            <button
              className="button button--secondary"
              type="button"
              onClick={() => onAskEdward({ mode: "summarize", context: change.title })}
            >
              Ask Edward to summarize
            </button>
          </>
        }
      >
        <p className="brew-detail__lede">{change.detail}</p>
        <section className="brew-detail__section">
          <h2>Everything else that moved</h2>
          <ul className="brew-note-list">
            {briefing.changes
              .filter((item) => item.id !== change.id)
              .map((item) => (
                <li key={item.id}>
                  <b>{item.time}</b> — {item.title}
                </li>
              ))}
          </ul>
        </section>
      </DetailShell>
    );
  }

  const article = BREW_NEWS.find((item) => item.id === detail.id);
  if (!article) return <NotFound onBack={onBack} />;
  return (
    <DetailShell
      eyebrow={`Higher ed news · ${article.category}`}
      title={article.headline}
      onBack={onBack}
      meta={
        <>
          <span>
            <b>{article.sourceName}</b>
          </span>
          <span>{article.published}</span>
          <span>{article.readTime}</span>
        </>
      }
      actions={
        <button
          className="button button--secondary"
          type="button"
          onClick={() => onAskEdward({ mode: "insights", context: article.headline })}
        >
          Ask Edward what it means for us
        </button>
      }
    >
      <img className="brew-detail__art" src={article.image} alt={article.imageAlt} />
      <p className="brew-detail__lede">{article.summary}</p>

      <section className="brew-detail__section">
        <h2>Key points</h2>
        <ul className="brew-note-list">
          {article.keyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      <section className="brew-detail__section brew-detail__section--accent">
        <h2>Why it matters here</h2>
        <p>{article.relevance}</p>
      </section>

      <p className="brew-detail__owner">
        Synthetic demonstration article. No external publication was contacted or reproduced.
      </p>
    </DetailShell>
  );
}
