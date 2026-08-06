"use client";

import type { StudentFinancials } from "@vv/contracts";
import { TenantLink as Link } from "./tenant-link";
import styles from "./dashboard-widgets.module.css";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const segmentColors = {
  aid: "#27765a",
  payments: "#3979ad",
  balance: "#d5a229",
} as const;

export function DashboardFinancialSnapshot({
  financials,
}: {
  financials: StudentFinancials;
}) {
  const segments = [
    {
      key: "aid",
      label: "Accepted aid",
      cents: Math.max(0, financials.acceptedAidCents),
      color: segmentColors.aid,
    },
    {
      key: "payments",
      label: "Payments",
      cents: Math.max(0, financials.paymentsCents),
      color: segmentColors.payments,
    },
    {
      key: "balance",
      label: "Remaining",
      cents: Math.max(0, financials.remainingBalanceCents),
      color: segmentColors.balance,
    },
  ];
  const representedTotal = Math.max(
    1,
    segments.reduce((total, segment) => total + segment.cents, 0),
  );
  const actionDocuments = financials.requiredDocuments.filter(
    (document) => document.status === "action_required",
  ).length;
  const enrolledPlan = financials.paymentPlans.find(
    (plan) => plan.status === "enrolled",
  );
  let offset = 0;

  return (
    <Link
      className={`aster-domain-card aster-domain-card--financial ${styles.financialCard}`}
      href="/financials"
      aria-labelledby="financial-snapshot-title"
    >
      <span>My Financials · {financials.academicYear}</span>
      <div className={styles.financialCardBody}>
        <div className={styles.compactDonutWrap}>
          <svg
            className={styles.donut}
            viewBox="0 0 42 42"
            role="img"
            aria-label={`${money(financials.remainingBalanceCents)} estimated remaining balance`}
          >
            <circle cx="21" cy="21" r="15.9155" pathLength="100" />
            {segments.map((segment) => {
              const percentage = (segment.cents / representedTotal) * 100;
              const dashOffset = -offset;
              offset += percentage;
              return (
                <circle
                  className={styles.donutSegment}
                  cx="21"
                  cy="21"
                  r="15.9155"
                  pathLength="100"
                  stroke={segment.color}
                  strokeDasharray={`${percentage} ${100 - percentage}`}
                  strokeDashoffset={dashOffset}
                  key={segment.key}
                />
              );
            })}
          </svg>
          <div>
            <span>Estimated balance</span>
            <strong>{money(financials.remainingBalanceCents)}</strong>
          </div>
        </div>

        <div className={styles.financialCardDetails}>
          <h2 id="financial-snapshot-title">Your financial snapshot</h2>
          <p>Accepted aid, recorded payments, and what remains at a glance.</p>
          <ul aria-label="Financial balance breakdown">
            {segments.map((segment) => (
              <li key={segment.key}>
                <i style={{ background: segment.color }} aria-hidden="true" />
                <span>{segment.label}</span>
                <strong>{money(segment.cents)}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={styles.financialCardFooter}>
        <small>
          {actionDocuments} document{actionDocuments === 1 ? "" : "s"} needing action
        </small>
        <strong>{enrolledPlan?.name ?? "Choose a payment plan"} →</strong>
      </div>
    </Link>
  );
}
