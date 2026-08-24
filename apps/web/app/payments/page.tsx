"use client";

import type { StudentDashboard, StudentPaymentList } from "@vv/contracts";
import { useCallback, useRef } from "react";
import { PortalShell } from "../components/portal-shell";
import { StudentPortalIcon } from "../components/student-portal-icon";
import { TenantLink as Link } from "../components/tenant-link";
import { ActionFeedback, ErrorState, LoadingState } from "../components/portal-ui";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import { createDepositPayment, getStudentBootstrap, getStudentDashboard, getStudentPayments } from "../lib/api-client";
import { useTenant } from "../components/tenant-provider";
import { formatTenantDate, formatTenantMoney } from "../lib/tenant";

type PaymentDashboard = Omit<StudentDashboard, "offer"> & { offer?: StudentDashboard["offer"] };
type ReadyData = { restricted: false; payments: StudentPaymentList; dashboard: PaymentDashboard };
type PageData = ReadyData | { restricted: true };

function PaymentWorkspace({ data, reload }: { data: ReadyData; reload: () => void }) {
  const { tenant } = useTenant();
  const money = (value: number) => formatTenantMoney(value, tenant);
  const intent = useRef<string | null>(null);
  const pay = useApiAction(useCallback((offerId: string, key: string) => createDepositPayment({ offerId }, key), []));
  const offer = data.dashboard.offer;
  const successful = data.payments.items.find((item) => item.status === "succeeded");
  const submit = async () => {
    if (!offer) return;
    const key = intent.current ?? (intent.current = crypto.randomUUID());
    try { await pay.run(offer.id, key); intent.current = null; reload(); } catch { /* retain the intent for retry */ }
  };

  const balance = offer && !successful ? offer.depositAmountCents : 0;
  return (
    <>
      <section className="page-summary" aria-label="Your balance"><div className="summary-main"><div className="summary-figure"><div className="summary-figure-copy"><span className="panel-label">Amount due now</span><strong><span className="balance-figure">{offer ? money(balance) : "Not available"}</span></strong><p>{successful ? "Your enrollment deposit is recorded." : "The enrollment deposit is the only payment currently available in this portal."}</p></div></div><div className="advisor-bar"><img className="avatar avatar-md advisor-avatar" src="/people/tomas-okafor.webp" width="40" height="40" alt="" /><div className="advisor-bar-copy"><span className="panel-label">Your financial aid advisor</span><strong>Priya Nair <span>· Financial Aid Office</span></strong></div><div className="advisor-actions"><a className="advisor-action" href={`mailto:${tenant.contacts.financialAid?.email ?? "financialaid@aster.edu"}`} aria-label="Email Financial Aid">✉</a><Link className="advisor-action" href="/appointments" aria-label="Book Financial Aid"><StudentPortalIcon name="calendar" size={16} /></Link></div></div></div></section>
      <nav className="group-tabs" aria-label="My Financials sections"><Link href="/financials"><StudentPortalIcon name="wallet" size={16} /> Overview</Link><Link href="/financials/aid"><StudentPortalIcon name="spark" size={16} /> Financial aid</Link><Link className="active" href="/payments" aria-current="page"><StudentPortalIcon name="card" size={16} /> Payments</Link></nav>
      <div className="page-body"><div className="page-main">
        <section className="section-card"><div className="card-heading"><span className="card-icon"><StudentPortalIcon name="card" size={19} /></span><div><h2>Enrollment deposit</h2><p>{offer ? `${offer.termName} · ${offer.campusName}` : "Offer details unavailable"}</p></div></div>{offer ? <><div className="split-grid"><div className="split-cell billed"><span className="panel-label">Aster bills you directly</span><strong>{money(offer.depositAmountCents)}</strong><p>Secures your place in {offer.programName}.</p></div><div className="split-cell elsewhere"><span className="panel-label">Current standing</span><strong>{successful ? "Paid" : "Due"}</strong><p>{successful ? `Recorded ${formatTenantDate(successful.createdAt, tenant, { dateStyle: "long" })}` : "No successful deposit payment is recorded yet."}</p></div></div><ActionFeedback status={pay.status} error={pay.message} success="Your enrollment deposit was recorded." />{successful ? <p className="ledger-foot"><StudentPortalIcon name="checklist" size={15} /> Deposit received · reference {successful.processorReference}</p> : <div className="pay-cta"><div><strong>Ready to pay?</strong><span>The API’s dummy processor records this local-development payment. No card details are collected here.</span></div><button className="primary-button" type="button" disabled={pay.status === "loading"} onClick={() => void submit()}>{pay.status === "loading" ? "Processing…" : pay.status === "error" ? "Retry deposit" : `Pay ${money(offer.depositAmountCents)} deposit`} <StudentPortalIcon name="chevron" size={16} /></button></div>}</> : <p className="inline-empty">This session does not include offer details needed to submit a deposit.</p>}</section>
        <section className="section-card"><div className="status-heading"><span className="status-icon review"><StudentPortalIcon name="card" size={20} /></span><div><h2>Payment history</h2><p>Confirmed records from your student account.</p></div><span className="status-count">{data.payments.total}</span></div>{data.payments.items.length ? <div className="card-rows schedule-list">{data.payments.items.map((payment) => <article className="compact-task" key={payment.id}><div className="task-type-icon meeting"><StudentPortalIcon name="card" size={21} /></div><div className="compact-copy"><span className="compact-eyebrow">Enrollment deposit</span><h3>{money(payment.amountCents)}</h3><div className="compact-meta"><span>{formatTenantDate(payment.createdAt, tenant, { dateStyle: "long" })} · {payment.processorReference}</span></div></div><span className={`status-pill ${payment.status === "succeeded" ? "done" : "wait"}`}>{payment.status}</span></article>)}</div> : <p className="inline-empty">No payments recorded yet.</p>}</section>
      </div><aside className="page-rail"><div className="anchor-card"><span className="panel-label">Secure payment</span><strong className="anchor-figure">Student account</strong><p>The authoritative amount comes from Aster. This portal never changes it in browser state.</p><Link className="learn-link" href="/help">Payment help <StudentPortalIcon name="chevron" size={14} /></Link></div><div className="provenance-card"><span className="panel-label">Need to change a plan?</span><p>Payment plan selection remains on Overview until the platform exposes a dedicated schedule mutation.</p><Link className="text-button" href="/financials">Open Overview <StudentPortalIcon name="chevron" size={14} /></Link></div></aside></div>
    </>
  );
}

export default function PaymentsPage() {
  const data = useApiResource(useCallback(async (signal: AbortSignal): Promise<PageData> => { const bootstrap = await getStudentBootstrap(signal); if (bootstrap.actor?.type === "delegate" && !bootstrap.actor.scopes.includes("payments")) return { restricted: true }; const [payments, dashboard] = await Promise.all([getStudentPayments(signal), getStudentDashboard(signal)]); return { restricted: false, payments, dashboard: dashboard as PaymentDashboard }; }, []));
  return <PortalShell active="payments" eyebrow="My Financials · Payments" title="Payments" description="What Aster bills you, what has been recorded, and what can be paid now.">{data.status === "loading" ? <LoadingState label="Loading your payment details" /> : data.status === "error" ? <ErrorState message={data.error} onRetry={data.reload} /> : data.data.restricted ? <div aria-hidden="true" /> : <PaymentWorkspace data={data.data} reload={data.refresh} />}</PortalShell>;
}
