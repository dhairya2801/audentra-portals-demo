"use client";

import type { OnboardingStep, StudentRewardSummary } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import Avatar from "../design-system/primitives/Avatar.jsx";
import { formatTenantMoney } from "../lib/tenant";
import { nextCreditStep } from "./enrollment-model";
import { useTenant } from "./tenant-provider";

/**
 * The reference's `MomentumCard` on the platform's reward summary. The
 * reference measures the balance against a reward catalogue; the platform
 * publishes a bookstore-credit rate instead, so the card counts toward the
 * next whole dollar of credit and says what today's open steps are worth.
 */
export function MomentumCard({
  rewards,
  availableToday,
  onOpenPoints,
}: {
  rewards: StudentRewardSummary;
  availableToday: number;
  onOpenPoints: () => void;
}) {
  const { tenant } = useTenant();
  const next = nextCreditStep(rewards);
  const fill = Math.max(6, 100 - Math.round((next.away / Math.max(1, rewards.pointsPerUsd)) * 100));
  return (
    <div className="momentum-card">
      <div className="momentum-header">
        <span className="points-icon large">
          <Icon name="spark" size={21} />
        </span>
        <div>
          <span>Your momentum</span>
          <strong>
            {next.away.toLocaleString()} pts to {formatTenantMoney(next.dollars * 100, tenant)} in bookstore credit
          </strong>
        </div>
      </div>

      <div className="level-track">
        <span style={{ width: `${fill}%` }} />
      </div>
      <div className="level-labels">
        <span>{rewards.lifetimePoints.toLocaleString()} earned</span>
        <span>{next.cost.toLocaleString()} pts</span>
      </div>
      <div className="today-reward">
        <span>
          <Icon name="gift" size={18} />
        </span>
        <div>
          <strong>{availableToday.toLocaleString()} points are on the table today</strong>
          <p>Worth {formatTenantMoney(rewards.bookstoreCreditCents, tenant)} in bookstore credit so far.</p>
        </div>
      </div>

      <button type="button" className="learn-link" onClick={onOpenPoints}>
        How points work <Icon name="arrow" size={14} />
      </button>
    </div>
  );
}

const STEP_LABELS: Record<OnboardingStep, string> = {
  offer: "your offer",
  about_you: "your details",
  housing: "your housing plan",
  campus_life: "your campus life interests",
  emergency_contacts: "your emergency contacts",
  family_permissions: "your family permissions",
  review_and_sign: "your signature",
  deposit: "your enrollment deposit",
};

function listOf(labels: string[]) {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * The reference's "Saved from welcome" card, drawn only when the onboarding
 * record says something was skipped — never as a fixture sentence.
 */
export function SkippedCard({
  student,
  skipped,
  onResume,
}: {
  student: { name: string };
  skipped: OnboardingStep[];
  onResume: (() => void) | null;
}) {
  const { tenant } = useTenant();
  const labels = skipped.map((step) => STEP_LABELS[step] ?? step.replaceAll("_", " "));
  return (
    <div className="skipped-card">
      <div className="skipped-top">
        <Avatar person={student} size="sm" />
        <span className="resume-badge">Saved from welcome</span>
      </div>
      <h3>No rush. You can finish {labels.length === 1 ? "this" : "these"} now.</h3>
      <p>
        You skipped {listOf(labels)} while accepting your offer. {tenant.shortName} saved your place, so
        nothing was lost.
      </p>
      {onResume ? (
        <button type="button" onClick={onResume}>
          Continue where I left off <Icon name="arrow" size={16} />
        </button>
      ) : null}
    </div>
  );
}
