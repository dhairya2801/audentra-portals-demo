"use client";

import type { StudentFinancials } from "@vv/contracts";
import { useCallback, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import { StudentPortalIcon } from "../components/student-portal-icon";
import { TenantLink as Link } from "../components/tenant-link";
import { ErrorState, LoadingState } from "../components/portal-ui";
import { useApiResource } from "../hooks/use-api-resource";
import { getStudentFinancials, selectFinancialPaymentPlan } from "../lib/api-client";
import { useTenant } from "../components/tenant-provider";
import { formatTenantDate, formatTenantMoney } from "../lib/tenant";

const segmentClass = ["grants", "scholarships", "loans", "paid", "open"];

function FinancialSummary({ data }: { data: StudentFinancials }) {
  const { tenant } = useTenant();
  const money = (value: number) => formatTenantMoney(value, tenant);
  return (
    <section className="page-summary" aria-label="Your balance">
      <div className="summary-main">
        <div className="summary-figure"><div className="summary-figure-copy"><span className="panel-label">Estimated remaining balance</span><strong><span className="balance-figure">{money(data.remainingBalanceCents)} <span className="estimate-chip">Estimate</span></span></strong><p>This estimate is for {data.academicYear}. It changes only when your canonical student account changes.</p></div></div>
        <div className="advisor-bar"><img className="avatar avatar-md advisor-avatar" src="/people/tomas-okafor.webp" width="40" height="40" alt="" /><div className="advisor-bar-copy"><span className="panel-label">Your financial aid advisor</span><strong>Priya Nair <span>· Financial Aid Office</span></strong></div><div className="advisor-actions"><a className="advisor-action" href={`mailto:${tenant.contacts.financialAid?.email ?? "financialaid@aster.edu"}`} aria-label="Email Financial Aid">✉</a><Link className="advisor-action" href="/appointments" aria-label="Book Financial Aid"><StudentPortalIcon name="calendar" size={16} /></Link></div></div>
      </div>
      {data.requiredDocuments.some((item) => !["verified", "submitted", "under_review"].includes(item.status)) ? <div className="summary-alert"><div className="action-band"><span className="action-band-label"><StudentPortalIcon name="file" size={14} /> {data.requiredDocuments.find((item) => !["verified", "submitted", "under_review"].includes(item.status))?.title} needs you</span><Link className="notice-action" href="/financials/aid">Open it →</Link></div></div> : null}
    </section>
  );
}

function FinancialTabs() {
  return <nav className="group-tabs" aria-label="My Financials sections"><Link className="active" href="/financials" aria-current="page"><StudentPortalIcon name="wallet" size={16} /> Overview</Link><Link href="/financials/aid"><StudentPortalIcon name="spark" size={16} /> Financial aid</Link><Link href="/payments"><StudentPortalIcon name="card" size={16} /> Payments</Link></nav>;
}

function FinancialOverview({ data, reload }: { data: StudentFinancials; reload: () => void }) {
  const { tenant } = useTenant();
  const money = (value: number) => formatTenantMoney(value, tenant);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const acceptedByType = data.awards.reduce<Record<string, number>>((sum, award) => ({ ...sum, [award.type]: (sum[award.type] ?? 0) + (award.type === "work_study" ? 0 : award.acceptedAmountCents) }), {});
  const coverage = [
    { label: "Grants", value: acceptedByType.grant ?? 0 },
    { label: "Scholarships", value: acceptedByType.scholarship ?? 0 },
    { label: "Loans", value: acceptedByType.loan ?? 0 },
    { label: "Payments", value: data.paymentsCents },
    { label: "Still open", value: data.remainingBalanceCents },
  ];

  const choosePlan = async (id: string) => {
    setSelecting(id);
    setFeedback(null);
    try {
      await selectFinancialPaymentPlan(id, crypto.randomUUID());
      setFeedback("Payment plan enrolled. Your canonical student account projection is updated.");
      reload();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "The plan could not be selected.");
    } finally {
      setSelecting(null);
    }
  };

  return (
    <>
      <FinancialSummary data={data} />
      <FinancialTabs />
      <div className="page-body">
        <div className="page-main">
          <section className="section-card" aria-labelledby="cost-title">
            <div className="card-heading"><span className="card-icon"><StudentPortalIcon name="wallet" size={19} /></span><div><h2 id="cost-title">Cost and coverage</h2><p>{data.academicYear} academic year</p></div></div>
            <div className="coverage"><div className="coverage-bar" role="img" aria-label={`Cost of attendance ${money(data.costOfAttendanceCents)}, remaining ${money(data.remainingBalanceCents)}`}>{coverage.map((segment, index) => <span className={`coverage-segment ${segmentClass[index]}`} style={{ width: `${data.costOfAttendanceCents ? Math.max(0, (segment.value / data.costOfAttendanceCents) * 100) : 0}%` }} key={segment.label} />)}</div><ul className="coverage-legend">{coverage.map((segment, index) => <li key={segment.label}><i className={`coverage-key ${segmentClass[index]}`} /><span><strong>{money(segment.value)}</strong>{segment.label}</span></li>)}</ul></div>
            <table className="ledger"><caption className="sr-only">What the year costs, what covers it, and what remains</caption><tbody>
              <tr className="ledger-group"><th scope="row">Cost of attendance<small>Aster’s current estimate for the year</small></th><td /><td className="ledger-amount">{money(data.costOfAttendanceCents)}</td></tr>
              <tr className="ledger-group"><th scope="row">Accepted financial aid</th><td><Link className="ledger-link" href="/financials/aid">See every source →</Link></td><td className="ledger-amount credit">− {money(data.acceptedAidCents)}</td></tr>
              <tr className="ledger-group"><th scope="row">Payments and deposits</th><td><Link className="ledger-link" href="/payments">See your schedule →</Link></td><td className="ledger-amount credit">− {money(data.paymentsCents)}</td></tr>
              <tr className="ledger-group soft"><th scope="row">Possible additional aid<small>Not counted until awarded</small></th><td><Link className="ledger-link" href="/financials/aid">Review pending aid →</Link></td><td className="ledger-amount soft">up to {money(data.pendingAidCents)}</td></tr>
              <tr className="ledger-total"><th scope="row">Estimated remaining balance</th><td><span className="estimate-chip">Estimate</span></td><td className="ledger-amount">{money(data.remainingBalanceCents)}</td></tr>
            </tbody></table>
          </section>

          <section className="section-card doc-section">
            <div className="status-heading"><span className="status-icon docs"><StudentPortalIcon name="file" size={18} /></span><div><h2>Documents that need you</h2><p>Financial paperwork still connected to your aid file.</p></div><span className="status-count">{data.requiredDocuments.length}</span></div>
            {data.requiredDocuments.length ? <div className="card-rows doc-list">{data.requiredDocuments.map((document) => <article className="compact-task doc-task" key={document.id}><div className="task-type-icon upload"><StudentPortalIcon name="file" size={21} /></div><div className="compact-copy"><h3>{document.title}</h3><p className="doc-meta">Financial Aid Office{document.dueAt ? ` · due ${formatTenantDate(document.dueAt, tenant, { month: "short", day: "numeric" })}` : ""}</p><p>{document.description}</p></div><div className="doc-action"><span className={`status-pill ${document.status === "verified" ? "done" : document.status === "under_review" ? "wait" : "act"}`}>{document.status.replaceAll("_", " ")}</span><Link className="secondary-button" href={document.documentId ? `/documents?document=${encodeURIComponent(document.documentId)}` : "/documents"}>Open <StudentPortalIcon name="chevron" size={14} /></Link></div></article>)}</div> : <p className="inline-empty">Financial Aid has everything it needs for now.</p>}
          </section>

          <section className="section-card">
            <div className="status-heading"><span className="status-icon accent"><StudentPortalIcon name="card" size={20} /></span><div><h2>Payment plans</h2><p>Choose one before billing begins.</p></div></div>
            {feedback ? <p className="action-feedback" role="status">{feedback}</p> : null}
            <div className="payment-plan-grid">{data.paymentPlans.map((plan) => <article className={plan.status === "enrolled" ? "is-selected" : undefined} key={plan.id}><span>{plan.status === "enrolled" ? "Current plan" : "Available"}</span><h3>{plan.name}</h3><strong>{money(plan.installmentAmountCents)} <small>/ installment</small></strong><p>{plan.installmentCount} installments · {money(plan.enrollmentFeeCents)} enrollment fee</p><button className="secondary-button" type="button" disabled={selecting === plan.id || plan.status === "enrolled"} onClick={() => void choosePlan(plan.id)}>{selecting === plan.id ? "Selecting…" : plan.status === "enrolled" ? "✓ Enrolled" : "Select plan"}</button></article>)}</div>
          </section>

          <section className="section-card sap-card"><div><span className="panel-label">Satisfactory academic progress</span><h2>{data.sap.status === "meeting" ? "You are meeting SAP requirements" : "Review your SAP standing"}</h2><p>This advisory preview combines the qualitative, pace, and maximum-timeframe checks.</p></div><div className="sap-metrics"><div><span>Cumulative GPA</span><strong>{data.sap.cumulativeGpa.toFixed(2)}</strong><small>Minimum {data.sap.minimumGpa.toFixed(2)}</small></div><div><span>Completion pace</span><strong>{data.sap.completionRatePercent}%</strong><small>Minimum {data.sap.minimumCompletionRatePercent}%</small></div><div><span>Attempted credits</span><strong>{data.sap.attemptedCredits}</strong><small>Maximum {data.sap.maximumAttemptedCredits}</small></div></div></section>
        </div>
        <aside className="page-rail"><div className="anchor-card next-payment-card"><span className="panel-label">Next payment</span><strong className="next-payment-figure">{data.paymentPlans.find((plan) => plan.status === "enrolled") ? money(data.paymentPlans.find((plan) => plan.status === "enrolled")!.installmentAmountCents) : "Choose a plan"}</strong><p className="next-payment-meta">Your live payment history and deposit record are on Payments.</p><Link className="primary-button full" href="/payments">Open payments <StudentPortalIcon name="chevron" size={16} /></Link></div><div className="provenance-card"><span className="panel-label">About this estimate</span><p>Aid still pending is not subtracted. Housing, meal-plan, and enrollment changes can move this figure.</p><Link className="text-button" href="/appointments">Talk with Financial Aid <StudentPortalIcon name="chevron" size={14} /></Link></div></aside>
      </div>
    </>
  );
}

export default function FinancialsPage() {
  const financials = useApiResource(useCallback((signal: AbortSignal) => getStudentFinancials(signal), []));
  return <PortalShell active="financials" eyebrow="My Financials · Current academic year" title="Financials" description="What the year costs, what’s covering it, and what still needs you.">{financials.status === "loading" ? <LoadingState label="Loading your financial picture" /> : financials.status === "error" ? <ErrorState message={financials.error} onRetry={financials.reload} /> : <FinancialOverview data={financials.data} reload={financials.reload} />}</PortalShell>;
}
