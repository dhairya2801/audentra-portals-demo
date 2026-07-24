"use client";

import type { FinancialAward } from "@vv/contracts";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import { ErrorState, LoadingState, StatusPill } from "../components/portal-ui";
import { useActivityTracking } from "../hooks/use-activity-tracking";
import { useApiResource } from "../hooks/use-api-resource";
import {
  getStudentFinancials,
  selectFinancialPaymentPlan,
} from "../lib/api-client";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
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
                {financials.data.awards.map((award) => (
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
                    </div>
                    <div>
                      <strong>{money(award.offeredAmountCents)}</strong>
                      <StatusPill value={award.status} />
                    </div>
                  </li>
                ))}
              </ul>
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
                    <Link href={document.href}>
                      {document.status === "verified" ? "View" : "Complete"} →
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

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
