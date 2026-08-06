"use client";

import type { FinancialAward, StudentFinancials } from "@vv/contracts";
import { TenantLink as Link } from "../components/tenant-link";
import { useCallback, useEffect, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import { ErrorState, LoadingState, StatusPill } from "../components/portal-ui";
import { useActivityTracking } from "../hooks/use-activity-tracking";
import { useApiResource } from "../hooks/use-api-resource";
import {
  getStudentFinancials,
  selectFinancialPaymentPlan,
} from "../lib/api-client";
import { safePortalDestination } from "../lib/safe-destination";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function awardLabel(award: FinancialAward) {
  return {
    grant: "Grant",
    scholarship: "Scholarship",
    loan: "Loan",
    work_study: "Work-study",
  }[award.type];
}

function awardExplanation(award: FinancialAward) {
  const typeExplanation = {
    grant: "Grants generally do not need to be repaid when eligibility requirements remain satisfied.",
    scholarship: "Scholarships are gift aid and may carry enrollment, academic, or donor conditions.",
    loan: "Loans must be repaid. Review the lender, interest, fees, and disbursement terms before accepting.",
    work_study: "Work-study is earned as wages through eligible employment; it is not an upfront credit on your bill.",
  }[award.type];
  const statusExplanation = award.requiresAction
    ? "Your aid file currently needs a decision or follow-up before this award is final."
    : award.status === "accepted"
      ? "This award is included in the accepted-aid total shown above."
      : award.status === "pending"
        ? "This award is still being reviewed and is not yet counted as accepted aid."
        : award.status === "declined"
          ? "This award is not included in your accepted aid."
          : "This award is available for your review.";
  return `${typeExplanation} ${statusExplanation}`;
}

function financialDocumentHref(document: StudentFinancials["requiredDocuments"][number]) {
  const documentId = document.documentId;
  const fallback = documentId
    ? `/documents?document=${encodeURIComponent(documentId)}`
    : "/documents";
  const destination = safePortalDestination(document.href, fallback);
  if (!destination.external && destination.href === "/documents" && documentId) {
    return `${destination.href}?document=${encodeURIComponent(documentId)}`;
  }
  return destination.href;
}

function FinancialDocumentAction({
  document,
}: {
  document: StudentFinancials["requiredDocuments"][number];
}) {
  const href = financialDocumentHref(document);
  const label =
    document.status === "verified"
      ? "View record"
      : ["submitted", "under_review"].includes(document.status)
        ? "View submission status"
        : document.status === "action_required"
          ? "Resolve requirement"
          : "Complete requirement";
  return /^https:\/\//i.test(href) ? (
    <a href={href} target="_blank" rel="noreferrer">
      {label} <span aria-hidden="true">↗</span>
    </a>
  ) : (
    <Link href={href}>
      {label} <span aria-hidden="true">→</span>
    </Link>
  );
}

const fundingColors = {
  grant: "#2f7d5b",
  scholarship: "#f2b824",
  loan: "#5f68c5",
  payments: "#44a6a8",
  balance: "#d9dee6",
} as const;

type FinancialPaymentScheduleItem = {
  id: string;
  kind: "deposit" | "installment";
  label: string;
  amountCents: number;
  enrollmentFeeCents: number;
  dueAt: string;
  status: "paid" | "due" | "projected";
  projected: boolean;
};

function FinancialPaymentSchedule({
  items,
}: {
  items: readonly FinancialPaymentScheduleItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="aster-section financial-payment-schedule">
      <div className="aster-section__heading">
        <div>
          <p className="eyebrow">Dates and amounts</p>
          <h2>Payment schedule</h2>
        </div>
        <Link href="/payments">Open payment history →</Link>
      </div>
      <ol>
        {items.map((item) => (
          <li className={`financial-payment-schedule__item is-${item.status}`} key={item.id}>
            <time dateTime={item.dueAt}>
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(item.dueAt))}
            </time>
            <div>
              <span>{item.kind === "deposit" ? "Enrollment deposit" : "Plan installment"}</span>
              <h3>{item.label}</h3>
              <p>
                {item.status === "paid"
                  ? "Payment recorded."
                  : item.projected
                    ? "Projected from your enrolled plan; billing dates can change before statements are issued."
                    : "Current amount due on the university record."}
              </p>
            </div>
            <div>
              <strong>{money(item.amountCents)}</strong>
              {item.enrollmentFeeCents > 0 ? (
                <small>+ {money(item.enrollmentFeeCents)} enrollment fee</small>
              ) : null}
              <StatusPill value={item.status} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FinancialAidDonut({
  financials,
}: {
  financials: StudentFinancials;
}) {
  const acceptedByType = financials.awards.reduce(
    (totals, award) => {
      if (award.type !== "work_study") {
        totals[award.type] += award.acceptedAmountCents;
      }
      return totals;
    },
    { grant: 0, scholarship: 0, loan: 0 },
  );
  const slices = [
    {
      key: "grant",
      label: "Accepted grants",
      cents: acceptedByType.grant,
      color: fundingColors.grant,
    },
    {
      key: "scholarship",
      label: "Accepted scholarships",
      cents: acceptedByType.scholarship,
      color: fundingColors.scholarship,
    },
    {
      key: "loan",
      label: "Accepted loans",
      cents: acceptedByType.loan,
      color: fundingColors.loan,
    },
    {
      key: "payments",
      label: "Payments and deposits",
      cents: financials.paymentsCents,
      color: fundingColors.payments,
    },
    {
      key: "balance",
      label: "Remaining balance",
      cents: financials.remainingBalanceCents,
      color: fundingColors.balance,
    },
  ].filter((slice) => slice.cents > 0);
  const total = Math.max(
    1,
    slices.reduce((sum, slice) => sum + slice.cents, 0),
  );
  let offset = 0;

  return (
    <section className="financial-donut-card" aria-labelledby="financial-donut-title">
      <div>
        <p className="eyebrow">{financials.academicYear}</p>
        <h2 id="financial-donut-title">How your college cost is covered</h2>
        <p>
          Accepted funding and recorded payments are shown against your current
          estimated balance.
        </p>
      </div>
      <div className="financial-donut">
        <div className="financial-donut__chart">
          <svg viewBox="0 0 42 42" role="img" aria-label="Financial aid breakdown">
            <circle
              className="financial-donut__track"
              cx="21"
              cy="21"
              r="15.9155"
              pathLength="100"
            />
            {slices.map((slice) => {
              const percent = (slice.cents / total) * 100;
              const dashOffset = -offset;
              offset += percent;
              return (
                <circle
                  className="financial-donut__segment"
                  cx="21"
                  cy="21"
                  r="15.9155"
                  pathLength="100"
                  stroke={slice.color}
                  strokeDasharray={`${percent} ${100 - percent}`}
                  strokeDashoffset={dashOffset}
                  key={slice.key}
                />
              );
            })}
          </svg>
          <div>
            <span>Remaining</span>
            <strong>{money(financials.remainingBalanceCents)}</strong>
          </div>
        </div>
        <ul className="financial-donut__legend">
          {slices.map((slice) => (
            <li key={slice.key}>
              <span style={{ backgroundColor: slice.color }} />
              <div>
                <small>{slice.label}</small>
                <strong>{money(slice.cents)}</strong>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function FinancialsPage() {
  const load = useCallback(
    (signal: AbortSignal) => getStudentFinancials(signal),
    [],
  );
  const financials = useApiResource(load);
  const { track } = useActivityTracking();
  const [selecting, setSelecting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!financials.data) return;
    track("ui.financial_aid_viewed.v1", {
      surface: "financials_home",
      aid_status: financials.data.requiredDocuments.some(
        (document) => document.status === "action_required",
      )
        ? "action_required"
        : "current",
    });
  }, [financials.data, track]);

  const selectPlan = async (planId: string) => {
    setSelecting(planId);
    setFeedback(null);
    try {
      await selectFinancialPaymentPlan(planId, crypto.randomUUID());
      setFeedback("Payment plan enrolled. Your student account projection is updated.");
      financials.reload();
    } catch (caught) {
      setFeedback(
        caught instanceof Error ? caught.message : "The plan could not be selected.",
      );
    } finally {
      setSelecting(null);
    }
  };

  return (
    <PortalShell
      active="financials"
      eyebrow="My financials"
      title="A clear view of college costs"
      description="Aid, required documents, your estimated balance, payment options, and academic eligibility—together."
      actions={
        <Link className="button button--accent" href="/appointments">
          Talk with Financial Aid
        </Link>
      }
    >
      {financials.status === "loading" ? (
        <LoadingState label="Loading your financial picture" />
      ) : financials.status === "error" ? (
        <ErrorState message={financials.error} onRetry={financials.reload} />
      ) : (
        <>
          <div className="financial-overview">
            <FinancialAidDonut financials={financials.data} />
            <section className="financial-summary" aria-label="Financial summary">
            <div className="financial-summary__balance">
              <p className="eyebrow">{financials.data.academicYear}</p>
              <span>Estimated remaining balance</span>
              <strong>{money(financials.data.remainingBalanceCents)}</strong>
              <small>
                After accepted aid and recorded payments. Estimates may change
                after verification or enrollment updates.
              </small>
            </div>
            <div>
              <span>Cost of attendance</span>
              <strong>{money(financials.data.costOfAttendanceCents)}</strong>
            </div>
            <div>
              <span>Accepted aid</span>
              <strong className="positive">− {money(financials.data.acceptedAidCents)}</strong>
            </div>
            <div>
              <span>Payments & deposits</span>
              <strong className="positive">− {money(financials.data.paymentsCents)}</strong>
            </div>
            <div>
              <span>Possible additional aid</span>
              <strong>{money(financials.data.pendingAidCents)}</strong>
            </div>
            </section>
          </div>

          <div className="financial-columns">
            <section className="aster-card">
              <div className="aster-section__heading">
                <div>
                  <p className="eyebrow">Your aid package</p>
                  <h2>Funding sources</h2>
                </div>
                <Link href="/edward">Ask Edward to explain →</Link>
              </div>
              <ul className="financial-awards">
                {financials.data.awards
                  .filter((award) => award.type !== "work_study")
                  .map((award) => (
                  <li key={award.id}>
                    <span aria-hidden="true">
                      {award.type === "grant"
                        ? "G"
                        : award.type === "scholarship"
                          ? "S"
                          : award.type === "loan"
                            ? "L"
                            : "W"}
                    </span>
                    <div>
                      <small>{awardLabel(award)} · {award.source}</small>
                      <h3>{award.name}</h3>
                      {award.requiresAction ? <em>Decision required</em> : null}
                      <details className="financial-award-details">
                        <summary>How this award works</summary>
                        <p>{awardExplanation(award)}</p>
                        <dl>
                          <div>
                            <dt>Offered</dt>
                            <dd>{money(award.offeredAmountCents)}</dd>
                          </div>
                          <div>
                            <dt>Accepted</dt>
                            <dd>{money(award.acceptedAmountCents)}</dd>
                          </div>
                        </dl>
                        {award.requiresAction ? (
                          <Link href="/appointments">Ask Financial Aid about this award →</Link>
                        ) : null}
                      </details>
                    </div>
                    <div>
                      <strong>{money(award.offeredAmountCents)}</strong>
                      <StatusPill value={award.status} />
                    </div>
                  </li>
                  ))}
              </ul>
              {financials.data.awards.some(
                (award) => award.type === "work_study",
              ) ? (
                <div className="work-study-callout">
                  <span aria-hidden="true">W</span>
                  <div>
                    <p className="eyebrow">Earned through employment</p>
                    <h3>Federal Work-Study</h3>
                    <p>
                      Up to{" "}
                      {money(
                        financials.data.awards
                          .filter((award) => award.type === "work_study")
                          .reduce(
                            (total, award) =>
                              total + award.offeredAmountCents,
                            0,
                          ),
                      )}{" "}
                      may be earned through an eligible campus job. These are
                      wages paid as you work, so they are not counted as
                      accepted aid or subtracted from your remaining balance.
                    </p>
                  </div>
                  <Link href="/appointments">Ask about campus jobs</Link>
                </div>
              ) : null}
            </section>

            <section className="aster-card financial-documents">
              <div className="aster-section__heading">
                <div>
                  <p className="eyebrow">Financial aid checklist</p>
                  <h2>Required documents</h2>
                </div>
              </div>
              <ul>
                {financials.data.requiredDocuments.map((document) => (
                  <li key={document.id}>
                    <span
                      className={`financial-doc-state financial-doc-state--${document.status}`}
                      aria-hidden="true"
                    >
                      {document.status === "verified" ? "✓" : "!"}
                    </span>
                    <div>
                      <h3>{document.title}</h3>
                      <p>{document.description}</p>
                      {document.dueAt ? (
                        <small>
                          Due{" "}
                          {new Intl.DateTimeFormat("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            timeZone: "UTC",
                          }).format(new Date(document.dueAt))}
                        </small>
                      ) : null}
                    </div>
                    <div className="financial-document-actions">
                      <FinancialDocumentAction document={document} />
                      <details>
                        <summary>Status details</summary>
                        <p>
                          {document.status === "verified"
                            ? "Financial Aid has verified this record. Keep it available for reference."
                            : document.status === "under_review"
                              ? "Your submission is with Financial Aid. No new upload is needed unless the office contacts you."
                              : document.status === "submitted"
                                ? "Your document was received and is waiting to enter review."
                                : document.status === "action_required"
                                  ? "Open this requirement to see what needs correction or additional evidence."
                                  : "This document is still needed before your aid file can be finalized."}
                        </p>
                      </details>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <FinancialPaymentSchedule
            items={
              (financials.data as StudentFinancials & {
                paymentSchedule?: FinancialPaymentScheduleItem[];
              }).paymentSchedule ?? []
            }
          />

          <section className="aster-section">
            <div className="aster-section__heading">
              <div>
                <p className="eyebrow">Ways to pay</p>
                <h2>Payment plans</h2>
              </div>
              <p>Choose one plan; you can change it before billing begins.</p>
            </div>
            {feedback ? (
              <p className="action-feedback" role="status">{feedback}</p>
            ) : null}
            <div className="payment-plan-grid">
              {financials.data.paymentPlans.map((plan) => (
                <article
                  className={plan.status === "enrolled" ? "is-selected" : undefined}
                  key={plan.id}
                >
                  <span>{plan.status === "enrolled" ? "Current plan" : "Available"}</span>
                  <h3>{plan.name}</h3>
                  <strong>{money(plan.installmentAmountCents)} <small>/ installment</small></strong>
                  <p>
                    {plan.installmentCount} installments · {money(plan.enrollmentFeeCents)} enrollment fee
                  </p>
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={selecting === plan.id || plan.status === "enrolled"}
                    onClick={() => void selectPlan(plan.id)}
                  >
                    {selecting === plan.id
                      ? "Selecting…"
                      : plan.status === "enrolled"
                        ? "✓ Enrolled"
                        : "Select plan"}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="sap-card">
            <div>
              <p className="eyebrow">Satisfactory academic progress</p>
              <h2>You are meeting SAP requirements</h2>
              <p>
                SAP can affect federal grants, loans, work-study, and some
                institutional scholarships. This preview combines the
                qualitative, pace, and maximum-timeframe checks.
              </p>
            </div>
            <div className="sap-metrics">
              <div>
                <span>Cumulative GPA</span>
                <strong>{financials.data.sap.cumulativeGpa.toFixed(2)}</strong>
                <small>Minimum {financials.data.sap.minimumGpa.toFixed(2)}</small>
              </div>
              <div>
                <span>Completion pace</span>
                <strong>{financials.data.sap.completionRatePercent}%</strong>
                <small>Minimum {financials.data.sap.minimumCompletionRatePercent}%</small>
              </div>
              <div>
                <span>Attempted credits</span>
                <strong>{financials.data.sap.attemptedCredits}</strong>
                <small>Maximum {financials.data.sap.maximumAttemptedCredits}</small>
              </div>
            </div>
          </section>
        </>
      )}
    </PortalShell>
  );
}
