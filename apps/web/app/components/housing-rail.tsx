"use client";

import Icon from "../design-system/Icon.jsx";
import AnchorCard from "../design-system/primitives/AnchorCard.jsx";
import type { Deadline } from "./housing-logic";

/**
 * The rail — the reference `HousingRail` before the deadline: the date, and in
 * one sentence what a preference is worth. The office's building and hours are
 * not published by the backend, so the anchor stops at the date.
 */
export function HousingRail({
  office,
  deadline,
  onHow,
}: {
  office: string;
  deadline: Deadline;
  onHow: () => void;
}) {
  return (
    <>
      {deadline ? (
        <AnchorCard variant="deadline" label="Answer by" figure={deadline.label}>
          <p>
            {deadline.daysLeft < 0
              ? `That date has passed. Your plan and your order are still yours to change here until ${office} closes responses.`
              : deadline.daysLeft === 0
                ? "Due today. Until then your plan and your order are both yours to change."
                : `${deadline.daysLeft} ${deadline.daysLeft === 1 ? "day" : "days"} left. Until then your plan and your order are both yours to change.`}
          </p>
          <p className="reply-note">
            <Icon name="home" size={14} /> {office}
          </p>
        </AnchorCard>
      ) : null}

      <div className="provenance-card">
        <span className="panel-label">What a preference is worth</span>
        <p>
          You tell {office} what you’d like, in order. They decide, and they may place you somewhere you
          didn’t name.
        </p>
        <button type="button" className="text-button" onClick={onHow}>
          How housing decisions work <Icon name="arrow" size={14} />
        </button>
      </div>
    </>
  );
}
