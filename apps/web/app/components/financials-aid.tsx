"use client";

import type { FinancialAward, StudentFinancials } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import Card from "../design-system/primitives/Card.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import { useTenant } from "./tenant-provider";
import { TermTip } from "./financials-frame";
import { AWARD_KIND, AWARD_SOURCE, AWARD_STATUS, moneyFor, share, type Ledger } from "./financials-logic";

/**
 * ENR-159 AC 4: aid broken down by funding source. Each row also says whether
 * it is repaid. A pending award keeps a row of its own with no amount and the
 * reason it is held; it is never rendered as a zero.
 */
export function AidSources({ awards, ledger }: { awards: FinancialAward[]; ledger: Ledger }) {
  const { tenant, copy } = useTenant();
  const money = moneyFor(tenant);

  return (
    <Card aria-labelledby="aid-title">
      <div className="card-heading">
        <span className="card-icon">
          <Icon name="award" size={19} />
        </span>
        <div>
          <h2 id="aid-title">
            Aid by source
            <TermTip term="aid" label="financial aid" />
          </h2>
          <p>Who is paying, how much, and whether you pay it back.</p>
        </div>
      </div>

      {awards.length === 0 ? (
        <StateCard variant="empty" icon="award" title="No aid on your record yet">
          Your package appears here once the Financial Aid Office releases it.
        </StateCard>
      ) : (
        <ul className="aid-list">
          {awards.map((award) => (
            <li className={`aid-row ${award.status}`} key={award.id}>
              <div className="aid-row-main">
                <strong>{award.name}</strong>
                <span className="aid-source">{copy(AWARD_SOURCE[award.source])}</span>
                <span className="aid-kind">{copy(AWARD_KIND[award.type])}</span>
              </div>

              {award.status !== "pending" && (
                <span className={`aid-status ${award.status}`}>{AWARD_STATUS[award.status]}</span>
              )}

              {award.status === "accepted" ? (
                <span className="aid-amount accepted">{money.credit(award.acceptedAmountCents)}</span>
              ) : award.status === "offered" ? (
                <span className="aid-amount offered">{money.format(award.offeredAmountCents)}</span>
              ) : null}

              {award.status === "pending" && (
                <p className="aid-blocked">
                  <Icon name="clock" size={14} />
                  {copy("Pending · waiting on {institution} to confirm the award")}
                </p>
              )}
              {award.status === "offered" && award.requiresAction && (
                <p className="aid-blocked">
                  <Icon name="clock" size={14} />
                  Offered · not counted until you accept it with the Financial Aid Office
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="aid-total">
        <span>Accepted so far</span>
        <strong>{money.format(ledger.aidAccepted)}</strong>
      </div>
    </Card>
  );
}

/**
 * The light card under the hard number, offering something rather than asking
 * for it: the awards on the record that are not yet counted.
 */
export function AidOpportunityCard({ awards, total }: { awards: FinancialAward[]; total: number }) {
  const { tenant } = useTenant();
  const money = moneyFor(tenant);
  const open = awards.filter((award) => award.status === "offered" || award.status === "pending");
  if (open.length === 0 || total <= 0) return null;

  return (
    <div className="aid-opportunity-card">
      <div className="aid-opportunity-top">
        <span className="points-icon">
          <Icon name="gift" size={18} />
        </span>
        <span className="resume-badge">Still open to you</span>
      </div>
      <h3>
        {open.length} more {open.length === 1 ? "way" : "ways"} to lower this
      </h3>
      <p>
        Nothing here is awarded yet, so none of it is subtracted from your balance. Together they could
        reduce it by up to {money.format(total)}.
      </p>
      <ul className="aid-opportunity-list">
        {open.map((award) => (
          <li key={award.id}>
            <strong>
              {award.name}, up to {money.format(award.offeredAmountCents)}
            </strong>
            <span>{award.status === "offered" ? "Offered and not yet accepted" : "Pending confirmation"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Metric = {
  id: string;
  label: string;
  gloss?: string;
  term: string;
  minimumLabel: string;
  value: number;
  display: string;
  max: number;
  above: boolean;
  invert?: boolean;
};

function metricsOf(sap: StudentFinancials["sap"]): Metric[] {
  return [
    {
      id: "gpa",
      label: "Grade point average",
      term: "gpa",
      minimumLabel: `minimum ${sap.minimumGpa.toFixed(1)}`,
      value: sap.cumulativeGpa,
      display: sap.cumulativeGpa.toFixed(2),
      max: 4,
      above: sap.cumulativeGpa >= sap.minimumGpa,
    },
    {
      id: "pace",
      label: "Completion pace",
      gloss: "the share of credits you finish out of the ones you start",
      term: "pace",
      minimumLabel: `minimum ${sap.minimumCompletionRatePercent}%`,
      value: sap.completionRatePercent,
      display: `${sap.completionRatePercent}%`,
      max: 100,
      above: sap.completionRatePercent >= sap.minimumCompletionRatePercent,
    },
    {
      id: "credits",
      label: "Attempted credits",
      gloss: "every credit you start whether or not you pass",
      term: "credits",
      minimumLabel: `maximum ${sap.maximumAttemptedCredits}`,
      value: sap.attemptedCredits,
      display: String(sap.attemptedCredits),
      max: sap.maximumAttemptedCredits,
      above: sap.attemptedCredits <= sap.maximumAttemptedCredits,
      invert: true,
    },
  ];
}

function chipFor(metric: Metric) {
  if (metric.invert) {
    return metric.above ? { word: "Within the limit", tone: "ok" } : { word: "Over the limit", tone: "watch" };
  }
  return metric.above ? { word: "Above the minimum", tone: "ok" } : { word: "Below the minimum today", tone: "watch" };
}

/**
 * A preview of an institutional check that must not read as a verdict. Every
 * row reports and none judges: no pass, no fail, no red.
 */
export function ProgressPreview({ sap, onExplain }: { sap: StudentFinancials["sap"]; onExplain: () => void }) {
  const { copy } = useTenant();
  const metrics = metricsOf(sap);

  return (
    <Card variant="progress-preview" aria-labelledby="progress-title">
      <div className="card-heading">
        <span className="card-icon">
          <Icon name="chart" size={19} />
        </span>
        <div>
          <h2 id="progress-title">
            Academic progress preview
            <TermTip term="progress" label="academic progress" />
          </h2>
        </div>
      </div>

      <p className="preview-intro">
        {copy("{institution} checks three things at the end of each term to keep your aid. This is what your record shows today.")}
      </p>

      <ul className="metric-list">
        {metrics.map((metric) => {
          const chip = chipFor(metric);
          return (
            <li className="metric-row" key={metric.id}>
              <div className="metric-head">
                <span className="metric-label">
                  <span>
                    {metric.label}
                    {metric.gloss && <small className="metric-gloss">, {metric.gloss}</small>}
                  </span>
                  <TermTip term={metric.term} label={metric.label} />
                </span>
                <span className={`metric-chip ${chip.tone}`}>{chip.word}</span>
              </div>
              <div className="metric-bar" role="img" aria-label={`${metric.label}: ${metric.display}, ${metric.minimumLabel}`}>
                <span style={{ width: `${share(metric.value, metric.max)}%` }} />
              </div>
              <div className="metric-scale">
                <span>{metric.display}</span>
                <span>{metric.minimumLabel}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="preview-disclaimer">
        <Icon name="shield" size={16} />
        {copy("This is a preview. It isn’t {institution}’s decision. The Financial Aid Office reviews every record individually.")}
      </p>

      <button className="learn-link" type="button" onClick={onExplain}>
        What academic progress means <Icon name="arrow" size={14} />
      </button>
    </Card>
  );
}
