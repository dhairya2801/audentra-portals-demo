"use client";

import { topicById } from "./catalog";
import { formatBrewNumber } from "./data";
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
const CENTRE = (series: { label: string }[], index: number) =>
  PAD + SLOT(series) * index + SLOT(series) / 2;

function ChartGrid() {
  return (
    <>
      {[0, 0.25, 0.5, 0.75, 1].map((step) => (
        <line
          className="brew-chart__grid"
          x1={PAD}
          x2={WIDTH - PAD}
          y1={HEIGHT * step}
          y2={HEIGHT * step}
          key={step}
        />
      ))}
    </>
  );
}

/**
 * Composition, zero-anchored so the bars stay comparable.
 *
 * This is the only chart Morning Brew draws, because a count of students in
 * each bucket is the only series the platform actually holds. There is no
 * history table behind these numbers, so there is no trend line to draw and no
 * benchmark to draw it against.
 */
function CompositionPlot({ series }: { series: { label: string; value: number }[] }) {
  const max = Math.max(...series.map((point) => point.value), 1);
  const barWidth = Math.min(48, SLOT(series) * 0.5);
  const yFor = (value: number) => HEIGHT - (value / max) * HEIGHT;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Students in each group">
      <ChartGrid />
      {series.map((point, index) => {
        const centre = CENTRE(series, index);
        return (
          <rect
            className="brew-chart__bar"
            x={centre - barWidth / 2}
            y={yFor(point.value)}
            width={barWidth}
            height={Math.max(2, HEIGHT - yFor(point.value))}
            rx={3}
            key={point.label}
          />
        );
      })}
    </svg>
  );
}

function BrewChart({ series, unit }: { series: { label: string; value: number }[]; unit: string }) {
  if (series.length < 2) return null;
  return (
    <figure className="brew-chart">
      <figcaption>
        <span>{unit}</span>
      </figcaption>
      <CompositionPlot series={series} />
      <div
        className="brew-chart__axis"
        style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}
      >
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
    <DetailShell
      eyebrow="Morning Brew"
      title="That item is no longer in today's brief"
      onBack={onBack}
    >
      <p className="brew-detail__lede">
        Your briefing was rebuilt with different preferences, so this item is not part of
        today&rsquo;s edition.
      </p>
    </DetailShell>
  );
}

/**
 * The cohort behind a number, stated as the filter that produced it plus the
 * question that reproduces it. This block is the point of the whole detail
 * view: a leader who does not believe a figure gets the definition and a
 * one-click way to see the students it counted.
 */
function CohortEvidence({
  cohort,
  onAskEdward,
}: {
  cohort: { label: string; clauses: string[]; question: string };
  onAskEdward: (request: EdwardRequest) => void;
}) {
  return (
    <section className="brew-detail__section brew-detail__section--evidence">
      <h2>How this was counted</h2>
      <p className="brew-detail__lede">
        Students matching <strong>{cohort.label}</strong>, counted from canonical records.
      </p>
      {cohort.clauses.length ? (
        <ul className="brew-note-list">
          {cohort.clauses.map((clause) => (
            <li key={clause}>{clause}</li>
          ))}
        </ul>
      ) : (
        <ul className="brew-note-list">
          <li>no filter — every student in this tenant</li>
        </ul>
      )}
      <button
        className="brew-edward-chip"
        type="button"
        onClick={() => onAskEdward({ mode: "cohort", context: cohort.question })}
      >
        <span aria-hidden="true">E</span> Ask Edward: “{cohort.question}”
      </button>
    </section>
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
      <button
        className="button button--primary"
        type="button"
        onClick={() => navigate(destination)}
      >
        Open {DESTINATION_LABELS[destination]} <span aria-hidden="true">→</span>
      </button>
    ) : null;

  if (detail.kind === "insight") {
    const insight = briefing.insights.find((item) => item.id === detail.id);
    if (!insight) return <NotFound onBack={onBack} />;
    const topic = topicById(insight.topic);

    return (
      <DetailShell
        eyebrow={`${topic?.title ?? "Enrollment"} · ${insight.label}`}
        title={insight.title}
        onBack={onBack}
        meta={
          <>
            <span className={`brew-chip brew-chip--${insight.severity}`}>
              {insight.severity === "positive"
                ? "Clear"
                : insight.severity === "high"
                  ? "High"
                  : "Medium"}
            </span>
            <span>Priority: {insight.impactLevel}</span>
            <span>{insight.scope}</span>
          </>
        }
        actions={
          <>
            {openWorkspace(insight.destination)}
            <button
              className="brew-edward-chip"
              type="button"
              onClick={() => onAskEdward({ mode: "cohort", context: insight.cohort.question })}
            >
              <span aria-hidden="true">E</span> Ask Edward for these students
            </button>
          </>
        }
      >
        <p className="brew-detail__lede">{insight.summary}</p>

        {insight.detail.narrative.map((paragraph) => (
          <p className="brew-detail__paragraph" key={paragraph.slice(0, 32)}>
            {paragraph}
          </p>
        ))}

        {insight.detail.drivers.length ? (
          <section className="brew-detail__section">
            <h2>Related cohorts</h2>
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
        ) : null}

        {insight.detail.breakdown.length ? (
          <section className="brew-detail__section">
            <h2>What is blocking them</h2>
            <BrewChart
              series={insight.detail.breakdown.map((row) => ({
                label: row.title,
                value: row.students,
              }))}
              unit="Students with this requirement open"
            />
            <table className="brew-table">
              <thead>
                <tr>
                  <th scope="col">Requirement</th>
                  <th scope="col">Students</th>
                  <th scope="col">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {insight.detail.breakdown.map((row) => (
                  <tr key={row.code}>
                    <th scope="row">{row.title}</th>
                    <td>{row.students}</td>
                    <td>{row.overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {insight.detail.breakdownNote ? (
              <p className="brew-detail__note">{insight.detail.breakdownNote}</p>
            ) : null}
          </section>
        ) : null}

        {insight.detail.students.length ? (
          <section className="brew-detail__section">
            <h2>Students in this cohort</h2>
            <ul className="brew-student-list">
              {insight.detail.students.map((student) => (
                <li key={student.id}>
                  <div>
                    <strong>{student.name}</strong>
                    <small>{student.program}</small>
                  </div>
                  <span>{student.note}</span>
                </li>
              ))}
            </ul>
            {insight.detail.studentsNote ? (
              <p className="brew-detail__note">{insight.detail.studentsNote}</p>
            ) : null}
          </section>
        ) : null}

        {insight.detail.actions.length ? (
          <section className="brew-detail__section">
            <h2>What to do next</h2>
            <ol className="brew-action-list">
              {insight.detail.actions.map((action) => (
                <li key={action.title}>
                  <div>
                    <strong>{action.title}</strong>
                    {action.detail ? <p>{action.detail}</p> : null}
                  </div>
                  <span>
                    {action.owner} · {action.due}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <CohortEvidence cohort={insight.cohort} onAskEdward={onAskEdward} />
      </DetailShell>
    );
  }

  if (detail.kind === "kpi") {
    const kpi = briefing.kpis.find((item) => item.id === detail.id);
    if (!kpi) return <NotFound onBack={onBack} />;
    const frame = kpi.frames[detail.timeframe] ?? kpi.frames.now;
    const timeframe = briefing.timeframes.find((entry) => entry.id === detail.timeframe);
    const topic = topicById(kpi.topic);

    return (
      <DetailShell
        eyebrow={`${topic?.title ?? "Enrollment"} · Enrollment Pulse`}
        title={kpi.label}
        onBack={onBack}
        meta={
          <>
            <b>{formatBrewNumber(frame.numeric)}</b>
            <span>{frame.window}</span>
            {timeframe ? <span>{timeframe.label}</span> : null}
          </>
        }
        actions={
          <>
            {openWorkspace("students")}
            <button
              className="brew-edward-chip"
              type="button"
              onClick={() => onAskEdward({ mode: "cohort", context: kpi.cohort.question })}
            >
              <span aria-hidden="true">E</span> Ask Edward for these students
            </button>
          </>
        }
      >
        <p className="brew-detail__lede">{kpi.detail.definition}</p>

        <section className="brew-detail__section">
          <h2>This window</h2>
          <div className="brew-stat-grid">
            <div className="brew-stat">
              <small>Value</small>
              <strong>{formatBrewNumber(frame.numeric)}</strong>
              <p>{frame.window}</p>
            </div>
            {frame.basisLabel && frame.basisPercent !== null ? (
              <div className="brew-stat">
                <small>Share</small>
                <strong>{frame.basisPercent}%</strong>
                <p>{frame.basisLabel}</p>
              </div>
            ) : null}
            <div className="brew-stat">
              <small>Change</small>
              <strong>{frame.delta ?? "Not tracked"}</strong>
              <p>{frame.comparison ?? "No timestamp proves a change for this metric"}</p>
            </div>
          </div>
          <p className="brew-detail__note">{frame.note}</p>
        </section>

        {kpi.detail.segments.length ? (
          <section className="brew-detail__section">
            <h2>Composition</h2>
            <BrewChart
              series={kpi.detail.segments.map((segment) => ({
                label: segment.label,
                value: segment.value,
              }))}
              unit="Students"
            />
            <table className="brew-table">
              <thead>
                <tr>
                  <th scope="col">Group</th>
                  <th scope="col">Students</th>
                  <th scope="col">Share of roster</th>
                </tr>
              </thead>
              <tbody>
                {kpi.detail.segments.map((segment) => (
                  <tr key={segment.label}>
                    <th scope="row">{segment.label}</th>
                    <td>{segment.value}</td>
                    <td>{segment.percent === null ? "—" : `${segment.percent}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <section className="brew-detail__section">
          <h2>Notes</h2>
          <ul className="brew-note-list">
            {kpi.detail.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>

        <CohortEvidence cohort={kpi.cohort} onAskEdward={onAskEdward} />
      </DetailShell>
    );
  }

  if (detail.kind === "deadline") {
    const deadline = briefing.deadlines.find((item) => item.id === detail.id);
    if (!deadline) return <NotFound onBack={onBack} />;
    const topic = topicById(deadline.topic);

    return (
      <DetailShell
        eyebrow={`${topic?.title ?? "Enrollment"} · Deadline`}
        title={deadline.title}
        onBack={onBack}
        meta={
          <>
            <span className={`brew-chip brew-chip--${deadline.priority}`}>
              {deadline.relativeLabel}
            </span>
            <span>{deadline.dueLabel}</span>
            <span>
              {deadline.students} {deadline.students === 1 ? "student" : "students"}
            </span>
          </>
        }
        actions={openWorkspace(deadline.destination)}
      >
        <p className="brew-detail__lede">{deadline.detail}</p>
        <section className="brew-detail__section">
          <h2>What to do next</h2>
          <p className="brew-detail__paragraph">{deadline.nextStep}</p>
        </section>
        <section className="brew-detail__section brew-detail__section--evidence">
          <h2>How this was counted</h2>
          <ul className="brew-note-list">
            <li>
              {deadline.kindLabel} due{" "}
              {deadline.bucket === "overdue" ? "before today" : "inside the next 30 days"}
            </li>
            <li>Requirements that are still incomplete on a student&rsquo;s journey</li>
            <li>Students counted once per requirement, not once per due date</li>
          </ul>
        </section>
      </DetailShell>
    );
  }

  if (detail.kind === "request") {
    const request = briefing.requests.find((item) => item.id === detail.id);
    if (!request) return <NotFound onBack={onBack} />;

    return (
      <DetailShell
        eyebrow="Student request"
        title={request.subject}
        onBack={onBack}
        meta={
          <>
            <span className={`brew-chip brew-chip--${request.status === "new" ? "high" : "medium"}`}>
              {request.status === "new" ? "No reply yet" : "Open"}
            </span>
            <span>{request.studentName}</span>
            <span>{request.programName}</span>
            <span>Last message {request.waitingLabel}</span>
          </>
        }
        actions={openWorkspace("messages")}
      >
        <p className="brew-detail__lede">{request.summary}</p>
        <section className="brew-detail__section">
          <h2>Ownership</h2>
          <p className="brew-detail__paragraph">
            {request.assigneeName
              ? `Assigned to ${request.assigneeName}.`
              : "Nobody is assigned to this conversation yet."}
          </p>
          <p className="brew-detail__note">
            The full thread lives in Messages. Morning Brew shows the opening message only, and
            never a draft reply — replies are written against the canonical conversation.
          </p>
        </section>
      </DetailShell>
    );
  }

  if (detail.kind === "priority") {
    const priority = briefing.priorities.find((item) => item.id === detail.id);
    if (!priority) return <NotFound onBack={onBack} />;
    const topic = topicById(priority.topic);

    return (
      <DetailShell
        eyebrow={`${topic?.title ?? "Enrollment"} · Queue`}
        title={priority.title}
        onBack={onBack}
        meta={
          <>
            <span className={`brew-chip brew-chip--${priority.level.toLowerCase()}`}>
              {priority.level}
            </span>
            <span>{priority.window}</span>
            <b>{formatBrewNumber(priority.count)}</b>
          </>
        }
        actions={openWorkspace(priority.destination)}
      >
        <p className="brew-detail__lede">{priority.detail}</p>

        <section className="brew-detail__section">
          <h2>Breakdown</h2>
          <div className="brew-stat-grid">
            {priority.breakdown.map((row) => (
              <div className="brew-stat" key={row.label}>
                <small>{row.label}</small>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="brew-detail__section">
          <h2>What to do next</h2>
          <ol className="brew-action-list">
            {priority.steps.map((step) => (
              <li key={step}>
                <div>
                  <strong>{step}</strong>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </DetailShell>
    );
  }

  if (detail.kind === "change") {
    const change = briefing.changes.find((item) => item.id === detail.id);
    if (!change) return <NotFound onBack={onBack} />;
    const topic = topicById(change.topic);

    return (
      <DetailShell
        eyebrow={`${topic?.title ?? "Enrollment"} · Since yesterday`}
        title={change.title}
        onBack={onBack}
        meta={
          <>
            <span className={`brew-chip brew-chip--${change.tone === "watch" ? "medium" : "low"}`}>
              {change.metric}
            </span>
            <span>{change.time}</span>
            <span>{briefing.windowLabel}</span>
          </>
        }
        actions={openWorkspace(change.destination)}
      >
        <p className="brew-detail__lede">{change.detail}</p>
        <section className="brew-detail__section brew-detail__section--evidence">
          <h2>How this was counted</h2>
          <ul className="brew-note-list">
            <li>
              Source column: <code>{change.basis}</code>
            </li>
            <li>{change.basisNote}</li>
            <li>
              {change.exact
                ? "This timestamp records the event itself."
                : "This timestamp records the last write to the record, not the transition, so treat the count as an upper bound."}
            </li>
          </ul>
        </section>
      </DetailShell>
    );
  }

  return <NotFound onBack={onBack} />;
}
