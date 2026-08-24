"use client";

import type { StudentRequirementDetail, StudentRewardSummary } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import AnchorCard from "../design-system/primitives/AnchorCard.jsx";
import { CardFoot, CardRows } from "../design-system/primitives/Card.jsx";
import Notice from "../design-system/patterns/Notice.jsx";
import InfoModal from "../design-system/patterns/InfoModal.jsx";
import { kindIcon, requirementKind } from "../lib/requirement-kind";
import { formatTenantDate, formatTenantMoney, type TenantConfig } from "../lib/tenant";
import { useTenant } from "./tenant-provider";

const LEDGER_SHOWN = 3;

function completedLabel(item: StudentRequirementDetail, tenant: TenantConfig) {
  const stamp = (item as StudentRequirementDetail & { completedAt?: string | null; updatedAt?: string | null })
    .completedAt ?? (item as StudentRequirementDetail & { updatedAt?: string | null }).updatedAt ?? null;
  if (!stamp) return "Completed";
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return "Completed";
  return formatTenantDate(date, tenant, { month: "short", day: "numeric" });
}

/**
 * What a point is worth — the reference's popover on the platform's ledger.
 *
 * The balance and its bookstore value come from the reward summary the
 * platform publishes; the awards are the requirements the platform marks as
 * earned. Aster's reference draws a reward ladder from a catalogue the
 * platform does not hold, so that zone is not drawn here rather than invented.
 */
export function PointsPopover({
  rewards,
  awarded,
  awardsState,
  onOpenPoints,
  onClose,
}: {
  rewards: StudentRewardSummary;
  awarded: StudentRequirementDetail[];
  awardsState: "loading" | "ready" | "error";
  onOpenPoints: () => void;
  onClose: () => void;
}) {
  const { tenant } = useTenant();
  const balance = rewards.lifetimePoints;
  const credit = formatTenantMoney(rewards.bookstoreCreditCents, tenant);
  const shown = awarded.slice(0, LEDGER_SHOWN);
  const rest = Math.max(0, awarded.length - LEDGER_SHOWN);

  const line =
    balance === 0
      ? "You haven’t earned any points yet. Finishing a step is what earns them."
      : `Worth ${credit} in bookstore credit today`;

  return (
    <>
      <AnchorCard
        variant="balance"
        label="Your momentum"
        figure={
          <>
            {balance.toLocaleString()} <small>pts</small>
          </>
        }
      >
        <span className="balance-mark" aria-hidden="true">
          <Icon name="spark" size={18} />
        </span>
        <p>{line}</p>
      </AnchorCard>

      <CardRows>
        <p className="rows-label reaches">What it reaches</p>
        <div className={`ladder-row${balance > 0 ? " reached" : " next"}`}>
          <i className="ladder-dot" aria-hidden="true" />
          <span className="ladder-name">
            Bookstore credit
            {balance > 0 && <span className="sr-only"> — reached</span>}
          </span>
          <span className="ladder-cost">
            {rewards.pointsPerUsd.toLocaleString()} pts = {formatTenantMoney(100, tenant)}
          </span>
        </div>

        {awardsState === "ready" && awarded.length > 0 && (
          <>
            <p className="rows-label earned-run">
              How you earned it
              <em>
                {awarded.length} {awarded.length === 1 ? "step" : "steps"}
              </em>
            </p>
            {shown.map((award) => {
              const kind = requirementKind(award);
              return (
                <div className="pop-row award-row" key={award.id}>
                  <span className={`task-type-icon ${kind}`} aria-hidden="true">
                    <Icon name={kindIcon(kind)} size={21} weight="duotone" />
                  </span>
                  <span className="pop-copy">
                    <strong>{award.title}</strong>
                    <small>{completedLabel(award, tenant)}</small>
                  </span>
                  <span className="award-points">
                    <Icon name="spark" size={13} /> +{award.reward?.points ?? 0}
                  </span>
                </div>
              );
            })}
            {rest > 0 && <p className="pop-more">and {rest} more</p>}
          </>
        )}
        {awardsState === "loading" && (
          <div className="pop-row skeleton" aria-busy="true">
            <span className="skeleton-line tile" />
            <span className="pop-skeleton-copy">
              <i className="skeleton-line" />
              <i className="skeleton-line short" />
            </span>
          </div>
        )}
      </CardRows>

      <CardFoot>
        <Notice
          tone="quiet"
          action={{
            label: "How points work",
            onClick: () => {
              onClose();
              onOpenPoints();
            },
          }}
        >
          Points come from {tenant.shortName}’s published reward list. What you’ve already earned
          never changes when that list does.
        </Notice>
      </CardFoot>
    </>
  );
}

/**
 * The rules of the system, behind the link — the reference's "How points
 * work" modal, with its figures read from the platform's reward summary rather
 * than a design fixture.
 */
export function PointsInfoModal({
  rewards,
  onClose,
}: {
  rewards: StudentRewardSummary;
  onClose: () => void;
}) {
  const { tenant } = useTenant();
  const rules = [
    `Each step starts with a reward set by ${tenant.shortName}.`,
    `${rewards.pointsPerUsd.toLocaleString()} ${rewards.pointName} are worth ${formatTenantMoney(100, tenant)} of bookstore credit.`,
    "Your deadlines never change — and points never affect admission decisions.",
  ];
  return (
    <InfoModal variant="points" kicker={rewards.pointName} icon="spark" title="A little reward for moving early." onClose={onClose}>
      <p>
        Points make progress visible and celebrate finishing important steps before they become
        stressful.
      </p>
      <div className="formula-card">
        <div>
          <span>Earned</span>
          <strong>{rewards.lifetimePoints.toLocaleString()} pts</strong>
        </div>
        <div className="formula-line">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div>
          <span>Bookstore credit</span>
          <strong>{formatTenantMoney(rewards.bookstoreCreditCents, tenant)}</strong>
        </div>
      </div>
      <ul className="point-rules">
        {rules.map((rule) => (
          <li key={rule}>
            <span>
              <Icon name="check" size={15} />
            </span>
            {rule}
          </li>
        ))}
      </ul>
      <div className="modal-note safe">
        <Icon name="shield" size={18} /> Points recognize participation only. They are not academic
        credit and are not used to evaluate students.
      </div>
    </InfoModal>
  );
}
