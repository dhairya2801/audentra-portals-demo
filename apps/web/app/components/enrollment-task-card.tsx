"use client";

import type { StudentRequirementDetail } from "@vv/contracts";
import { displayedTaskPoints } from "./student-ui-preview";
import Icon from "../design-system/Icon.jsx";
import ActionBand from "../design-system/patterns/ActionBand.jsx";
import EdwardAsk from "../design-system/patterns/EdwardAsk.jsx";
import { openEdward } from "../design-lib/door.js";
import {
  actionLabel,
  daysClause,
  dueShort,
  edwardAskFor,
  estimatedMinutes,
  iconOf,
  kindOf,
  priorityLabel,
  priorityOf,
} from "./enrollment-model";
import { useTenant } from "./tenant-provider";

/** The mark a gating requirement carries — the reference's `GateChip`, on a real `blocking` step. */
export function GateChip({ state }: { state?: "in-review" | "needed" }) {
  return (
    <span className="gate-chip">
      <Icon name="flag" size={13} />
      Holds class registration
      {state === "in-review" ? <span className="gate-detail">· In review</span> : null}
    </span>
  );
}

export function EnrollmentTaskCard({
  item,
  unlocks,
  recommended,
  rewardsOn,
  feedback,
  studentManaged,
  onOpen,
}: {
  item: StudentRequirementDetail;
  unlocks: number;
  recommended: boolean;
  rewardsOn: boolean;
  feedback?: string;
  studentManaged: boolean;
  onOpen: (item: StudentRequirementDetail, tab?: "action" | "how") => void;
}) {
  const { tenant } = useTenant();
  const kind = kindOf(item);
  const priority = priorityOf(item);
  const due = dueShort(item, tenant);
  const clause = daysClause(item);
  const points = displayedTaskPoints(item);
  const gates = item.blocking;

  return (
    <article className={`task-card ${recommended ? "recommended" : ""} ${gates ? "gating" : ""}`}>
      {recommended && (
        <ActionBand
          icon="spark"
          label="Start here"
          aside={unlocks > 0 ? `Unlocks ${unlocks} more ${unlocks === 1 ? "step" : "steps"}` : "Highest priority right now"}
        />
      )}

      <div className="task-card-body">
        <div className={`task-type-icon ${kind}`}>
          <Icon name={iconOf(item)} size={21} weight="duotone" />
        </div>

        <div className="task-main">
          <div className="task-meta-row">
            <span>{item.responsibleOffice || "Enrollment"}</span>
            <span className={`priority-badge ${priority}`}>{priorityLabel(priority)}</span>
          </div>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          {item.status === "rejected" ? <div className="task-return-note"><Icon name="alert" size={14} /> {feedback ? `Changes requested · ${feedback}` : "Action needed · Open your submission to review the requested changes."}</div> : null}
          {gates && <GateChip />}
          <div className="task-facts">
            <span>
              <Icon name="calendar" size={15} /> {due ? `Due ${due}` : "No deadline"}
              {clause ? <b> · {clause}</b> : null}
            </span>
            <span title="Illustrative estimate of your effort; university review time is separate."><Icon name="clock" size={15} /> About {estimatedMinutes(item)} min</span>
            {item.submissionType === "payment" && (
              <span>
                <Icon name="shield" size={15} /> Verified automatically
              </span>
            )}
          </div>
        </div>

        <div className="task-action">
          {rewardsOn && points > 0 && (
            <div className="point-reward">
              <span>
                <Icon name="spark" size={14} /> {`${points} pts today`}
              </span>
            </div>
          )}
          {studentManaged ? (
            <span className="secondary-button" aria-disabled="true">
              Student managed
            </span>
          ) : (
            <>
              <button
                type="button"
                className={recommended ? "primary-button" : "secondary-button"}
                onClick={() => onOpen(item, "action")}
              >
                {actionLabel(item)} <Icon name="arrow" size={16} />
              </button>
              <button type="button" className="text-button" onClick={() => onOpen(item, "how")}>
                How this works
              </button>
            </>
          )}
          <EdwardAsk mark="E" onClick={() => openEdward(edwardAskFor(item, tenant))} />
        </div>
      </div>
    </article>
  );
}
