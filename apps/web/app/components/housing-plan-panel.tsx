"use client";

import type { HousingPreference } from "@vv/contracts";
import { useRef } from "react";
import Icon from "../design-system/Icon.jsx";
import ActionBand from "../design-system/patterns/ActionBand.jsx";
import { type Band, type Deadline, planById, planOptions } from "./housing-logic";

/**
 * The first question, and the only one on this page the student actually
 * decides — the reference `PlanPanel`, with the five answers the backend holds.
 */
export function HousingPlanPanel({
  plan,
  source,
  deadline,
  saving,
  band,
  onChoose,
  onRetry,
}: {
  plan: HousingPreference | null;
  source: "onboarding" | "portal";
  deadline: Deadline;
  saving: boolean;
  band: Band;
  onChoose: (next: HousingPreference) => void;
  onRetry: () => void;
}) {
  const group = useRef<HTMLDivElement>(null);
  const chosen = planById(plan, deadline?.label ?? null);
  const options = planOptions(deadline?.label ?? null);

  function focusQuestion() {
    const input =
      group.current?.querySelector<HTMLInputElement>("input:checked") ??
      group.current?.querySelector<HTMLInputElement>("input");
    input?.focus();
  }

  return (
    <section className="section-card" aria-labelledby="plan-heading">
      <div className="status-heading">
        <span className="status-icon accent" aria-hidden="true">
          <Icon name="home" size={20} />
        </span>
        <div>
          <h2 id="plan-heading">Where will you live?</h2>
          <p>First question</p>
        </div>
      </div>

      {band ? (
        <ActionBand
          icon={band.icon}
          label={band.label}
          action={{ ...band.action, onClick: band.kind === "retry" ? onRetry : focusQuestion }}
        />
      ) : null}

      <p className="panel-lede">
        All five are real answers. Pick the one that’s true.
        {deadline ? ` You can change it until ${deadline.full}.` : " You can change it any time."}
      </p>

      <div className="choice-panel" role="radiogroup" aria-labelledby="plan-heading" ref={group}>
        {options.map((option) => (
          <label key={option.id} className={plan === option.id ? "chosen" : ""}>
            <input
              type="radio"
              name="housing-plan"
              value={option.id}
              checked={plan === option.id}
              disabled={saving}
              onChange={() => onChoose(option.id)}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.hint}</small>
            </span>
            <span className="radio-mark">
              <Icon name="check" size={14} />
            </span>
          </label>
        ))}
      </div>

      {chosen ? (
        <p className="choice-consequence" aria-live="polite">
          <Icon name={chosen.complete ? "check" : "clock"} size={16} />
          <span>
            {source === "onboarding" && chosen.complete
              ? `You answered this during onboarding, so it is already recorded. ${chosen.consequence}`
              : chosen.consequence}
          </span>
        </p>
      ) : null}
    </section>
  );
}
