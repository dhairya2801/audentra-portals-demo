"use client";

import { useCallback } from "react";
import { PortalShell } from "../../components/portal-shell";
import { StudentPortalIcon } from "../../components/student-portal-icon";
import { TenantLink as Link } from "../../components/tenant-link";
import { ErrorState, LoadingState } from "../../components/portal-ui";
import { useApiResource } from "../../hooks/use-api-resource";
import { getStudentFinancials } from "../../lib/api-client";
import { useTenant } from "../../components/tenant-provider";
import { formatTenantMoney } from "../../lib/tenant";

export default function FinancialAidPage() {
  const aid = useApiResource(useCallback((signal: AbortSignal) => getStudentFinancials(signal), []));
  const { tenant } = useTenant();
  const money = (value: number) => formatTenantMoney(value, tenant);

  return (
    <PortalShell active="financial_aid" eyebrow="My Financials · Financial aid" title="Financial aid" description="Every source paying toward your year, what is accepted, and what could still be added.">
      {aid.status === "loading" ? <LoadingState label="Loading your aid package" /> : aid.status === "error" ? <ErrorState message={aid.error} onRetry={aid.reload} /> : (
        <>
          <section className="page-summary" aria-label="Your aid">
            <div className="summary-main"><div className="summary-figure"><div className="summary-figure-copy"><span className="panel-label">Accepted financial aid</span><strong><span className="balance-figure">{money(aid.data.acceptedAidCents)}</span></strong><p>{money(aid.data.pendingAidCents)} remains possible and is not included until it is awarded.</p></div></div><div className="advisor-bar"><img className="avatar avatar-md advisor-avatar" src="/people/tomas-okafor.webp" width="40" height="40" alt="" /><div className="advisor-bar-copy"><span className="panel-label">Your financial aid advisor</span><strong>Priya Nair <span>· Financial Aid Office</span></strong></div><div className="advisor-actions"><a className="advisor-action" href={`mailto:${tenant.contacts.financialAid?.email ?? "financialaid@aster.edu"}`} aria-label="Email Financial Aid">✉</a><Link className="advisor-action" href="/appointments" aria-label="Book Financial Aid"><StudentPortalIcon name="calendar" size={16} /></Link></div></div></div>
          </section>
          <nav className="group-tabs" aria-label="My Financials sections"><Link href="/financials"><StudentPortalIcon name="wallet" size={16} /> Overview</Link><Link className="active" href="/financials/aid" aria-current="page"><StudentPortalIcon name="spark" size={16} /> Financial aid</Link><Link href="/payments"><StudentPortalIcon name="card" size={16} /> Payments</Link></nav>
          <div className="page-body"><div className="page-main">
            <section className="section-card"><div className="status-heading"><span className="status-icon accent"><StudentPortalIcon name="spark" size={20} /></span><div><h2>Your funding sources</h2><p>Offered, accepted, and pending aid from your current package.</p></div><span className="status-count">{aid.data.awards.length}</span></div><div className="card-rows aid-source-list">{aid.data.awards.map((award) => <article className="compact-task" key={award.id}><div className={`task-type-icon ${award.type === "loan" ? "meeting" : "upload"}`}><StudentPortalIcon name="spark" size={21} /></div><div className="compact-copy"><span className="compact-eyebrow">{award.type.replaceAll("_", " ")} · {award.source}</span><h3>{award.name}</h3><p>{award.type === "loan" ? "A loan must be repaid. Review its terms before accepting." : award.type === "work_study" ? "Earned as wages through eligible employment; not an upfront bill credit." : "Gift aid that generally does not need to be repaid while eligibility remains satisfied."}</p><div className="compact-meta"><span>Offered {money(award.offeredAmountCents)} · accepted {money(award.acceptedAmountCents)}</span></div></div><div className="task-action"><strong>{money(award.offeredAmountCents)}</strong><span className={`status-pill ${award.status === "accepted" ? "done" : award.requiresAction ? "act" : "wait"}`}>{award.status.replaceAll("_", " ")}</span>{award.requiresAction ? <Link className="secondary-button" href="/appointments">Ask Financial Aid</Link> : null}</div></article>)}</div></section>
            <section className="section-card doc-section"><div className="status-heading"><span className="status-icon docs"><StudentPortalIcon name="file" size={18} /></span><div><h2>Aid documents</h2><p>The same canonical requirements shown on My Enrollment and My Documents.</p></div><span className="status-count">{aid.data.requiredDocuments.length}</span></div>{aid.data.requiredDocuments.length ? <div className="card-rows doc-list">{aid.data.requiredDocuments.map((document) => <article className="compact-task doc-task" key={document.id}><div className="task-type-icon upload"><StudentPortalIcon name="file" size={21} /></div><div className="compact-copy"><h3>{document.title}</h3><p>{document.description}</p></div><div className="task-action"><span className={`status-pill ${document.status === "verified" ? "done" : document.status === "under_review" ? "wait" : "act"}`}>{document.status.replaceAll("_", " ")}</span><Link className="secondary-button" href={document.documentId ? `/documents?document=${encodeURIComponent(document.documentId)}` : "/documents"}>Open</Link></div></article>)}</div> : <p className="inline-empty">Financial Aid has everything it needs for now.</p>}</section>
          </div><aside className="page-rail"><div className="anchor-card"><span className="panel-label">Possible additional aid</span><strong className="anchor-figure">{money(aid.data.pendingAidCents)}</strong><p>Not counted in your balance until a source is awarded and accepted.</p><Link className="primary-button full" href="/appointments">Talk with Financial Aid <StudentPortalIcon name="chevron" size={15} /></Link></div><div className="provenance-card"><span className="panel-label">The source of truth</span><p>Every figure here comes from your current financial package. Edward can explain it but cannot change it.</p><Link className="text-button" href="/edward">Ask Edward to explain <StudentPortalIcon name="chevron" size={14} /></Link></div></aside></div>
        </>
      )}
    </PortalShell>
  );
}
