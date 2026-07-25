import type {
  StudentDashboard,
  StudentRequirementSummary,
} from "@vv/contracts";

const terminalStatuses = new Set([
  "completed",
  "waived",
  "not_applicable",
]);

const actionableStatusPriority = new Map([
  ["rejected", 0],
  ["expired", 0],
  ["in_progress", 1],
  ["ready", 2],
]);

export type DashboardEnrollmentAction = {
  kind: "task" | "waiting" | "complete";
  code: string;
  label: string;
  href: string;
};

function isTerminal(requirement: StudentRequirementSummary) {
  return terminalStatuses.has(requirement.status);
}

function priority(requirement: StudentRequirementSummary) {
  const actionable = actionableStatusPriority.get(requirement.status);
  if (actionable !== undefined) {
    return (requirement.blocking ? 0 : 10) + actionable;
  }

  return requirement.blocking ? 20 : 30;
}

export function prioritizeDashboardRequirements(
  requirements: StudentRequirementSummary[],
) {
  return requirements
    .map((requirement, index) => ({ requirement, index }))
    .filter(({ requirement }) => !isTerminal(requirement))
    .sort(
      (left, right) =>
        priority(left.requirement) - priority(right.requirement) ||
        left.index - right.index,
    )
    .map(({ requirement }) => requirement);
}

export function selectDashboardEnrollmentAction(
  journey: StudentDashboard["journey"],
  requirementHref: (code: string) => string = (code) =>
    `/enrollment?requirement=${encodeURIComponent(code)}`,
): DashboardEnrollmentAction {
  if (!journey.id) {
    return {
      kind: "task",
      ...journey.nextAction,
    };
  }

  const pending = prioritizeDashboardRequirements(journey.requirements);
  const actionable = pending.find((requirement) =>
    actionableStatusPriority.has(requirement.status),
  );

  if (actionable) {
    return {
      kind: "task",
      code: actionable.code,
      label: actionable.title,
      href: requirementHref(actionable.code),
    };
  }

  if (pending.length > 0) {
    const reviewIsActive = pending.some((requirement) =>
      ["submitted", "under_review"].includes(requirement.status),
    );
    return {
      kind: "waiting",
      code: reviewIsActive ? "enrollment_review_pending" : "enrollment_blocked",
      label: reviewIsActive
        ? "Enrollment review in progress"
        : "View enrollment dependencies",
      href: "/enrollment",
    };
  }

  return {
    kind: "complete",
    code: "enrollment_complete",
    label: "Enrollment complete",
    href: "/enrollment",
  };
}
