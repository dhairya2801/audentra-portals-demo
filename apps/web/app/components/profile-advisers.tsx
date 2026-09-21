"use client";

import type { StaffAssignmentRole, StudentAdviserAssignment, StudentAdvising } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import Notice from "../design-system/patterns/Notice.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import { TenantLink as Link } from "./tenant-link";

/**
 * Your advisers — the people the platform has assigned to this student, read
 * from GET /v1/student/advising. The primary adviser leads; every other
 * assignment follows with its role. A gap the platform reports (no primary
 * adviser, an adviser who left or is on leave, no open slots) is said in the
 * platform's own words rather than papered over with a name.
 */

const ROLE_LABEL: Record<StaffAssignmentRole, string> = {
  primary_advisor: "Primary adviser",
  admissions_counselor: "Admissions counselor",
  financial_aid_counselor: "Financial aid counselor",
  international_adviser: "International adviser",
  housing_coordinator: "Housing coordinator",
};

function formatSlot(iso: string, locale: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString(locale);
  }
}

/** One sentence about whether — and when — this person can be booked. */
export function availabilityLine(
  assignment: StudentAdviserAssignment,
  locale: string,
  timeZone: string,
) {
  const { availability, staff } = assignment;
  if (staff.employmentStatus === "departed") return "No longer at the university.";
  if (staff.employmentStatus === "on_leave") {
    return `On leave${staff.leaveUntil ? ` until ${staff.leaveUntil}` : ""}; cannot be booked right now.`;
  }
  if (!availability.bookable) {
    return availability.reason === "no_availability"
      ? "Has not published appointment hours yet."
      : availability.reason === "does_not_offer_type"
        ? "Does not take appointments of this kind."
        : "Cannot be booked right now.";
  }
  if (availability.nextOpenSlotAt) {
    return `Next open slot ${formatSlot(availability.nextOpenSlotAt, locale, timeZone)} · ${availability.openSlotsNext14Days} open in the next 14 days.`;
  }
  return "No open slot in the next 14 days.";
}

function AdviserRow({
  label,
  assignment,
  locale,
  timeZone,
}: {
  label: string;
  assignment: StudentAdviserAssignment;
  locale: string;
  timeZone: string;
}) {
  const { staff } = assignment;
  const detail = [staff.title, staff.component].filter(Boolean).join(" · ");
  return (
    <div className="field-row owned">
      <div className="field-head">
        <span className="field-row-label">
          <Icon name="lock" size={11} />
          {label}
        </span>
      </div>
      <div className="field-body">
        <p className="field-value">{staff.name}</p>
        {detail ? <p className="field-note">{detail}</p> : null}
        <p className="field-note">
          <a href={`mailto:${staff.email}`}>{staff.email}</a>
          {staff.officeLocation ? ` · ${staff.officeLocation}` : ""}
        </p>
        <p className={`field-note${assignment.availability.bookable ? "" : " pending"}`}>
          {availabilityLine(assignment, locale, timeZone)}
        </p>
      </div>
      <div className="field-actions">
        {assignment.availability.bookable ? (
          <Link className="field-action" href="/appointments">
            Book time <Icon name="arrow" size={14} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function ProfileAdvisers({
  advising,
  unavailable,
  locale,
  timeZone,
}: {
  advising: StudentAdvising | null;
  /** The advising record could not be read in this session. */
  unavailable: boolean;
  locale: string;
  timeZone: string;
}) {
  const primary = advising?.primaryAdviser ?? null;
  const others = (advising?.advisers ?? []).filter(
    (assignment) => assignment.role !== "primary_advisor",
  );
  const noPrimaryGap = advising?.gaps.find((gap) => gap.code === "no_primary_adviser") ?? null;
  const otherGaps = (advising?.gaps ?? []).filter((gap) => gap.code !== "no_primary_adviser");

  return (
    <section className="section-card" aria-labelledby="advisers-title">
      <div className="status-heading">
        <span className="status-icon record">
          <Icon name="users" size={18} />
        </span>
        <div>
          <h2 id="advisers-title">Your advisers</h2>
          <p>The people assigned to you, and whether they can see you.</p>
        </div>
      </div>

      {unavailable || !advising ? (
        <StateCard variant="partial" icon="clock" title="Your advisers couldn’t be read just now">
          The assignment record did not load in this session. Nothing about it has changed.
        </StateCard>
      ) : (
        <>
          {otherGaps.map((gap) => (
            <Notice tone="soon" icon="alert" key={gap.code}>
              {gap.message}
            </Notice>
          ))}
          <div className="card-rows field-rows">
            {primary ? (
              <AdviserRow label="Primary adviser" assignment={primary} locale={locale} timeZone={timeZone} />
            ) : (
              <div className="field-row owned">
                <div className="field-head">
                  <span className="field-row-label">
                    <Icon name="lock" size={11} />
                    Primary adviser
                  </span>
                </div>
                <div className="field-body">
                  <p className="field-value blank">Not assigned yet</p>
                  <p className="field-note pending">
                    {noPrimaryGap?.message ?? "No primary adviser is on your record yet."}
                  </p>
                </div>
              </div>
            )}
            {others.map((assignment) => (
              <AdviserRow
                key={`${assignment.role}:${assignment.staff.id}`}
                label={ROLE_LABEL[assignment.role] ?? assignment.role}
                assignment={assignment}
                locale={locale}
                timeZone={timeZone}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
