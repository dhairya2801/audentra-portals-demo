"use client";

import type { StudentFinancials } from "@vv/contracts";
import { useState } from "react";
import Icon from "../design-system/Icon.jsx";
import Card, { CardRows } from "../design-system/primitives/Card.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import { selectFinancialPaymentPlan } from "../lib/api-client";
import { getApiErrorMessage } from "../hooks/use-api-resource";
import { useTenant } from "./tenant-provider";
import { TermTip } from "./financials-frame";
import { moneyFor, shortDate, type Ledger } from "./financials-logic";

const MARK: Record<string, { icon: string | null; word: string }> = {
  received: { icon: "check", word: "Received" },
  due: { icon: "clock", word: "Due next" },
  scheduled: { icon: null, word: "Scheduled" },
};

type Plan = StudentFinancials["paymentPlans"][number];

/**
 * The reference names the plan and hands "Change plan" to the billing portal.
 * Production owns the plan, so the same row opens the real chooser: the plans
 * the platform offers, one of which can be selected.
 */
function PlanRow({
  plans,
  enrolled,
  onEnrolled,
}: {
  plans: Plan[];
  enrolled: Plan | null;
  onEnrolled: () => void;
}) {
  const { tenant } = useTenant();
  const money = moneyFor(tenant);
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (plan: Plan) => {
    setSelecting(plan.id);
    setError(null);
    try {
      await selectFinancialPaymentPlan(plan.id, crypto.randomUUID());
      setOpen(false);
      onEnrolled();
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setSelecting(null);
    }
  };

  const detail = (plan: Plan) =>
    `${plan.installmentCount} installments · ${money.format(plan.installmentAmountCents)} each · ${money.format(plan.enrollmentFeeCents)} enrollment fee`;

  return (
    <>
      <div className="plan-row">
        <div>
          <strong>
            {enrolled ? `You’re on the ${enrolled.name}` : "You haven’t chosen a payment plan yet"}
            <TermTip term="plan" label="payment plan" />
          </strong>
          <span>{enrolled ? detail(enrolled) : "Choose one before billing begins."}</span>
        </div>
        {plans.length > 0 && (
          <button
            className="secondary-button"
            type="button"
            aria-expanded={open}
            aria-controls="plan-chooser"
            onClick={() => setOpen((value) => !value)}
          >
            {enrolled ? "Change plan" : "Choose a plan"}
          </button>
        )}
      </div>

      {open && (
        <CardRows id="plan-chooser" className="plan-chooser">
          {plans.map((plan) => (
            <article className="compact-task" key={plan.id}>
              <div className="task-type-icon external" aria-hidden="true">
                <Icon name="card" size={21} weight="duotone" />
              </div>
              <div className="compact-copy">
                <h3>{plan.name}</h3>
                <p>{detail(plan)}</p>
              </div>
              <div className="task-action">
                {plan.status === "enrolled" ? (
                  <span className="status-pill done">Current plan</span>
                ) : (
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={selecting !== null}
                    onClick={() => void choose(plan)}
                  >
                    {selecting === plan.id ? "Selecting…" : "Select plan"}
                  </button>
                )}
              </div>
            </article>
          ))}
          {error && (
            <p className="action-feedback action-feedback--error" role="alert">
              <span aria-hidden="true">!</span>
              {error}
            </p>
          )}
        </CardRows>
      )}
    </>
  );
}

/**
 * One list with the mark carrying status. Every row is the same object the
 * ledger totals, so the schedule and the summary cannot disagree.
 */
export function ScheduleList({
  data,
  ledger,
  onPlanChanged,
}: {
  data: StudentFinancials;
  ledger: Ledger;
  onPlanChanged: () => void;
}) {
  const { tenant, copy } = useTenant();
  const money = moneyFor(tenant);

  return (
    <Card aria-labelledby="schedule-title">
      <div className="card-heading">
        <span className="card-icon">
          <Icon name="calendar" size={19} />
        </span>
        <div>
          <h2 id="schedule-title">Payment schedule</h2>
          <p>{copy("What {institution} bills you, split across the year.")}</p>
        </div>
      </div>

      <PlanRow plans={data.paymentPlans} enrolled={ledger.enrolledPlan} onEnrolled={onPlanChanged} />

      {ledger.schedule.length === 0 ? (
        <StateCard variant="empty" icon="calendar" title="No payments scheduled yet">
          {copy("{institution} builds your schedule once your charges are posted for the term.")}
        </StateCard>
      ) : (
        <>
          <ul className="installment-list">
            {ledger.schedule.map((row) => {
              const mark = MARK[row.status] ?? MARK.scheduled;
              return (
                <li className={`installment-row ${row.status}`} key={row.id}>
                  <span className="installment-mark" aria-hidden="true">
                    {mark.icon && <Icon name={mark.icon} size={13} />}
                  </span>
                  <span className="installment-date">{shortDate(row.dueAt, tenant)}</span>
                  <span className="installment-label">{row.label}</span>
                  <span className="installment-status">
                    {mark.word}
                    {row.projected ? (
                      <>
                        {" · Estimate"}
                        <TermTip term="schedule" label="this installment" />
                      </>
                    ) : null}
                  </span>
                  <span className="installment-amount">{money.format(row.amountCents)}</span>
                </li>
              );
            })}
          </ul>

          <p className="ledger-foot">
            <Icon name="info" size={15} />
            {copy(
              `${money.format(ledger.scheduleTotal)} in total: what {institution} bills you, minus the aid you have accepted. Installments are an estimate and are recalculated if your aid changes.`,
            )}
          </p>
        </>
      )}
    </Card>
  );
}

/** The band that closes the page: the one real payment this portal takes. */
export function PayCta({
  amountCents,
  status,
  error,
  onPay,
}: {
  amountCents: number;
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
  onPay: () => void;
}) {
  const { tenant, copy } = useTenant();
  const money = moneyFor(tenant);

  return (
    <div className="pay-cta">
      <div>
        <strong>Ready to pay?</strong>
        <span>
          {status === "error" && error
            ? error
            : copy("Your enrollment deposit is recorded on {institution}’s student account. No card details are collected here.")}
        </span>
      </div>
      <button className="primary-button" type="button" disabled={status === "loading"} onClick={onPay}>
        {status === "loading"
          ? "Processing…"
          : status === "error"
            ? "Retry deposit"
            : `Pay ${money.format(amountCents)} deposit`}{" "}
        <Icon name="arrow" size={16} />
      </button>
    </div>
  );
}
