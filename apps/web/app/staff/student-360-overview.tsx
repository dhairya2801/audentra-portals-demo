"use client";

import type { StaffOperationsWorkspace, StaffStudentRecord } from "@vv/contracts";
import styles from "./student-360-overview.module.css";

type OverviewTab = "application" | "enrollment" | "financials" | "academics" | "campus-life" | "documents";

type ExecutiveOverviewPanelProps = {
  record: StaffStudentRecord;
  operation: StaffOperationsWorkspace["cohort"][number];
  onNavigate: (tab: OverviewTab) => void;
};

const riskDimensions: Array<{
  label: string;
  score: number | null;
  average: number;
  weight: number;
  explanation: string;
}> = [
  { label: "Communication engagement", score: 88, average: 46, weight: 25, explanation: "Two staff follow-ups remain unanswered." },
  { label: "Portal and web engagement", score: 82, average: 51, weight: 20, explanation: "Repeated support-page visits without completion." },
  { label: "Compliance and timeliness", score: 95, average: 39, weight: 30, explanation: "Enrollment requirements are approaching due dates." },
  { label: "Academic readiness", score: 61, average: 43, weight: 15, explanation: "Current academic evidence is sufficient but incomplete." },
  { label: "Campus engagement", score: null, average: 35, weight: 10, explanation: "Not enough comparable engagement history yet." },
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function ExecutiveOverviewPanel({ record, operation, onNavigate }: ExecutiveOverviewPanelProps) {
  const pendingDocuments = record.documents.items.filter((document) => !["accepted", "waived"].includes(document.status)).length;
  const applicationProgress = record.application?.completenessPercent ?? 0;
  const enrollmentProgress = operation.journey.totalTasks
    ? Math.round((operation.journey.completedTasks / operation.journey.totalTasks) * 100)
    : 0;
  const financialProgress = record.financials.costOfAttendanceCents
    ? Math.min(100, Math.round(((record.financials.acceptedAidCents + record.financials.paymentsCents) / record.financials.costOfAttendanceCents) * 100))
    : 0;
  const pipeline = [
    { label: "Application", value: applicationProgress, tab: "application" as const, detail: "Decision complete" },
    { label: "Enrollment", value: enrollmentProgress, tab: "enrollment" as const, detail: `${operation.journey.completedTasks}/${operation.journey.totalTasks} requirements` },
    { label: "Financials", value: financialProgress, tab: "financials" as const, detail: "Cost covered" },
    { label: "Academics", value: 35, tab: "academics" as const, detail: "42/120 credits" },
    { label: "Campus Life", value: 75, tab: "campus-life" as const, detail: "Move-in ready" },
  ];
  const overallProgress = Math.round(pipeline.reduce((total, item) => total + item.value, 0) / pipeline.length);

  return (
    <div className={styles.root}>
      <section className={styles.executiveHeader}>
        <div>
          <p>Executive overview</p>
          <h3>{operation.name}&apos;s path to enrollment</h3>
          <span>Five functional areas summarized into one actionable view.</span>
        </div>
        <div
          className={styles.overallRing}
          aria-label={`Overall progress ${overallProgress} percent`}
          style={{
            background: `radial-gradient(circle closest-side, #1b577d 71%, transparent 72% 99%), conic-gradient(#5bd0c5 0 ${overallProgress}%, rgba(255,255,255,0.17) ${overallProgress}% 100%)`,
          }}
        >
          <strong>{overallProgress}%</strong>
        </div>
      </section>

      <section className={styles.pipeline} aria-label="Student progress pipeline">
        {pipeline.map((item, index) => (
          <button key={item.label} type="button" onClick={() => onNavigate(item.tab)} aria-label={`Open ${item.label} tab`}>
            <span>{index + 1}</span>
            <div><strong>{item.label}</strong><small>{item.detail}</small></div>
            <em>{item.value}%</em>
            <i><span style={{ width: `${item.value}%` }} /></i>
          </button>
        ))}
      </section>

      <section className={styles.metricGrid}>
        <button type="button" className={styles.metricLink} onClick={() => onNavigate("application")} aria-label="Open Application tab">
          <span>Application</span><strong>{record.application ? titleCase(record.application.status) : "Not imported"}</strong><small>{applicationProgress}% complete</small>
        </button>
        <button type="button" className={styles.metricLink} onClick={() => onNavigate("enrollment")} aria-label="Open Enrollment tab">
          <span>Enrollment</span><strong>{enrollmentProgress}%</strong><small>{operation.journey.completedTasks}/{operation.journey.totalTasks} requirements complete</small>
        </button>
        <button type="button" className={styles.metricLink} onClick={() => onNavigate("documents")} aria-label="Open Documents tab">
          <span>Documents</span><strong>{pendingDocuments}</strong><small>{pendingDocuments === 1 ? "Item needs review" : "Items need review"}</small>
        </button>
        <button type="button" className={styles.metricLink} onClick={() => onNavigate("financials")} aria-label="Open Financials tab">
          <span>Outstanding balance</span><strong>{formatCurrency(record.financials.remainingBalanceCents)}</strong><small>{financialProgress}% of cost covered</small>
        </button>
      </section>

      <div className={styles.decisionGrid}>
        <section className={styles.priorityCard}>
          <div className={styles.priorityHeading}>
            <span aria-hidden="true">!</span>
            <div><p>Cross-functional signal brief</p><h3>What should happen next</h3></div>
            <em>{operation.risk.band} priority</em>
          </div>
          <small className={styles.methodNote}>Rule-based synthesis from the current enrollment, financial, document, and engagement record.</small>
          <p>{operation.risk.reason}</p>
          <div className={styles.signalChips}>
            {operation.risk.signals.length ? operation.risk.signals.map((signal) => <span key={signal}>{signal}</span>) : <span>No active risk signals</span>}
          </div>
          <div className={styles.recommendation}>
            <span>Recommended now</span><strong>{operation.recommendedAction.title}</strong><small>{operation.recommendedAction.rationale}</small>
          </div>
          <div className={styles.contextList}>
            <article><span>Enrollment</span><strong>{operation.journey.totalTasks - operation.journey.completedTasks} requirements remain</strong></article>
            <article><span>Financials</span><strong>{formatCurrency(record.financials.remainingBalanceCents)} unresolved</strong></article>
            <article><span>Documents</span><strong>{pendingDocuments} awaiting review</strong></article>
          </div>
        </section>

        <section className={styles.riskCard}>
          <div className={styles.riskHeader}>
            <div className={styles.riskScore} data-risk={operation.risk.band} aria-label={`${operation.risk.score} percent melt risk`}><strong>{operation.risk.score}%</strong></div>
            <div><p>Melt Risk anatomy</p><h3>Why this student is at risk</h3><span>Higher values indicate greater risk.</span></div>
          </div>
          <div className={styles.legend}><span>Student score</span><span>Cohort average marker</span><span>Model weight</span></div>
          <div className={styles.dimensionList}>
            {riskDimensions.map((dimension) => (
              <article key={dimension.label}>
                <div><strong>{dimension.label}</strong><span>{dimension.score === null ? "N/A" : dimension.score} &middot; {dimension.weight}% weight</span></div>
                {dimension.score === null ? (
                  <div className={styles.noData}>Insufficient data</div>
                ) : (
                  <div className={styles.scoreTrack}>
                    <span style={{ width: `${dimension.score}%` }} />
                    <i style={{ left: `${dimension.average}%` }} title={`Cohort average ${dimension.average}`} />
                  </div>
                )}
                <small>{dimension.explanation}</small>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
