"use client";

import type { StaffActionCenterQuery } from "@vv/contracts";
import { DetailShell } from "./detail-shell";
import { DayDetail } from "./day-detail";
import { KpiGoal, TrendChart, TrendKey } from "./pulse";
import { movementLabel, movementTone } from "./presentation";
import { useState } from "react";

import { topicById } from "./catalog";
import { formatBrewNumber } from "./data";
import { Glyph } from "./glyphs";
import type {
  BrewBriefing,
  BrewDetailRef,
  BrewKpi,
  EdwardRequest,
  MorningBrewDestination,
  MorningBrewNavigate,
} from "./types";

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

/**
 * The drill-down, as a dialog over the brief rather than a page in place of it.
 *
 * A card and its detail are the same thought at two depths, so the brief stays
 * on screen behind the panel — blurred, inert, and still there when the reader
 * dismisses it. Escape closes, the backdrop closes, focus moves into the panel
 * on open and the page underneath cannot be scrolled while it is up.
 */
/**
 * Edward's column beside an item from the day.
 *
 * The left column is the record. This column is Edward: a line saying what he
 * makes of it, and then either the thing he has drafted — a reply, a prep
 * sheet — in a box the reader edits before they use it, or, where a draft would
 * be the wrong offer, the numbers behind the item. Nothing here is sent, and
 * nothing is written back to the record.
 */
function EdwardInsights({
  heading,
  read,
  draft,
  draftHint,
  facts,
  onAskEdward,
  askContext,
}: {
  heading: string;
  read: string;
  /** The editable draft. Omit it where the useful answer is the numbers. */
  draft?: string;
  draftHint?: string;
  /** Read-only figures, for a queue where there is nothing to write yet. */
  facts?: { label: string; value: string }[];
  onAskEdward: (request: EdwardRequest) => void;
  askContext: string;
}) {
  const [text, setText] = useState(draft ?? "");
  const [copied, setCopied] = useState(false);

  return (
    <aside className="brew-detail__aside" aria-label="Edward Insights">
      <header className="brew-insights-head">
        <span className="brew-insights-mark" aria-hidden="true">
          E
        </span>
        <div>
          <p className="brew-eyebrow">Edward Insights</p>
          <strong>{heading}</strong>
        </div>
      </header>

      <p className="brew-insights-read">{read}</p>

      {facts?.length ? (
        <dl className="brew-insights-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {draft !== undefined ? (
        <label className="brew-insights-draft">
          <span>{draftHint}</span>
          <textarea
            value={text}
            rows={12}
            spellCheck
            onChange={(event) => {
              setText(event.target.value);
              setCopied(false);
            }}
          />
        </label>
      ) : null}

      <div className="brew-insights-actions">
        {draft !== undefined ? (
          <>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(text).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                setText(draft);
                setCopied(false);
              }}
            >
              Reset
            </button>
          </>
        ) : null}
        <button
          className="button button--primary"
          type="button"
          onClick={() => onAskEdward({ mode: "ask", context: askContext })}
        >
          Ask Edward
        </button>
      </div>

      <p className="brew-insights-note">
        {draft !== undefined
          ? "Edward drafts; nothing here is sent, and nothing is saved to the record."
          : "Read from today’s records. Edward changes nothing."}
      </p>
    </aside>
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
        Students matching <strong>{cohort.label}</strong>, counted from the demo corpus.
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
  onOpenDetail,
  onManagePreferences,
  drafts,
  onDraftChange,
  replies,
  onDemoReply,
}: {
  detail: BrewDetailRef;
  onOpenDetail: (detail: BrewDetailRef) => void;
  onManagePreferences: () => void;
  drafts: Record<string, string>;
  onDraftChange: (id: string, text: string) => void;
  replies: Record<string, string>;
  onDemoReply: (id: string, text: string) => void;
  briefing: BrewBriefing;
  onBack: () => void;
  navigate: MorningBrewNavigate;
  onAskEdward: (request: EdwardRequest) => void;
}) {
  const openWorkspace = (
    destination?: MorningBrewDestination,
    boardQuery?: StaffActionCenterQuery | null,
  ) =>
    destination ? (
      <button
        className="button button--primary"
        type="button"
        onClick={() => navigate(destination, boardQuery)}
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
        // The topic and the insight's own label are often the same word; saying
        // it twice reads as a bug rather than a hierarchy.
        eyebrow={
          insight.label && insight.label !== topic?.title
            ? `${topic?.title ?? "Enrollment"} · ${insight.label}`
            : `${topic?.title ?? "Enrollment"} · Institutional Intelligence`
        }
        mark={<Glyph name={topic?.icon ?? "students"} size={20} />}
        className="brew-detail--intelligence"
        onAskEdward={() => onAskEdward({ mode: "cohort", context: insight.cohort.question })}
        accent="amber"
        title={insight.title}
        onBack={onBack}
        meta={
          <>
            <span>Potential impact · {insight.impactLevel}</span>
            <span>{insight.stats.deep}</span>
          </>
        }
        actions={openWorkspace(insight.destination)}
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
    const topic = topicById(kpi.topic);
    const value = kpi.display;

    return (
      <DetailShell
        eyebrow={`${topic?.title ?? "Enrollment"} · Institutional Pulse`}
        mark={<Glyph name={topic?.icon ?? "students"} size={20} />}
        accent="teal"
        title={kpi.label}
        onBack={onBack}
        className="brew-detail--metric"
        onAskEdward={() => onAskEdward({ mode: "cohort", context: kpi.cohort.question })}
        actions={openWorkspace("students")}
      >
        <p className="brew-detail__lede">{kpi.detail.definition}</p>

        <section className="brew-metric-overview" aria-label="Current value and outlook">
          <div><small>Current value</small><strong>{value}</strong><p>{kpi.window}</p><KpiGoal kpi={kpi} /></div>
          <div><TrendChart kpi={kpi} favorable={(kpi.comparisons.find(c => c.label.includes("30 days")) ?? kpi.comparisons[0])?.favorable ?? true} /><TrendKey /></div>
        </section>

        {kpi.comparisons.length ? (
          <section className="brew-detail__section">
            <h2>How it moved</h2>
            {/* The card cycles these one at a time; here they sit still, all
                at once, which is the whole reason to open the card. */}
            <ul className="brew-move-list">
              {kpi.comparisons.map((comparison) => (
                <li key={comparison.id}>
                  <span>{movementLabel(comparison.label, true)}</span>
                  <b className={movementTone(comparison)}>
                    <i aria-hidden="true">
                      {comparison.direction === "up" ? "▲" : comparison.direction === "down" ? "▼" : "■"}
                    </i>{" "}
                    {comparison.delta}
                  </b>
                  {comparison.percent ? <em>{comparison.percent}</em> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {kpi.detail.segments.length ? (
          <section className="brew-detail__section">
            <h2>Composition</h2>
            <MetricComposition kpi={kpi} />
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

  if (detail.kind === "meeting" || detail.kind === "request") {
    return <DayDetail detail={detail} briefing={briefing} onBack={onBack} onAskEdward={onAskEdward} onOpenDetail={onOpenDetail} onManagePreferences={onManagePreferences} drafts={drafts} onDraftChange={onDraftChange} replies={replies} onDemoReply={onDemoReply} />;
  }

  if (detail.kind === "priority") {
    const priority = briefing.priorities.find((item) => item.id === detail.id);
    if (!priority) return <NotFound onBack={onBack} />;
    const topic = topicById(priority.topic);

    return (
      <DetailShell
        eyebrow={`${topic?.title ?? "Enrollment"} · Action Center`}
        mark={<Glyph name={topic?.icon ?? "actions"} size={20} />}
        onAskEdward={() => onAskEdward({ mode: "ask", context: priority.title })}
        accent="blue"
        title={priority.title}
        onBack={onBack}
        meta={
          <>
            <span className={`brew-chip brew-chip--${priority.level.toLowerCase()}`}>
              Priority · {priority.level}
            </span>
            <span>{priority.window}</span>
            <b>{formatBrewNumber(priority.count)}</b>
          </>
        }
        actions={openWorkspace(priority.destination, priority.boardQuery)}
        aside={
          <EdwardInsights
            heading="What this queue is made of"
            read={`${formatBrewNumber(priority.count)} sitting here ${priority.window.toLowerCase()}. ${
              priority.ownedByReader
                ? "It is yours to move."
                : "The move belongs to another office; yours is to keep it visible."
            }`}
            facts={[
              ...priority.breakdown.map((row) => ({ label: row.label, value: row.value })),
              { label: "Priority", value: priority.level },
              {
                label: "Owner",
                value: priority.ownedByReader ? "You" : "Another office",
              },
              { label: "Steps queued", value: String(priority.steps.length) },
            ]}
            onAskEdward={onAskEdward}
            askContext={`the ${priority.title} queue`}
          />
        }
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

  return <NotFound onBack={onBack} />;
}

const COMPOSITION_COLORS = ["#6546d7", "#2488bf", "#14a58a", "#d29935", "#a470b3"];
function MetricComposition({ kpi }: { kpi: BrewKpi }) {
  const segments = kpi.detail.segments;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  // Only draw a whole when the supplied parts actually equal the count.
  const whole = total > 0 && !/[%$]/.test(kpi.display) && total === kpi.value && segments.every(segment => segment.value >= 0);
  return <div className={whole ? "brew-composition" : "brew-composition brew-composition--table"}>
    {whole ? <div className="brew-donut"><svg viewBox="0 0 120 120" role="img" aria-label={`${kpi.label}: ${kpi.display} total; breakdown in the adjacent legend`}>
      {segments.map((segment, index) => {
        const share = segment.value / total * 100;
        const offset = -segments.slice(0, index).reduce((sum, item) => sum + item.value, 0) / total * 100;
        return <circle key={segment.label} cx="60" cy="60" r="47" fill="none" stroke={COMPOSITION_COLORS[index % COMPOSITION_COLORS.length]} strokeWidth="13" pathLength="100" strokeDasharray={`${share} ${100 - share}`} strokeDashoffset={offset} transform="rotate(-90 60 60)" />;
      })}
    </svg><span><strong>{kpi.display}</strong><small>Total</small></span></div> : null}
    <table className="brew-table"><thead><tr><th scope="col">Group</th><th scope="col">Value</th><th scope="col">Share</th></tr></thead><tbody>{segments.map((segment, index) => <tr key={segment.label}><th scope="row">{whole ? <i className="brew-composition__key" style={{ background: COMPOSITION_COLORS[index % COMPOSITION_COLORS.length] }} /> : null}{segment.label}</th><td>{formatBrewNumber(segment.value)}</td><td>{segment.percent === null ? "—" : `${segment.percent}%`}</td></tr>)}</tbody></table>
  </div>;
}
