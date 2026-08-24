"use client";

import type { FinancialDocumentRequirement, StudentFinancials } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import AnchorCard from "../design-system/primitives/AnchorCard.jsx";
import Card from "../design-system/primitives/Card.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import { TenantLink as Link } from "./tenant-link";
import { useTenant } from "./tenant-provider";
import { TermTip } from "./financials-frame";
import {
  daysUntil,
  deadlineLabel,
  escalation,
  isOutstanding,
  moneyFor,
  share,
  documentHref,
  shortDate,
  type Ledger,
} from "./financials-logic";

/**
 * A stacked bar, not a ring: while an award is pending the open segment has no
 * known size, so it is hatched.
 */
export function CoverageBar({ ledger }: { ledger: Ledger }) {
  const { tenant } = useTenant();
  const money = moneyFor(tenant);
  const label = ledger.coverage.map((segment) => `${segment.label}, ${money.format(segment.amount)}`).join(". ");
  const pendingClass = (key: string) => (key === "open" && ledger.hasPending ? " pending" : "");

  return (
    <div className="coverage">
      <div className="coverage-bar" role="img" aria-label={`Of ${money.format(ledger.cost)} for the year: ${label}.`}>
        {ledger.coverage.map((segment) => (
          <span
            key={segment.key}
            className={`coverage-segment ${segment.key}${pendingClass(segment.key)}`}
            style={{ width: `${share(segment.amount, ledger.cost)}%` }}
          />
        ))}
      </div>

      <ul className="coverage-legend">
        {ledger.coverage.map((segment) => (
          <li key={segment.key}>
            <i className={`coverage-key ${segment.key}${pendingClass(segment.key)}`} aria-hidden="true" />
            <span>
              <strong>{money.format(segment.amount)}</strong>
              {segment.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * ENR-159 AC 1: cost, accepted aid, payments, possible additional aid and the
 * estimated remaining balance, together, each linking to the leaf that details
 * it. A table, so a screen reader pairs every label with its amount.
 */
export function CostCard({
  data,
  ledger,
  children,
}: {
  data: StudentFinancials;
  ledger: Ledger;
  children?: React.ReactNode;
}) {
  const { tenant, copy } = useTenant();
  const money = moneyFor(tenant);

  return (
    <Card aria-labelledby="cost-title">
      <div className="card-heading">
        <span className="card-icon">
          <Icon name="receipt" size={19} />
        </span>
        <div>
          <h2 id="cost-title">Cost and coverage</h2>
          <p>{data.academicYear} academic year</p>
        </div>
      </div>

      {children}

      <table className="ledger">
        <caption className="sr-only">
          What the {data.academicYear} academic year costs, what is covering it, and what is left
        </caption>
        <tbody>
          <tr className="ledger-group">
            <th scope="row">
              Cost of attendance
              <TermTip term="coa" label="cost of attendance" />
              <small>{copy("{institution}’s full estimate for the year, including what you spend off campus")}</small>
            </th>
            <td />
            <td className="ledger-amount">{money.format(ledger.cost)}</td>
          </tr>

          <tr className="ledger-group">
            <th scope="row">
              Accepted financial aid
              <TermTip term="aid" label="financial aid" />
            </th>
            <td>
              <Link className="ledger-link" href="/financials/aid">
                See every source <Icon name="arrow" size={13} />
              </Link>
            </td>
            <td className="ledger-amount credit">{money.credit(ledger.aidAccepted)}</td>
          </tr>
          {ledger.pending.map((award) => (
            <tr className="ledger-sub pending-row" key={award.id}>
              <th scope="row">
                {award.name}
                <small>
                  {award.status === "offered"
                    ? "Offered · not counted until you accept it"
                    : copy("Pending · waiting on {institution} to confirm the award")}
                </small>
              </th>
              <td />
              <td className="ledger-amount pending" aria-label="No amount yet">
                —
              </td>
            </tr>
          ))}

          <tr className="ledger-group">
            <th scope="row">Payments and deposits</th>
            <td>
              <Link className="ledger-link" href="/payments">
                See your schedule <Icon name="arrow" size={13} />
              </Link>
            </td>
            <td className="ledger-amount credit">
              {ledger.paid > 0 ? money.credit(ledger.paid) : "None recorded yet"}
            </td>
          </tr>

          <tr className="ledger-group soft">
            <th scope="row">
              Possible additional aid
              <small>Not counted below until it is awarded</small>
            </th>
            <td>
              <Link className="ledger-link" href="/financials/aid">
                See what could be added <Icon name="arrow" size={13} />
              </Link>
            </td>
            <td className="ledger-amount soft">up to {money.format(ledger.additionalTotal)}</td>
          </tr>

          <tr className="ledger-total">
            <th scope="row">
              Estimated remaining balance
              <TermTip term="balance" label="estimated remaining balance" />
            </th>
            <td>
              <span className="estimate-chip">Estimate</span>
            </td>
            <td className="ledger-amount">{money.format(ledger.balance)}</td>
          </tr>
        </tbody>
      </table>

      {ledger.hasPending && (
        <p className="ledger-foot">
          <Icon name="clock" size={15} />
          Aid that is still pending or offered is not subtracted from this. It is listed above without an
          amount, and has never been counted as zero.
        </p>
      )}
    </Card>
  );
}

/**
 * ENR-160. The financial paperwork still open on the record, with its office,
 * its deadline and its state. The band under the balance carries the action
 * for the nearest one; each row keeps a way to open its own.
 */
export function DocumentList({ documents }: { documents: FinancialDocumentRequirement[] }) {
  const { tenant, copy } = useTenant();
  const open = documents.filter(isOutstanding);
  const contact = tenant.contacts.financialAid?.label ?? "Financial Aid Office";

  return (
    <section className="section-card doc-section" aria-labelledby="docs-title">
      <div className="status-heading">
        <span className="status-icon docs">
          <Icon name="file" size={18} />
        </span>
        <div>
          <h2 id="docs-title">Documents that need you</h2>
          <p>{copy("Financial paperwork {institution} is still waiting on. Each one says what it holds up.")}</p>
        </div>
        <span className="status-count">{open.length}</span>
      </div>

      {open.length === 0 ? (
        <StateCard variant="empty" icon="check" title="Nothing is waiting on you">
          {copy(
            "The Financial Aid Office has everything it needs for now. If that changes, the request appears here and on your enrollment checklist at the same time.",
          )}
        </StateCard>
      ) : (
        <div className="card-rows doc-list">
          {open.map((document) => {
            const daysLeft = document.dueAt ? daysUntil(document.dueAt) : null;
            const level = escalation(daysLeft);
            return (
              <article className="compact-task doc-task" key={document.id}>
                <div className="task-type-icon upload" aria-hidden="true">
                  <Icon name="upload" size={21} weight="duotone" />
                </div>
                <div className="compact-copy">
                  <h3>{document.title}</h3>
                  <p className="doc-meta">
                    {contact}
                    {document.dueAt ? ` · due ${shortDate(document.dueAt, tenant)}` : ""}
                  </p>
                  <p className="doc-consequence">
                    <Icon name="alert" size={13} /> {document.description}
                  </p>
                </div>
                <div className="doc-action">
                  <span className={`deadline-chip${level ? ` ${level}` : ""}`}>{deadlineLabel(daysLeft)}</span>
                  <Link className="ledger-link" href={documentHref(document)}>
                    Open <Icon name="arrow" size={14} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

/**
 * The dark card at the top of the rail carrying the one hard number. Paying
 * hands off to Payments, where the deposit is actually taken.
 */
export function NextPaymentCard({ ledger }: { ledger: Ledger }) {
  const { tenant } = useTenant();
  const money = moneyFor(tenant);
  const next = ledger.nextPayment;
  if (!next) return null;

  const dueInDays = daysUntil(next.dueAt);
  const depositPaid = ledger.deposit?.status === "received";
  const deposit = ledger.deposit ? money.format(ledger.deposit.amountCents) : null;

  return (
    <AnchorCard variant="next-payment" label="Next payment" figure={money.format(next.amountCents)} figureClass="next-payment-figure">
      <p className="next-payment-meta">
        {next.label} · due {shortDate(next.dueAt, tenant)}
        {dueInDays > 0 ? ` · in ${dueInDays} days` : ""}
      </p>

      {ledger.installmentCount > 0 && (
        <>
          <ol className="payment-track" aria-label={`Installment ${ledger.nextInstallmentIndex + 1} of ${ledger.installmentCount}`}>
            {Array.from({ length: ledger.installmentCount }, (_, index) => (
              <li
                key={index}
                className={index < ledger.nextInstallmentIndex ? "done" : index === ledger.nextInstallmentIndex ? "next" : ""}
              />
            ))}
          </ol>
          <p className="payment-track-label">
            Installment {ledger.nextInstallmentIndex + 1} of {ledger.installmentCount}
            {deposit ? (depositPaid ? ` · your ${deposit} deposit is paid` : ` · your ${deposit} deposit comes first`) : ""}
          </p>
        </>
      )}

      <Link className="primary-button full" href="/payments">
        Make a payment <Icon name="arrow" size={16} />
      </Link>

      <p className="next-payment-note">
        {ledger.installmentCount > 0
          ? `${money.format(ledger.installmentTotal)} across ${ledger.installmentCount} installments this year${deposit ? `, after your ${deposit} deposit` : ""}. Each installment is an estimate and is recalculated if your aid changes.`
          : "Your installments appear here once you have chosen a payment plan. Each one is an estimate and is recalculated if your aid changes."}
        <TermTip term="schedule" label="how installments are worked out" />
      </p>
    </AnchorCard>
  );
}
