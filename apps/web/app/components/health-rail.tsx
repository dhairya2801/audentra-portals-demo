"use client";

import type { StudentRequirementDetail } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import AnchorCard from "../design-system/primitives/AnchorCard.jsx";
import { useTenant } from "./tenant-provider";
import { daysLeft, officeName, shortDate, type RecordState } from "./health-logic";

function hers(state: RecordState) {
  return state === "needed" || state === "changes-requested" || state === "blocked";
}

/**
 * The rail — the reference `HealthRail`, with what the backend can say: the
 * record's deadline as the anchor (the office's usual review time is not
 * published), who reviews it, the active immunization policy where one is
 * published, and who handles accessibility.
 */
export function HealthRail({
  requirement,
  state,
  unavailable,
}: {
  requirement: StudentRequirementDetail | null;
  state: RecordState | null;
  unavailable: boolean;
}) {
  const { tenant } = useTenant();
  const office = officeName(requirement);
  const due = shortDate(requirement?.dueAt, tenant);
  const days = daysLeft(requirement?.dueAt);
  const policy = requirement?.immunizationPolicy ?? null;
  const accessibilityLink = tenant.publicLinks.accessibility ?? null;

  return (
    <>
      {requirement && !unavailable && state && !hers(state) ? (
        <AnchorCard
          variant="reply"
          label="Where your record is"
          figure={state === "accepted" ? "Accepted" : state === "checking" ? "Being checked" : "With " + office}
        >
          <p>
            {state === "accepted"
              ? `${office} has accepted it. Nothing more is needed here.`
              : `Nothing for you to do while ${office} has it.`}
          </p>
        </AnchorCard>
      ) : requirement?.dueAt ? (
        <AnchorCard variant="deadline" label="Send it by" figure={unavailable ? "—" : due}>
          <p>
            {unavailable
              ? "Your record could not be read just now, so nothing here is a claim about where it is."
              : days === null
                ? `${office} asks for your record by then.`
                : days < 0
                  ? `That date has passed. ${office} still needs your record, and it can still be sent here.`
                  : days === 0
                    ? `Due today. ${office} reviews it once it arrives.`
                    : `${days} ${days === 1 ? "day" : "days"} left. ${office} reviews it once it arrives.`}
          </p>
        </AnchorCard>
      ) : null}

      <div className="provenance-card teams-card">
        <span className="panel-label">Who reviews your record</span>
        <ul className="teams-list">
          <li>
            <strong>{office}</strong>
            <span>Reads your immunization record and decides whether it clears.</span>
          </li>
        </ul>
      </div>

      {policy ? (
        <div className="provenance-card published-card">
          <span className="panel-label">What counts as proof</span>
          <p>
            {office} published {policy.name}: the vaccines it requires, and what {tenant.shortName} accepts as
            evidence of each.
          </p>
          <ul className="teams-list">
            {policy.requirements
              .filter((item) => item.required)
              .map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  {item.doseCount ? (
                    <span>
                      {item.doseCount} documented {item.doseCount === 1 ? "dose" : "doses"}
                    </span>
                  ) : null}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      <div className="provenance-card teams-card">
        <span className="panel-label">Who handles accessibility</span>
        <ul className="teams-list">
          <li>
            <strong>Accessibility Services</strong>
            <span>
              Extra time, note-taking, accessible rooms, flexible attendance. They talk to you first and
              set up whatever fits.
            </span>
            {accessibilityLink ? (
              <span className="team-where">
                <a className="link-button" href={accessibilityLink}>
                  <Icon name="external" size={13} /> Accessibility at {tenant.shortName}
                </a>
              </span>
            ) : null}
          </li>
        </ul>
      </div>
    </>
  );
}
