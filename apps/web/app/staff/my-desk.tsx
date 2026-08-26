"use client";

import type {
  StaffAppointment,
  StaffCaseloadItem,
  StaffMe,
  StaffTeamMember,
} from "@vv/contracts";
import { useCallback, useMemo, useState } from "react";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  ApiClientError,
  getStaffAppointments,
  getStaffCaseload,
  getStaffMe,
  updateStaffAppointment,
} from "../lib/api-client";

/**
 * My desk — the staff member's own chair: who they are in the organisation,
 * the students that are theirs, today's and this week's calendar, their own
 * backlog, and, for managers, the team with the situations that need a
 * decision (a departed adviser still holding a caseload, a colleague on leave,
 * someone over cap or falling behind). Every number comes from
 * /v1/staff/me, /v1/staff/caseload and /v1/staff/appointments.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minuteLabel(minute: number) {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  const suffix = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""} ${suffix}`;
}

function when(iso: string | null | undefined, timezone?: string, withDate = true) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    ...(withDate ? { weekday: "short", month: "short", day: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(iso));
}

function dateOnly(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}

const roleLabel: Record<string, string> = {
  primary_advisor: "Academic adviser",
  admissions_counselor: "Admissions counselor",
  financial_aid_counselor: "Financial aid counselor",
  international_adviser: "International adviser",
  housing_coordinator: "Housing coordinator",
};

const flagCopy: Record<StaffTeamMember["flags"][number], { label: string; tone: string }> = {
  departed_with_caseload: { label: "Departed · students still assigned", tone: "coral" },
  departed: { label: "Departed", tone: "coral" },
  on_leave_with_caseload: { label: "On leave · caseload not covered", tone: "gold" },
  on_leave: { label: "On leave", tone: "gold" },
  over_cap: { label: "Over caseload cap", tone: "coral" },
  no_open_slots: { label: "No open slots (14 days)", tone: "gold" },
  falling_behind: { label: "Falling behind", tone: "coral" },
  spare_capacity: { label: "Spare capacity", tone: "green" },
};

const advisingLabel: Record<StaffCaseloadItem["advising"]["status"], string> = {
  completed: "Met",
  scheduled: "Booked",
  missed: "Missed",
  none: "Not yet",
};

export function MyDeskView({ heading }: { heading: React.ReactNode }) {
  const me = useApiResource(useCallback((signal: AbortSignal) => getStaffMe(signal), []), {
    refreshOnAmbient: false,
  });
  const caseload = useApiResource(
    useCallback((signal: AbortSignal) => getStaffCaseload(null, signal), []),
    { refreshOnAmbient: false },
  );
  const calendar = useApiResource(
    useCallback((signal: AbortSignal) => {
      // Seven days ahead for the week; forty-five days back so a past appointment that was never
      // closed out is still listed under "Needs an outcome" (the API allows a 62-day window).
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const from = new Date(today.getTime() - 45 * 86400000);
      const to = new Date(today.getTime() + 7 * 86400000);
      return getStaffAppointments({ from: from.toISOString(), to: to.toISOString() }, signal);
    }, []),
    { refreshOnAmbient: false },
  );
  const closeOut = useApiAction(
    async (appointment: StaffAppointment, status: "completed" | "no_show" | "cancelled") =>
      updateStaffAppointment(appointment.id, { status, expectedVersion: appointment.version }),
    (error) => (error instanceof ApiClientError ? error.message : "The appointment could not be updated."),
  );
  const [caseloadFilter, setCaseloadFilter] = useState<"all" | "not_met" | "open_work">("all");
  // Read once per visit: the calendar splits on the moment the desk was opened, not on every render.
  const [now] = useState(() => Date.now());

  const items = useMemo(() => {
    const list = caseload.data?.items ?? [];
    if (caseloadFilter === "not_met") return list.filter((item) => item.role === "primary_advisor" && item.advising.status !== "completed");
    if (caseloadFilter === "open_work") return list.filter((item) => item.work.open > 0);
    return list;
  }, [caseload.data, caseloadFilter]);

  if (me.status === "loading") {
    return (
      <>
        {heading}
        <p className="staff-empty">Loading your desk…</p>
      </>
    );
  }
  if (me.status === "error" || !me.data) {
    return (
      <>
        {heading}
        <p className="field-error" role="alert">
          {me.error ?? "Your staff identity could not be loaded."}
        </p>
      </>
    );
  }
  const desk: StaffMe = me.data;
  const { staff, availability } = desk;
  const timezone = staff.timezone;
  const gaps: Array<{ tone: string; text: string }> = [];
  if (staff.employmentStatus === "on_leave") gaps.push({ tone: "gold", text: `You are on leave${staff.leaveUntil ? ` until ${staff.leaveUntil}` : ""}: students cannot book you, and your ${desk.caseload.primaryAdvisees} advisees are not covered.` });
  if (desk.caseload.overCap) gaps.push({ tone: "coral", text: `Your caseload is over its cap: ${desk.caseload.primaryAdvisees} advisees against ${desk.caseload.cap}.` });
  if (staff.employmentStatus === "active" && staff.studentFacing && availability.bookable && availability.openSlotsNext14Days === 0) gaps.push({ tone: "coral", text: "You have no open appointment slot in the next two weeks; students who still need to see you cannot book." });
  if (staff.employmentStatus === "active" && staff.studentFacing && !availability.bookable) gaps.push({ tone: "gold", text: "You have no published availability, so students cannot book you." });
  if (desk.work.staleInProgress >= 3) gaps.push({ tone: "coral", text: `${desk.work.staleInProgress} items have been in progress for more than 10 days.` });
  if (desk.work.appointmentsAwaitingOutcome >= 3) gaps.push({ tone: "gold", text: `${desk.work.appointmentsAwaitingOutcome} past appointments have not been closed out (completed or no-show).` });

  const awaiting = (calendar.data?.items ?? []).filter((item) => item.status === "scheduled" && new Date(item.startsAt).getTime() < now).reverse();
  const upcoming = (calendar.data?.items ?? []).filter((item) => item.status === "scheduled" && new Date(item.startsAt).getTime() >= now);

  return (
    <>
      {heading}

      <section className="staff-panel staff-desk-identity" aria-label="Who you are">
        <div className="staff-desk-identity__person">
          <span className="staff-desk-identity__avatar" aria-hidden="true">
            {staff.name.split(" ").map((part) => part.slice(0, 1)).join("").slice(0, 2)}
          </span>
          <div>
            <h2>{staff.name}</h2>
            <p>
              {staff.title ?? staff.roleCode} · {staff.component}
              {staff.officeLocation ? ` · ${staff.officeLocation}` : ""}
            </p>
            <p className="staff-desk-identity__meta">
              {staff.employmentStatus === "active" ? "Active" : staff.employmentStatus === "on_leave" ? `On leave${staff.leaveUntil ? ` until ${staff.leaveUntil}` : ""}` : "Departed"}
              {staff.employmentType === "part_time" ? " · part-time" : ""}
              {staff.startedAt ? ` · since ${staff.startedAt}` : ""}
              {desk.manager ? ` · reports to ${desk.manager.name} (${desk.manager.title ?? desk.manager.component})` : ""}
              {staff.externalRef ? ` · ${staff.externalRef}` : ""}
            </p>
          </div>
        </div>
        {gaps.length > 0 ? (
          <ul className="staff-desk-gaps">
            {gaps.map((gap) => (
              <li key={gap.text} className={`staff-desk-gap staff-desk-gap--${gap.tone}`}>
                {gap.text}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="staff-metric-grid" aria-label="Your numbers">
        <article className={`staff-metric-card staff-metric-card--${desk.caseload.overCap ? "coral" : "navy"}`}>
          <span>Caseload</span>
          <strong>
            {desk.caseload.primaryAdvisees}
            {desk.caseload.cap ? <small> / {desk.caseload.cap}</small> : null}
          </strong>
          <small>
            {desk.caseload.utilization != null ? `${Math.round(desk.caseload.utilization * 100)}% of cap` : "primary advisees"}
            {Object.entries(desk.caseload.byRole)
              .filter(([role, count]) => role !== "primary_advisor" && count > 0)
              .map(([role, count]) => ` · ${count} as ${roleLabel[role]?.toLowerCase() ?? role}`)
              .join("")}
          </small>
        </article>
        <article className={`staff-metric-card staff-metric-card--${desk.work.overdue > 0 ? "coral" : "navy"}`}>
          <span>Open work</span>
          <strong>{desk.work.open}</strong>
          <small>
            {desk.work.overdue} overdue · {desk.work.escalated ?? 0} escalated · {desk.work.staleInProgress} stale
          </small>
        </article>
        <article className={`staff-metric-card staff-metric-card--${availability.openSlotsNext14Days === 0 && staff.studentFacing ? "coral" : "green"}`}>
          <span>Open slots · 14 days</span>
          <strong>{availability.openSlotsNext14Days}</strong>
          <small>
            {availability.nextOpenSlotAt ? `next ${when(availability.nextOpenSlotAt, timezone)}` : availability.reason ? availability.reason.replace(/_/g, " ") : "none open"}
            {` · ${availability.bookedNext14Days} booked`}
          </small>
        </article>
        <article className={`staff-metric-card staff-metric-card--${desk.work.appointmentsAwaitingOutcome > 0 ? "gold" : "navy"}`}>
          <span>Awaiting outcome</span>
          <strong>{desk.work.appointmentsAwaitingOutcome}</strong>
          <small>past appointments not closed out · {desk.work.completedLast7Days ?? 0} items done this week</small>
        </article>
      </section>

      <div className="staff-dashboard-grid">
        <section className="staff-panel" aria-labelledby="desk-calendar">
          <header className="staff-panel__heading">
            <div>
              <p className="eyebrow">Calendar · {timezone}</p>
              <h2 id="desk-calendar">This week</h2>
            </div>
            <span>
              {calendar.data ? `${calendar.data.counts.scheduled} scheduled · ${calendar.data.counts.completed} completed · ${calendar.data.counts.noShow} no-show` : ""}
            </span>
          </header>
          {closeOut.message ? (
            <p className="field-error" role="alert">
              {closeOut.message}
            </p>
          ) : null}
          {awaiting.length > 0 ? (
            <div className="staff-desk-section">
              <h3>Needs an outcome</h3>
              <ul className="staff-desk-appointments">
                {awaiting.map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    timezone={timezone}
                    now={now}
                    busy={closeOut.status === "loading"}
                    onClose={(status) => closeOut.run(appointment, status).then(() => calendar.refresh())}
                  />
                ))}
              </ul>
            </div>
          ) : null}
          <div className="staff-desk-section">
            <h3>Upcoming</h3>
            {upcoming.length === 0 ? (
              <p className="staff-empty">Nothing scheduled in the next seven days.</p>
            ) : (
              <ul className="staff-desk-appointments">
                {upcoming.map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    timezone={timezone}
                    now={now}
                    busy={closeOut.status === "loading"}
                    onClose={(status) => closeOut.run(appointment, status).then(() => calendar.refresh())}
                  />
                ))}
              </ul>
            )}
          </div>
          {availability.weekly && availability.weekly.length > 0 ? (
            <div className="staff-desk-section">
              <h3>Weekly hours</h3>
              <ul className="staff-desk-hours">
                {availability.weekly.map((rule, index) => (
                  <li key={index}>
                    <strong>{WEEKDAYS[rule.weekday]}</strong> {minuteLabel(rule.startMinute)}–{minuteLabel(rule.endMinute)}
                    <small>
                      {" "}
                      · {rule.slotMinutes} min · {rule.modality.replace("_", " ")}
                      {rule.location ? ` · ${rule.location}` : ""}
                    </small>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="staff-desk-section">
              <h3>Weekly hours</h3>
              <p className="staff-empty">No published availability.</p>
            </div>
          )}
          {availability.timeOff && availability.timeOff.length > 0 ? (
            <div className="staff-desk-section">
              <h3>Time off and blocks</h3>
              <ul className="staff-desk-hours">
                {availability.timeOff.map((entry) => (
                  <li key={entry.id} className={entry.current ? "is-current" : undefined}>
                    <strong>{entry.kind.replace("_", " ")}</strong> {dateOnly(entry.startsAt)} → {dateOnly(entry.endsAt)}
                    <small>
                      {entry.note ? ` · ${entry.note}` : ""}
                      {entry.current ? " · now" : ""}
                      {!entry.blocksBookings ? " · does not block bookings" : ""}
                    </small>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="staff-panel" aria-labelledby="desk-caseload">
          <header className="staff-panel__heading">
            <div>
              <p className="eyebrow">Students assigned to you</p>
              <h2 id="desk-caseload">My caseload</h2>
            </div>
            <div className="staff-desk-filters" role="tablist" aria-label="Filter caseload">
              {(
                [
                  ["all", `All (${caseload.data?.total ?? 0})`],
                  ["not_met", `Advising not met (${caseload.data?.summary.advising.none ?? 0} + ${caseload.data?.summary.advising.scheduled ?? 0} booked)`],
                  ["open_work", `With open work (${caseload.data?.summary.withOpenWork ?? 0})`],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={caseloadFilter === id} className={caseloadFilter === id ? "is-active" : undefined} onClick={() => setCaseloadFilter(id)}>
                  {label}
                </button>
              ))}
            </div>
          </header>
          {caseload.status === "loading" ? (
            <p className="staff-empty">Loading your students…</p>
          ) : items.length === 0 ? (
            <p className="staff-empty">No students are assigned to you{caseloadFilter !== "all" ? " under this filter" : ""}.</p>
          ) : (
            <div className="staff-table-wrap">
              <table className="staff-table staff-desk-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Relationship</th>
                    <th>Program</th>
                    <th>Checklist</th>
                    <th>Advising</th>
                    <th>Next appointment</th>
                    <th>Open work</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={`${item.role}:${item.student.id}`}>
                      <td>
                        <strong>{item.student.name}</strong>
                        <small>{item.student.externalRef ?? item.student.id.slice(0, 8)}</small>
                      </td>
                      <td>
                        {roleLabel[item.role] ?? item.role}
                        <small>since {dateOnly(item.assignedAt)}{item.source !== "manual" ? ` · ${item.source.replace(/_/g, " ")}` : ""}</small>
                      </td>
                      <td>{item.student.programName}</td>
                      <td>
                        {item.requirements.completed}/{item.requirements.total}
                        {item.offerStatus ? <small>{item.offerStatus.replace(/_/g, " ")}</small> : null}
                      </td>
                      <td>
                        <span className={`staff-desk-badge staff-desk-badge--${item.advising.status}`}>{advisingLabel[item.advising.status]}</span>
                        {item.advising.lastCompletedAt ? <small>{dateOnly(item.advising.lastCompletedAt)}</small> : null}
                      </td>
                      <td>{item.advising.nextAppointmentAt ? when(item.advising.nextAppointmentAt, timezone) : "—"}</td>
                      <td>
                        {item.work.open}
                        {item.work.overdue > 0 ? <small className="is-overdue">{item.work.overdue} overdue</small> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {desk.team.length > 0 ? (
        <section className="staff-panel" aria-labelledby="desk-team">
          <header className="staff-panel__heading">
            <div>
              <p className="eyebrow">{desk.componentSummary?.component ?? staff.component}</p>
              <h2 id="desk-team">My team</h2>
            </div>
            {desk.componentSummary ? (
              <span>
                {desk.componentSummary.members} people ({desk.componentSummary.directReports} direct) · {desk.componentSummary.primaryAdvisees}
                {desk.componentSummary.caseloadCap ? `/${desk.componentSummary.caseloadCap}` : ""} advisees
              </span>
            ) : null}
          </header>
          {desk.componentSummary ? (
            <ul className="staff-desk-gaps">
              {desk.componentSummary.studentsWithDepartedAdviser > 0 ? (
                <li className="staff-desk-gap staff-desk-gap--coral">
                  {desk.componentSummary.studentsWithDepartedAdviser} students are still assigned to an adviser who has left.
                </li>
              ) : null}
              {desk.componentSummary.studentsWithAdviserOnLeave > 0 ? (
                <li className="staff-desk-gap staff-desk-gap--gold">
                  {desk.componentSummary.studentsWithAdviserOnLeave} students have an adviser on leave with no cover.
                </li>
              ) : null}
              {desk.componentSummary.acceptedStudentsWithoutPrimaryAdviser > 0 ? (
                <li className="staff-desk-gap staff-desk-gap--gold">
                  {desk.componentSummary.acceptedStudentsWithoutPrimaryAdviser} accepted students have no academic adviser at all.
                </li>
              ) : null}
              {desk.componentSummary.membersOverCap > 0 ? (
                <li className="staff-desk-gap staff-desk-gap--coral">
                  {desk.componentSummary.membersOverCap} advisers are over their caseload cap.
                </li>
              ) : null}
              {desk.componentSummary.unassignedComponentItems > 0 ? (
                <li className="staff-desk-gap staff-desk-gap--gold">
                  {desk.componentSummary.unassignedComponentItems} open {desk.componentSummary.component} items have no owner; {desk.componentSummary.overdueComponentItems} are overdue.
                </li>
              ) : null}
            </ul>
          ) : null}
          <div className="staff-table-wrap">
            <table className="staff-table staff-desk-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Status</th>
                  <th>Caseload</th>
                  <th>Open work</th>
                  <th>Next open slot</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {desk.team.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <strong>{member.name}</strong>
                      <small>
                        {member.title ?? member.roleCode}
                        {member.level > 1 ? ` · via ${desk.team.find((entry) => entry.id === member.reportsTo)?.name ?? "a report"}` : ""}
                      </small>
                    </td>
                    <td>
                      {member.employmentStatus === "active" ? "Active" : member.employmentStatus === "on_leave" ? `On leave${member.leaveUntil ? ` until ${member.leaveUntil}` : ""}` : `Departed${member.endedAt ? ` ${member.endedAt}` : ""}`}
                    </td>
                    <td>
                      {member.caseload.primaryAdvisees}
                      {member.caseload.cap ? ` / ${member.caseload.cap}` : ""}
                      {member.caseload.utilization != null ? <small>{Math.round(member.caseload.utilization * 100)}%</small> : null}
                    </td>
                    <td>
                      {member.work.open}
                      <small>
                        {member.work.overdue} overdue · {member.work.staleInProgress} stale · {member.work.appointmentsAwaitingOutcome} unclosed appts
                      </small>
                    </td>
                    <td>
                      {member.availability.nextOpenSlotAt ? when(member.availability.nextOpenSlotAt, timezone) : member.availability.reason ? member.availability.reason.replace(/_/g, " ") : "none in 14 days"}
                      <small>{member.availability.openSlotsNext14Days} open · {member.availability.bookedNext14Days} booked</small>
                    </td>
                    <td>
                      {member.flags.length === 0 ? (
                        <span className="staff-desk-badge staff-desk-badge--ok">OK</span>
                      ) : (
                        member.flags.map((flag) => (
                          <span key={flag} className={`staff-desk-badge staff-desk-badge--${flagCopy[flag].tone}`}>
                            {flagCopy[flag].label}
                          </span>
                        ))
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}

function AppointmentRow({
  appointment,
  timezone,
  now,
  busy,
  onClose,
}: {
  appointment: StaffAppointment;
  timezone: string;
  now: number;
  busy: boolean;
  onClose: (status: "completed" | "no_show" | "cancelled") => void;
}) {
  const past = new Date(appointment.startsAt).getTime() < now;
  return (
    <li className={`staff-desk-appointment staff-desk-appointment--${appointment.status}`}>
      <div>
        <strong>
          {when(appointment.startsAt, timezone)}
          {appointment.endsAt ? `–${when(appointment.endsAt, timezone, false)}` : ""}
        </strong>
        <span>
          {appointment.student.name}
          {appointment.student.externalRef ? ` (${appointment.student.externalRef})` : ""} · {appointment.type.replace(/_/g, " ")}
          {appointment.modality ? ` · ${appointment.modality.replace("_", " ")}` : ""}
          {appointment.location ? ` · ${appointment.location}` : ""}
        </span>
        {appointment.notes ? <small>“{appointment.notes}”</small> : null}
      </div>
      {appointment.status === "scheduled" ? (
        <div className="staff-desk-appointment__actions">
          {past ? (
            <>
              <button type="button" disabled={busy} onClick={() => onClose("completed")}>
                Completed
              </button>
              <button type="button" disabled={busy} onClick={() => onClose("no_show")}>
                No-show
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => onClose("cancelled")}>
              Cancel
            </button>
          )}
        </div>
      ) : (
        <span className={`staff-desk-badge staff-desk-badge--${appointment.status}`}>{appointment.status.replace("_", " ")}</span>
      )}
    </li>
  );
}
