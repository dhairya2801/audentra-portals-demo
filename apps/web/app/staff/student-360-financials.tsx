"use client";

import type { StaffStudentRecord } from "@vv/contracts";
import styles from "./student-360-financials.module.css";

type FinancialAidPanelProps = { record: StaffStudentRecord };

type PackageItem = {
  id: string;
  name: string;
  type: "Grant" | "Loan" | "Federal Work-Study" | "Scholarship";
  source: string;
  amountCents: number;
  status: string;
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function FinancialAidPanel({ record }: FinancialAidPanelProps) {
  const financials = record.financials;
  const totalCost = financials.costOfAttendanceCents || 3_240_000;
  const tuition = Math.round(totalCost * 0.68);
  const housing = Math.round(totalCost * 0.22);
  const otherCosts = totalCost - tuition - housing;
  const tuitionPercent = Math.round((tuition / totalCost) * 100);
  const housingPercent = Math.round((housing / totalCost) * 100);
  const packageItems: PackageItem[] = financials.awards.length
    ? financials.awards.map((award) => ({
        id: award.id,
        name: award.name,
        type: award.type === "loan" ? "Loan" : award.type === "work_study" ? "Federal Work-Study" : award.type === "scholarship" ? "Scholarship" : "Grant",
        source: titleCase(award.source),
        amountCents: award.acceptedAmountCents,
        status: titleCase(award.status),
      }))
    : [
        { id: "demo-pell", name: "Federal Pell Grant", type: "Grant", source: "Federal", amountCents: Math.round(totalCost * 0.15), status: "Accepted" },
        { id: "demo-access", name: "Audentra Access Grant", type: "Grant", source: "Institutional", amountCents: Math.round(totalCost * 0.2), status: "Accepted" },
        { id: "demo-loan", name: "Direct Subsidized Loan", type: "Loan", source: "Federal", amountCents: Math.round(totalCost * 0.1), status: "Accepted" },
        { id: "demo-work", name: "Federal Work-Study", type: "Federal Work-Study", source: "Federal", amountCents: Math.round(totalCost * 0.08), status: "Eligible" },
      ];
  const grants = packageItems.filter((item) => item.type === "Grant" || item.type === "Scholarship").reduce((sum, item) => sum + item.amountCents, 0);
  const loans = packageItems.filter((item) => item.type === "Loan").reduce((sum, item) => sum + item.amountCents, 0);
  const workStudy = packageItems.filter((item) => item.type === "Federal Work-Study").reduce((sum, item) => sum + item.amountCents, 0);
  const aidTotal = grants + loans + workStudy;
  const payments = financials.paymentsCents;
  const covered = Math.min(totalCost, aidTotal + payments);
  const remaining = Math.max(0, totalCost - covered);
  const coveragePercent = Math.round((covered / totalCost) * 100);
  const aidBase = aidTotal || 1;
  const grantPercent = Math.round((grants / aidBase) * 100);
  const loanPercent = Math.round((loans / aidBase) * 100);
  const deposit = financials.paymentSchedule?.find((item) => item.kind === "deposit");

  return (
    <div className={styles.root}>
      <section className={styles.hero}>
        <div><p>Financial Aid Package</p><h3>{financials.academicYear}</h3><span>{financials.awards.length ? "Institution record" : "Synthetic planning package"}</span></div>
        <div className={styles.coverageMetric}>
          <div className={styles.coverageRing} aria-label={`${coveragePercent} percent of cost covered`} style={{ background: `radial-gradient(circle closest-side, #17476f 71%, transparent 72% 99%), conic-gradient(#5bd0c5 0 ${coveragePercent}%, rgba(255,255,255,0.18) ${coveragePercent}% 100%)` }}>
            <strong>{coveragePercent}%</strong>
          </div>
          <span>Cost covered</span>
        </div>
      </section>

      <section className={styles.summaryGrid} aria-label="Financial summary">
        <article><span>Total cost of attendance</span><strong>{money(totalCost)}</strong><small>Tuition, housing, and other costs</small></article>
        <article><span>Covered by aid</span><strong>{money(aidTotal)}</strong><small>Grants, loans, and work-study</small></article>
        <article><span>Paid</span><strong>{money(payments)}</strong><small>Payments received</small></article>
        <article className={styles.balance}><span>Remaining</span><strong>{money(remaining)}</strong><small>Estimated student responsibility</small></article>
      </section>

      <div className={styles.chartGrid}>
        <section className={styles.card}>
          <div className={styles.cardHeading}><div><p>Cost of attendance</p><h3>Where the cost comes from</h3></div><span>{money(totalCost)}</span></div>
          <div className={styles.chartBody}>
            <div className={styles.donutMetric}><div className={styles.costDonut} aria-label="Cost breakdown chart" style={{ background: `radial-gradient(circle closest-side, #fffefa 63%, transparent 64% 99%), conic-gradient(#1765dc 0 ${tuitionPercent}%, #2e918a ${tuitionPercent}% ${tuitionPercent + housingPercent}%, #e8a844 ${tuitionPercent + housingPercent}% 100%)` }}><strong>{money(totalCost)}</strong></div><span>Total</span></div>
            <div className={styles.legend}>
              <article><i className={styles.tuition} /><div><strong>Tuition and fees</strong><small>{tuitionPercent}%</small></div><span>{money(tuition)}</span></article>
              <article><i className={styles.housing} /><div><strong>Housing and dining</strong><small>{housingPercent}%</small></div><span>{money(housing)}</span></article>
              <article><i className={styles.other} /><div><strong>Books and other costs</strong><small>{100 - tuitionPercent - housingPercent}%</small></div><span>{money(otherCosts)}</span></article>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeading}><div><p>Aid composition</p><h3>How the package is funded</h3></div><span>{money(aidTotal)}</span></div>
          <div className={styles.chartBody}>
            <div className={styles.donutMetric}><div className={styles.aidDonut} aria-label="Aid breakdown chart" style={{ background: `radial-gradient(circle closest-side, #fffefa 63%, transparent 64% 99%), conic-gradient(#2d918a 0 ${grantPercent}%, #1765dc ${grantPercent}% ${grantPercent + loanPercent}%, #7a55cf ${grantPercent + loanPercent}% 100%)` }}><strong>{money(aidTotal)}</strong></div><span>Total aid</span></div>
            <div className={styles.legend}>
              <article><i className={styles.grants} /><div><strong>Grants and scholarships</strong><small>No repayment</small></div><span>{money(grants)}</span></article>
              <article><i className={styles.loans} /><div><strong>Borrowed through loans</strong><small>Repayment required</small></div><span>{money(loans)}</span></article>
              <article><i className={styles.workStudy} /><div><strong>Federal Work-Study</strong><small>Earned through employment</small></div><span>{money(workStudy)}</span></article>
            </div>
          </div>
        </section>
      </div>

      <section className={styles.coverageCard}>
        <div className={styles.cardHeading}><div><p>Coverage plan</p><h3>Covered, paid, borrowed, and remaining</h3></div><span>{coveragePercent}% funded</span></div>
        <div className={styles.coverageTrack} aria-label="Cost coverage progress">
          <span className={styles.aidSegment} style={{ width: `${Math.round((grants / totalCost) * 100)}%` }} />
          <span className={styles.loanSegment} style={{ width: `${Math.round((loans / totalCost) * 100)}%` }} />
          <span className={styles.paidSegment} style={{ width: `${Math.round((payments / totalCost) * 100)}%` }} />
        </div>
        <div className={styles.coverageLabels}><span>Gift aid {money(grants)}</span><span>Loans {money(loans)}</span><span>Paid {money(payments)}</span><span>Remaining {money(remaining)}</span></div>
      </section>

      <div className={styles.detailGrid}>
        <section className={styles.card}>
          <div className={styles.cardHeading}><div><p>Financial Aid Package</p><h3>Awards and eligibility</h3></div><span>{packageItems.length} items</span></div>
          <div className={styles.packageList}>
            {packageItems.map((item) => <article key={item.id}><span>{item.type.slice(0, 1)}</span><div><strong>{item.name}</strong><small>{item.source} &middot; {item.type}</small></div><div><strong>{money(item.amountCents)}</strong><em>{item.status}</em></div></article>)}
          </div>
          {!financials.awards.length ? <p className={styles.demoNotice}>Synthetic planning data for design review. No financial-aid award was issued.</p> : null}
        </section>
        <section className={styles.card}>
          <div className={styles.cardHeading}><div><p>Commitment and obligations</p><h3>Deposit, loans, and standing</h3></div></div>
          <dl className={styles.factList}>
            <div><dt>Enrollment deposit</dt><dd>{deposit ? money(deposit.amountCents) : "Not scheduled"}</dd></div>
            <div><dt>Deposit status</dt><dd>{deposit ? titleCase(deposit.status) : "Not recorded"}</dd></div>
            <div><dt>Borrowed through loans</dt><dd>{money(loans)}</dd></div>
            <div><dt>Pending aid</dt><dd>{money(financials.pendingAidCents)}</dd></div>
            <div><dt>SAP status</dt><dd>{titleCase(financials.sap.status)}</dd></div>
          </dl>
          <div className={styles.insight}><span>*</span><div><strong>{remaining ? "Funding gap needs attention" : "Cost is fully covered"}</strong><small>{remaining ? `Confirm an additional ${money(remaining)} funding plan before billing.` : "No estimated balance remains after aid and payments."}</small></div></div>
        </section>
      </div>
    </div>
  );
}
