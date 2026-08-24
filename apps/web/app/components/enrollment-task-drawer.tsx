"use client";

import type { StudentRequirementDetail } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import Drawer from "../design-system/primitives/Drawer.jsx";
import Tooltip from "../design-system/primitives/Tooltip.jsx";
import { TenantLink as Link } from "./tenant-link";
import { GateChip } from "./enrollment-task-card";
import {
  actionLabel,
  daysClause,
  dueShort,
  iconOf,
  kindOf,
  requirementHref,
  stepsOf,
} from "./enrollment-model";
import { useTenant } from "./tenant-provider";

export type DrawerTab = "action" | "how";

/**
 * The reference's `TaskDrawer` on a platform requirement. The drawer explains
 * and points; the work itself happens on the requirement page, which owns the
 * upload, the payment and the form — one door per step.
 */
export function EnrollmentTaskDrawer({
  item,
  unlocked,
  tab,
  suspended,
  rewardsOn,
  onTab,
  onClose,
  onOpenPoints,
  onView,
}: {
  item: StudentRequirementDetail;
  unlocked: StudentRequirementDetail[];
  tab: DrawerTab;
  suspended: boolean;
  rewardsOn: boolean;
  onTab: (tab: DrawerTab) => void;
  onClose: () => void;
  onOpenPoints: () => void;
  onView: (item: StudentRequirementDetail) => void;
}) {
  const { tenant } = useTenant();
  const kind = kindOf(item);
  const due = dueShort(item, tenant);
  const clause = daysClause(item);
  const points = item.reward?.points ?? 0;
  const office = item.responsibleOffice || "your enrollment team";
  const steps = stepsOf(item);
  const action = actionLabel(item);

  const why = [
    item.blocking ? "This step holds your class registration until it is done." : null,
    unlocked.length > 0
      ? `Finishing it opens ${unlocked.length === 1 ? "‘" + unlocked[0].title + "’" : `${unlocked.length} more steps`}.`
      : null,
    due
      ? clause === "overdue"
        ? `It was due ${due}.`
        : clause === "today"
          ? `It is due today, ${due}.`
          : `It is due ${due}, in ${clause}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const where =
    item.submissionType === "document"
      ? `You’ll send the document from this step’s own page, where ${office} reads it.`
      : item.submissionType === "payment"
        ? `You’ll finish payment on this step’s own page. When it’s received, this checklist updates automatically.`
        : item.submissionType === "appointment"
          ? `You’ll book from this step’s own page.`
          : `You’ll answer on this step’s own page.`;

  return (
    <Drawer
      label={[item.responsibleOffice || "Enrollment", due ? `Due ${due}` : "No deadline"]}
      titleId="drawer-title"
      closeLabel="Close task"
      onClose={onClose}
      suspended={suspended}
    >
      <div className={`drawer-icon ${kind}`}>
        <Icon name={iconOf(item)} size={25} weight="duotone" />
      </div>
      <h2 id="drawer-title">{item.title}</h2>
      <p className="drawer-description">{item.description}</p>
      {item.blocking && <GateChip />}

      {rewardsOn && points > 0 && (
        <div className="drawer-reward">
          <div>
            <Icon name="spark" size={18} />
            <span>
              <strong>Earn {points} points today</strong>
            </span>
          </div>
          <Tooltip tip="How points work">
            <button type="button" onClick={onOpenPoints} aria-label="Learn how points work">
              <Icon name="info" size={17} />
            </button>
          </Tooltip>
        </div>
      )}

      <div className="drawer-tabs" role="tablist">
        <button
          type="button"
          className={tab === "action" ? "active" : ""}
          onClick={() => onTab("action")}
          role="tab"
          aria-selected={tab === "action"}
        >
          Do it now
        </button>
        <button
          type="button"
          className={tab === "how" ? "active" : ""}
          onClick={() => onTab("how")}
          role="tab"
          aria-selected={tab === "how"}
        >
          How it works
        </button>
      </div>

      {tab === "how" ? (
        <div className="how-panel">
          <h3>Here’s what to expect</h3>
          <ol>
            {steps.map((step, index) => (
              <li key={`${index}-${step}`}>
                <span>{index + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
          <div className="help-note">
            <Icon name="help" size={18} />
            <p>
              <strong>Still unsure?</strong> Ask {office}, or ask Edward from the step.
            </p>
          </div>
          <button type="button" className="primary-button full" onClick={() => onTab("action")}>
            Continue <Icon name="arrow" size={17} />
          </button>
        </div>
      ) : (
        <div className="action-panel">
          {why && (
            <div className="why-card">
              <span>
                <Icon name="spark" size={17} />
              </span>
              <div>
                <strong>Why this matters now</strong>
                <p>{why}</p>
              </div>
            </div>
          )}

          <div className="external-panel">
            <p>{where}</p>
            <Link
              className="primary-button full"
              href={requirementHref(item)}
              onClick={() => {
                onView(item);
                onClose();
              }}
            >
              {action} <Icon name="arrow" size={17} />
            </Link>
            <small className="prototype-note">Finishing it there ticks this step off.</small>
          </div>
        </div>
      )}
    </Drawer>
  );
}
