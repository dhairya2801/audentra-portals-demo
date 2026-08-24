"use client";

import type { MouseEvent } from "react";
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import {
  type CreditMatch,
  type DegreeCourse,
  type DegreeRequirement,
  countsToward,
  courseSituation,
  courseSlug,
  groupCourses,
  matchTargeting,
  plannable,
  remainingLine,
  requirementStatus,
  statusIcon,
  statusLabel,
} from "./classrooms-model";

/** What a planned course is, said once per open requirement (brief, D6). */
export const PLAN_HELPER =
  "Your own list. It doesn’t register you for anything and it doesn’t change any credit.";

function creditsLabel(requirement: DegreeRequirement) {
  const approved = requirement.creditsApproved == null ? "—" : requirement.creditsApproved;
  return `${approved} of ${requirement.creditsRequired} credits`;
}

function countLabel(count: number) {
  if (count === 0) return "No course listed yet";
  return `${count} ${count === 1 ? "course satisfies" : "courses satisfy"} this`;
}

function courseIcon(state: DegreeCourse["state"]) {
  if (state === "approved") return "check";
  if (state === "locked") return "lock";
  return "book";
}

export function CourseRow({
  course,
  requirement,
  matches,
  currentTerm,
  planned,
  onPlan,
  onUnplan,
  onOpen,
  onRevealMatch,
}: {
  course: DegreeCourse;
  requirement: DegreeRequirement;
  matches: CreditMatch[] | null;
  currentTerm: string;
  planned: boolean;
  onPlan: (code: string) => void;
  onUnplan: (code: string) => void;
  onOpen: (course: DegreeCourse, requirement: DegreeRequirement) => void;
  onRevealMatch: (match: CreditMatch) => void;
}) {
  const situation = courseSituation(course, currentTerm);
  const allocation = countsToward(course, requirement);
  const pending = matchTargeting(matches, course.code);
  const canPlan = plannable(course, currentTerm);

  return (
    <article
      className={`course-row ${course.state} ${situation}${planned ? " planned" : ""}`}
      id={`course-${courseSlug(course.code)}`}
    >
      <span className={`course-mark ${course.state}`} aria-hidden="true">
        <Icon name={courseIcon(course.state)} size={15} />
      </span>

      <div className="course-identity">
        <p className="course-name">
          <span>
            {course.code} · {course.title}
          </span>
          {planned ? <span className="planned-pill">Planned</span> : null}
        </p>
        <p className="course-meta">
          <span>{course.credits} credits</span>
          <span>{course.terms}</span>
          {course.prerequisite && course.prerequisiteMet ? (
            <span className="met">Requires {course.prerequisite}, and you have it</span>
          ) : null}
        </p>
        <p className={`course-counts ${allocation.kind}`}>{allocation.text}</p>
        {pending ? (
          <p className="course-pending">
            <Icon name="info" size={13} /> A potential match targets this course.{" "}
            <button type="button" className="link-button" onClick={() => onRevealMatch(pending)}>
              See it.
            </button>
          </p>
        ) : null}
      </div>

      <div className="course-trailing">
        {course.state === "approved" && course.decidedOn ? (
          <span className="course-status approved">{course.decidedOn}</span>
        ) : null}
        {course.state === "locked" ? (
          <span className="course-status locked">Locked until you have {course.prerequisite}</span>
        ) : null}
        {canPlan && !planned ? (
          <Button kind="primary" leadingIcon="plus" iconSize={15} onClick={() => onPlan(course.code)}>
            Add to my plan
          </Button>
        ) : null}
        {canPlan && planned ? (
          <span className="course-planned">
            In your plan
            <button type="button" className="text-button" onClick={() => onUnplan(course.code)}>
              Remove
            </button>
          </span>
        ) : null}
        <button type="button" className="text-button" onClick={() => onOpen(course, requirement)}>
          Details
        </button>
      </div>
    </article>
  );
}

export function RequirementCard({
  requirement,
  matches,
  requirementMatches,
  currentTerm,
  open,
  onToggle,
  onReveal,
  plan,
  onPlan,
  onUnplan,
  onOpenCourse,
  onRevealMatch,
}: {
  requirement: DegreeRequirement;
  matches: CreditMatch[] | null;
  requirementMatches: CreditMatch[];
  currentTerm: string;
  open: boolean;
  onToggle: (id: string) => void;
  onReveal: (id: string, group?: string) => void;
  plan: Set<string>;
  onPlan: (code: string) => void;
  onUnplan: (code: string) => void;
  onOpenCourse: (course: DegreeCourse, requirement: DegreeRequirement) => void;
  onRevealMatch: (match: CreditMatch) => void;
}) {
  const status = requirementStatus(requirement);
  const panelId = `requirement-${requirement.id}-courses`;
  const remaining = remainingLine(requirement);
  const groups = groupCourses(requirement, currentTerm);
  const firstPlannable =
    groups.find((group) => group.courses.some((course) => plannable(course, currentTerm)))?.id ??
    null;
  const unfinished = status === "in-progress" || status === "not-started";
  const canTake = groups.some((group) => group.id === "now");

  function onHeadClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, a")) return;
    onToggle(requirement.id);
  }

  return (
    <article
      className={`requirement-card ${status}${open ? " open" : ""}`}
      id={`requirement-${requirement.id}`}
    >
      <div className="requirement-head" onClick={onHeadClick}>
        <span className={`requirement-mark ${status}`} aria-hidden="true">
          <Icon name={statusIcon(status)} size={16} />
        </span>

        <div className="requirement-identity">
          <h3>
            <button
              type="button"
              className="requirement-toggle"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => onToggle(requirement.id)}
            >
              {requirement.name}
            </button>
          </h3>
          <p className="requirement-summary">{requirement.summary}</p>
          {remaining ? <p className="requirement-remaining">{remaining}</p> : null}
          {!open ? (
            <p className="requirement-count">{countLabel(requirement.courses.length)}</p>
          ) : null}
        </div>

        <div className="requirement-meters">
          <span className="requirement-credits">{creditsLabel(requirement)}</span>
          <span className={`requirement-status ${status}`}>{statusLabel(status)}</span>
          {unfinished && canTake ? (
            <button
              type="button"
              className="text-button requirement-action"
              onClick={() => onReveal(requirement.id, "now")}
            >
              See what you can take
            </button>
          ) : null}
        </div>

        <span className="requirement-chevron" aria-hidden="true">
          <Icon name="chevron" size={18} />
        </span>
      </div>

      {requirementMatches.length > 0 ? (
        <button
          type="button"
          className="match-flag"
          onClick={() => onRevealMatch(requirementMatches[0])}
        >
          <Icon name="info" size={13} />
          {requirementMatches.length === 1
            ? "1 potential match"
            : `${requirementMatches.length} potential matches`}
          , waiting on the Registrar
          <Icon name="arrow" size={13} />
        </button>
      ) : null}

      <div className="requirement-courses" id={panelId} hidden={!open}>
        {groups.map((group) => (
          <div
            className="course-group"
            key={group.id}
            id={`requirement-${requirement.id}-${group.id}`}
          >
            <p className="requirement-courses-label">{group.label}</p>
            {group.id === firstPlannable ? <p className="plan-helper">{PLAN_HELPER}</p> : null}
            {group.courses.map((course) => (
              <CourseRow
                key={course.code}
                course={course}
                requirement={requirement}
                matches={matches}
                currentTerm={currentTerm}
                planned={plan.has(course.code)}
                onPlan={onPlan}
                onUnplan={onUnplan}
                onOpen={onOpenCourse}
                onRevealMatch={onRevealMatch}
              />
            ))}
          </div>
        ))}

        {requirement.decidedOn ? (
          <p className="requirement-decided">
            <Icon name="shield" size={14} /> {requirement.decidedOn}
          </p>
        ) : null}
      </div>
    </article>
  );
}
