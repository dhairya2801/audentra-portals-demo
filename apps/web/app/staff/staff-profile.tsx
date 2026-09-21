"use client";

import type {
  StaffActionCenterQuery,
  StaffAppointment,
  StaffAssignmentRole,
  StaffCaseloadItem,
  StaffMe,
  StaffTeamMember,
} from "@vv/contracts";
import { useCallback, useMemo, useState } from "react";
import Icon from "../design-system/Icon.jsx";
import Avatar from "../design-system/primitives/Avatar.jsx";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  ApiClientError,
  getStaffAppointments,
  getStaffCaseload,
  getStaffMe,
  updateStaffAppointment,
} from "../lib/api-client";
import {
  ADVISING_LABEL,
  APPOINTMENT_TYPE_LABEL,
  CASELOAD_FILTERS,
  MODALITY_LABEL,
  ROLE_LABEL,
  TEAM_FLAG_COPY,
  type CaseloadFilter,
  type CaseloadSort,
  appointmentWindow,
  caseloadByRole,
  caseloadMeter,
  caseloadRows,
  clockIn,
  closeOutFailure,
  dateIn,
  identityRows,
  initialsOf,
  partitionAppointments,
  profileGaps,
  responsibilities,
  weeklySchedule,
  whenIn,
  workRows,
  zoneAbbreviation,
} from "./staff-profile-logic";

/**
 * The staff member's own profile — who they are in the organisation, their
 * numbers, their calendar, the students that are theirs and, for a manager,
 * the team. Every value is read from /v1/staff/me, /v1/staff/caseload and
 * /v1/staff/appointments and rendered in the member's own time zone; a field
 * the platform has no value for stays blank.
 */
export function StaffProfileView({
  heading,
  openTaskBoard,
  openStudent,
  onSignOut,
}: {
  heading: React.ReactNode;
  openTaskBoard: (query: StaffActionCenterQuery) => void;
  openStudent: (studentId: string) => void;
  onSignOut: () => void;
}) {
  const me = useApiResource(useCallback((signal: AbortSignal) => getStaffMe(signal), []), {
    refreshOnAmbient: false,
  });
  const caseload = useApiResource(
    useCallback((signal: AbortSignal) => getStaffCaseload(null, signal), []),
    { refreshOnAmbient: false },
  );
  // The calendar splits on the moment the page opened, not on every render.
  const [now] = useState(() => Date.now());
  const calendar = useApiResource(
    useCallback((signal: AbortSignal) => getStaffAppointments(appointmentWindow(now), signal), [now]),
    { refreshOnAmbient: false },
  );

  if (me.status === "loading") {
    return (
      <>
        {heading}
        <section className="section-card staff-profile-state" aria-live="polite">
          <span className="loader" aria-hidden="true" />
          <p>Loading your profile…</p>
        </section>
      </>
    );
  }
  if (me.status === "error" || !me.data) {
    return (
      <>
        {heading}
        <section className="section-card staff-profile-state" role="alert">
          <h2>Your profile could not load</h2>
          <p>{me.error ?? "Your staff identity could not be read."}</p>
          <button className="button button--primary" type="button" onClick={me.reload}>
            Try again
          </button>
        </section>
      </>
    );
  }

  const data = me.data;
  const timeZone = data.staff.timezone;
  const gaps = profileGaps(data);
  const refreshAll = () => {
    me.refresh();
    calendar.refresh();
  };

  return (
    <div className="staff-profile">
      <header className="page-hero staff-profile-hero">
        <div className="hero-copy">
          <p className="eyebrow">
            Staff profile · {data.staff.component}
            {data.staff.externalRef ? ` · ${data.staff.externalRef}` : ""}
          </p>
          <h1>{data.staff.name}</h1>
          <p className="hero-lede">
            {[data.staff.title, data.staff.officeLocation].filter(Boolean).join(" · ") || data.staff.email}
          </p>
        </div>
        <div className="hero-figure">
          <Avatar person={{ name: data.staff.name, initials: initialsOf(data.staff.name) }} size="xl" alone />
        </div>
      </header>

      <div className="staff-profile-layout">
        <div className="staff-profile-main">
          <IdentityCard me={data} gaps={gaps} />
          <NumbersCard me={data} openTaskBoard={openTaskBoard} />
          <CalendarCard
            me={data}
            calendar={calendar.data}
            calendarError={calendar.status === "error" ? calendar.error : null}
            loading={calendar.status === "loading"}
            now={now}
            onChanged={refreshAll}
            onRetry={calendar.reload}
          />
          <CaseloadCard
            items={caseload.data?.items ?? null}
            summary={caseload.data?.summary ?? null}
            total={caseload.data?.total ?? 0}
            loading={caseload.status === "loading"}
            error={caseload.status === "error" ? caseload.error : null}
            timeZone={timeZone}
            onRetry={caseload.reload}
            openStudent={openStudent}
          />
          {data.team.length > 0 ? <TeamCard me={data} /> : null}
        </div>
        <aside className="staff-profile-rail" aria-label="Profile summary">
          <ResponsibilitiesCard me={data} />
          <div className="session-card">
            <span className="session-icon" aria-hidden="true">
              <Icon name="clock" size={19} />
            </span>
            <span className="panel-label">Your time zone</span>
            <p>
              Every time on this page is shown in <strong>{timeZone}</strong> ({zoneAbbreviation(timeZone, now)}),
              the zone on your staff record.
            </p>
            <p className="session-meta">Generated {whenIn(data.generatedAt, timeZone)}</p>
          </div>
          <div className="session-card">
            <span className="session-icon" aria-hidden="true">
              <Icon name="signout" size={19} />
            </span>
            <span className="panel-label">Ending your session</span>
            <p>On a shared computer, closing the tab does not sign you out of the staff workspace.</p>
            <button className="secondary-button" type="button" onClick={onSignOut}>
              <Icon name="signout" size={16} /> Sign out
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- sections */

function SectionHead({
  id,
  icon,
  title,
  lede,
  aside,
}: {
  id: string;
  icon: string;
  title: string;
  lede: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="status-heading">
      <span className="status-icon record">
        <Icon name={icon} size={18} />
      </span>
      <div>
        <h2 id={id}>{title}</h2>
        <p>{lede}</p>
      </div>
      {aside}
    </div>
  );
}

function IdentityCard({ me, gaps }: { me: StaffMe; gaps: ReturnType<typeof profileGaps> }) {
  return (
    <section className="section-card" aria-labelledby="staff-profile-identity">
      <SectionHead
        id="staff-profile-identity"
        icon="profile"
        title="Who you are"
        lede="Your record as the institution holds it. Changes to these fields are made by your department, not here."
      />
      {gaps.length > 0 ? (
        <ul className="staff-profile-gaps">
          {gaps.map((gap) => (
            <li className={`staff-profile-gap ${gap.tone}`} key={gap.text}>
              <Icon name="alert" size={15} />
              <span>{gap.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="card-rows field-rows">
        {identityRows(me).map((row) => (
          <div className="field-row owned" key={row.id}>
            <div className="field-head">
              <span className="field-row-label">
                <Icon name="lock" size={11} />
                {row.label}
              </span>
            </div>
            <div className="field-body">
              <p className={`field-value${row.value ? "" : " blank"}${row.mono ? " mono" : ""}`}>
                {row.value ?? row.blank ?? "Not on record"}
              </p>
              {row.note ? <p className="field-note">{row.note}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function NumbersCard({
  me,
  openTaskBoard,
}: {
  me: StaffMe;
  openTaskBoard: (query: StaffActionCenterQuery) => void;
}) {
  const meter = caseloadMeter(me);
  const byRole = caseloadByRole(me);
  const rows = workRows(me.work);
  return (
    <section className="section-card" aria-labelledby="staff-profile-numbers">
      <SectionHead
        id="staff-profile-numbers"
        icon="chart"
        title="Your numbers"
        lede="Counted from canonical records at the moment this page loaded. Each work line opens the task board filtered to you."
      />
      <div className="staff-profile-meter">
        <div className="staff-profile-meter__figure">
          <strong>
            {meter.primaryAdvisees}
            {meter.cap != null ? <small> / {meter.cap}</small> : null}
          </strong>
          <span>Primary advisees{meter.cap != null ? " against your cap" : ""}</span>
        </div>
        {meter.percent != null ? (
          <div
            className={`staff-profile-meter__bar${meter.overCap ? " over" : ""}`}
            role="meter"
            aria-label="Caseload utilization"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={meter.percent}
            aria-valuetext={`${meter.utilizationPercent}% of cap`}
          >
            <span style={{ width: `${meter.percent}%` }} />
          </div>
        ) : (
          <p className="field-note">No caseload cap is set for you, so utilization is not measured.</p>
        )}
        {meter.utilizationPercent != null ? (
          <p className={`field-note${meter.overCap ? " pending" : ""}`}>
            {meter.utilizationPercent}% of cap{meter.overCap ? " — over capacity" : ""}
          </p>
        ) : null}
      </div>
      {byRole.length > 0 ? (
        <ul className="staff-profile-chips" aria-label="Caseload by role">
          {byRole.map((entry) => (
            <li key={entry.role}>
              <strong>{entry.count}</strong> {entry.label.toLowerCase()}
            </li>
          ))}
        </ul>
      ) : (
        <p className="field-note">No students are assigned to you in any role.</p>
      )}
      <dl className="staff-profile-work">
        {rows.map((row) => (
          <div className={`staff-profile-work__row ${row.tone}`} key={row.id}>
            <dt>{row.label}</dt>
            <dd>
              <strong>{row.value}</strong>
              {row.query ? (
                <button type="button" className="link-button" onClick={() => openTaskBoard(row.query!)}>
                  Open on the board <Icon name="arrow" size={13} />
                </button>
              ) : (
                <a className="link-button" href="#staff-profile-calendar">
                  See the calendar <Icon name="arrow" size={13} />
                </a>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AvailabilityReason({ me }: { me: StaffMe }) {
  const { availability, staff } = me;
  if (availability.bookable) {
    return (
      <span className="staff-profile-pill green">
        <Icon name="check" size={12} /> Bookable
      </span>
    );
  }
  const reason: Record<NonNullable<typeof availability.reason>, string> = {
    departed: "Not bookable · departed",
    on_leave: `Not bookable · on leave${staff.leaveUntil ? ` until ${dateIn(staff.leaveUntil, staff.timezone)}` : ""}`,
    no_availability: "Not bookable · no published hours",
    does_not_offer_type: "Not bookable · no appointment types offered",
  };
  return (
    <span className="staff-profile-pill amber">
      <Icon name="alert" size={12} /> {availability.reason ? reason[availability.reason] : "Not bookable"}
    </span>
  );
}

function CalendarCard({
  me,
  calendar,
  calendarError,
  loading,
  now,
  onChanged,
  onRetry,
}: {
  me: StaffMe;
  calendar: { items: StaffAppointment[]; counts: { scheduled: number; completed: number; noShow: number; cancelled: number } } | null;
  calendarError: string | null;
  loading: boolean;
  now: number;
  onChanged: () => void;
  onRetry: () => void;
}) {
  const timeZone = me.staff.timezone;
  const { availability } = me;
  const schedule = weeklySchedule(availability.weekly);
  const buckets = useMemo(() => partitionAppointments(calendar?.items ?? [], now), [calendar, now]);
  const closeOut = useApiAction(
    async (appointment: StaffAppointment, status: "completed" | "no_show") =>
      updateStaffAppointment(appointment.id, { status, expectedVersion: appointment.version }),
    (error) =>
      error instanceof ApiClientError
        ? closeOutFailure(error.status, error.code, error.message)
        : closeOutFailure(null, null, ""),
  );
  const [closing, setClosing] = useState<string | null>(null);

  const close = async (appointment: StaffAppointment, status: "completed" | "no_show") => {
    setClosing(appointment.id);
    try {
      await closeOut.run(appointment, status);
      onChanged();
    } catch {
      // The message is on screen; the record is unchanged.
    } finally {
      setClosing(null);
    }
  };

  return (
    <section
      className="section-card"
      id="staff-profile-calendar"
      aria-labelledby="staff-profile-calendar-title"
    >
      <SectionHead
        id="staff-profile-calendar-title"
        icon="calendar"
        title="Availability & calendar"
        lede={`Your published hours and the next two weeks, in ${timeZone}.`}
        aside={<AvailabilityReason me={me} />}
      />

      <dl className="staff-profile-facts">
        <div>
          <dt>Next open slot</dt>
          <dd>{whenIn(availability.nextOpenSlotAt, timeZone) ?? "None in the next 14 days"}</dd>
        </div>
        <div>
          <dt>Open slots · 14 days</dt>
          <dd>{availability.openSlotsNext14Days}</dd>
        </div>
        <div>
          <dt>Booked · 14 days</dt>
          <dd>{availability.bookedNext14Days}</dd>
        </div>
        <div>
          <dt>Awaiting outcome</dt>
          <dd>{me.work.appointmentsAwaitingOutcome}</dd>
        </div>
      </dl>

      <h3 className="staff-profile-subhead">Weekly hours</h3>
      {schedule.length === 0 ? (
        <p className="field-note">No weekly availability is published for you.</p>
      ) : (
        <div className="staff-profile-table-wrap">
          <table className="staff-profile-table">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Hours ({zoneAbbreviation(timeZone, now)})</th>
                <th scope="col">Slot</th>
                <th scope="col">Modality</th>
                <th scope="col">Location</th>
                <th scope="col">Types</th>
              </tr>
            </thead>
            <tbody>
              {schedule.flatMap((day) =>
                day.windows.map((window, index) => (
                  <tr key={`${day.weekday}-${index}`}>
                    <th scope="row">{index === 0 ? day.label : ""}</th>
                    <td>
                      {window.start} – {window.end}
                    </td>
                    <td>{window.slotMinutes} min</td>
                    <td>{window.modality}</td>
                    <td>{window.location ?? "—"}</td>
                    <td>{window.appointmentTypes.join(", ") || "—"}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}

      {availability.timeOff && availability.timeOff.length > 0 ? (
        <>
          <h3 className="staff-profile-subhead">Time off and blocks</h3>
          <ul className="staff-profile-list">
            {availability.timeOff.map((entry) => (
              <li key={entry.id} className={entry.current ? "current" : undefined}>
                <strong>{entry.kind.replaceAll("_", " ")}</strong>
                <span>
                  {dateIn(entry.startsAt, timeZone)} → {dateIn(entry.endsAt, timeZone)}
                  {entry.current ? " · now" : ""}
                  {!entry.blocksBookings ? " · does not block bookings" : ""}
                </span>
                {entry.note ? <small>{entry.note}</small> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h3 className="staff-profile-subhead">Today</h3>
      {me.appointmentsToday.length === 0 ? (
        <p className="field-note">Nothing on your calendar today.</p>
      ) : (
        <ul className="staff-profile-appointments">
          {me.appointmentsToday.map((appointment) => (
            <AppointmentRow key={appointment.id} appointment={appointment} timeZone={timeZone} />
          ))}
        </ul>
      )}

      {calendarError ? (
        <p className="field-error" role="alert">
          {calendarError}{" "}
          <button type="button" className="link-button" onClick={onRetry}>
            Try again
          </button>
        </p>
      ) : null}
      {closeOut.message ? (
        <p className="field-error" role="alert">
          {closeOut.message}
        </p>
      ) : null}

      {buckets.awaitingOutcome.length > 0 ? (
        <>
          <h3 className="staff-profile-subhead">Needs an outcome</h3>
          <p className="field-note">
            These were scheduled and the time has passed. Record what happened so the student’s advising status is true.
          </p>
          <ul className="staff-profile-appointments">
            {buckets.awaitingOutcome.map((appointment) => (
              <AppointmentRow
                key={appointment.id}
                appointment={appointment}
                timeZone={timeZone}
                actions={
                  appointment.staff?.id === me.staff.id ? (
                    <>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={closing !== null}
                        onClick={() => void close(appointment, "completed")}
                      >
                        {closing === appointment.id ? "Saving…" : "Completed"}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={closing !== null}
                        onClick={() => void close(appointment, "no_show")}
                      >
                        No-show
                      </button>
                    </>
                  ) : (
                    <small>On another calendar</small>
                  )
                }
              />
            ))}
          </ul>
        </>
      ) : null}

      <h3 className="staff-profile-subhead">Upcoming · next 14 days</h3>
      {loading && !calendar ? (
        <p className="field-note">Loading your calendar…</p>
      ) : buckets.upcoming.length === 0 ? (
        <p className="field-note">Nothing scheduled in the next two weeks.</p>
      ) : (
        <ul className="staff-profile-appointments">
          {buckets.upcoming.map((appointment) => (
            <AppointmentRow key={appointment.id} appointment={appointment} timeZone={timeZone} />
          ))}
        </ul>
      )}
      {calendar ? (
        <p className="field-note">
          In this window: {calendar.counts.scheduled} scheduled · {calendar.counts.completed} completed ·{" "}
          {calendar.counts.noShow} no-show · {calendar.counts.cancelled} cancelled.
        </p>
      ) : null}
    </section>
  );
}

function AppointmentRow({
  appointment,
  timeZone,
  actions,
}: {
  appointment: StaffAppointment;
  timeZone: string;
  actions?: React.ReactNode;
}) {
  const modality = appointment.modality ? MODALITY_LABEL[appointment.modality] : null;
  return (
    <li className={`staff-profile-appointment ${appointment.status}`}>
      <time dateTime={appointment.startsAt}>
        <strong>{clockIn(appointment.startsAt, timeZone)}</strong>
        <small>{dateIn(appointment.startsAt, timeZone)}</small>
      </time>
      <div>
        <strong>{appointment.student.name}</strong>
        <span>
          {APPOINTMENT_TYPE_LABEL[appointment.type] ?? appointment.type}
          {modality ? ` · ${modality}` : ""}
          {appointment.location ? ` · ${appointment.location}` : ""}
        </span>
        {appointment.notes ? <small>{appointment.notes}</small> : null}
      </div>
      <div className="staff-profile-appointment__actions">
        {actions ?? (
          <span className={`staff-profile-pill ${appointment.status === "scheduled" ? "green" : "quiet"}`}>
            {appointment.status.replaceAll("_", " ")}
          </span>
        )}
      </div>
    </li>
  );
}

const CASELOAD_PAGE = 40;

function CaseloadCard({
  items,
  summary,
  total,
  loading,
  error,
  timeZone,
  onRetry,
  openStudent,
}: {
  items: StaffCaseloadItem[] | null;
  summary: {
    byRole: Partial<Record<StaffAssignmentRole, number>>;
    advising: { completed: number; scheduled: number; missed: number; none: number };
    withOpenWork: number;
    withOverdueWork: number;
  } | null;
  total: number;
  loading: boolean;
  error: string | null;
  timeZone: string;
  onRetry: () => void;
  openStudent: (studentId: string) => void;
}) {
  const [filter, setFilter] = useState<CaseloadFilter>("all");
  const [sort, setSort] = useState<CaseloadSort>("name");
  const [role, setRole] = useState<StaffAssignmentRole | "all">("all");
  const roles = useMemo(
    () => (Object.keys(summary?.byRole ?? {}) as StaffAssignmentRole[]).filter((key) => (summary?.byRole[key] ?? 0) > 0),
    [summary],
  );
  const rows = useMemo(() => (items ? caseloadRows(items, { filter, sort, role }) : []), [items, filter, sort, role]);
  // A caseload can run to hundreds of students; the table grows on request so
  // the page stays readable, while the counts above always describe the whole.
  const [visible, setVisible] = useState(CASELOAD_PAGE);
  const shown = rows.slice(0, visible);

  return (
    <section className="section-card" aria-labelledby="staff-profile-caseload">
      <SectionHead
        id="staff-profile-caseload"
        icon="users"
        title="My caseload"
        lede={
          summary
            ? `${total} ${total === 1 ? "student is" : "students are"} assigned to you · ${summary.withOpenWork} with open work · ${summary.withOverdueWork} with overdue work · advising met for ${summary.advising.completed}, booked for ${summary.advising.scheduled}, missed by ${summary.advising.missed}, not yet for ${summary.advising.none}.`
            : "The students assigned to you, with their progress and open work."
        }
      />
      {error ? (
        <p className="field-error" role="alert">
          {error}{" "}
          <button type="button" className="link-button" onClick={onRetry}>
            Try again
          </button>
        </p>
      ) : null}
      <div className="staff-profile-controls">
        <div role="group" aria-label="Filter caseload" className="staff-profile-segments">
          {CASELOAD_FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={filter === option.id}
              className={filter === option.id ? "is-active" : undefined}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {roles.length > 1 ? (
          <label>
            Role
            <select value={role} onChange={(event) => setRole(event.target.value as StaffAssignmentRole | "all")}>
              <option value="all">All roles</option>
              {roles.map((key) => (
                <option value={key} key={key}>
                  {ROLE_LABEL[key]} ({summary?.byRole[key] ?? 0})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as CaseloadSort)}>
            <option value="name">Name</option>
            <option value="progress">Least progress first</option>
            <option value="open_work">Most open work first</option>
            <option value="next_appointment">Next appointment</option>
          </select>
        </label>
      </div>
      {loading && !items ? (
        <p className="field-note">Loading your students…</p>
      ) : rows.length === 0 ? (
        <p className="field-note">
          {items && items.length > 0 ? "No students match this filter." : "No students are assigned to you."}
        </p>
      ) : (
        <div className="staff-profile-table-wrap">
          <table className="staff-profile-table staff-desk-table">
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Program</th>
                <th scope="col">Relationship</th>
                <th scope="col">Requirements</th>
                <th scope="col">Advising</th>
                <th scope="col">Next appointment</th>
                <th scope="col">Open work</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => (
                <tr key={`${item.role}:${item.student.id}`}>
                  <td>
                    <button type="button" className="staff-profile-student" onClick={() => openStudent(item.student.id)}>
                      <strong>{item.student.name}</strong>
                      <small>{item.student.externalRef ?? item.student.id.slice(0, 8)}</small>
                    </button>
                  </td>
                  <td>
                    {item.student.programName}
                    {item.student.classYear ? <small>Class of {item.student.classYear}</small> : null}
                  </td>
                  <td>
                    {ROLE_LABEL[item.role] ?? item.role}
                    <small>since {dateIn(item.assignedAt, timeZone)}</small>
                  </td>
                  <td>
                    {item.requirements.completed}/{item.requirements.total}
                    {item.requirements.percent != null ? <small>{item.requirements.percent}%</small> : null}
                    {item.journeyStatus ? <small>{item.journeyStatus.replaceAll("_", " ")}</small> : null}
                  </td>
                  <td>
                    <span className={`staff-profile-pill ${item.advising.status === "completed" ? "green" : item.advising.status === "missed" ? "crimson" : item.advising.status === "scheduled" ? "blue" : "quiet"}`}>
                      {ADVISING_LABEL[item.advising.status]}
                    </span>
                    {item.advising.lastCompletedAt ? <small>{dateIn(item.advising.lastCompletedAt, timeZone)}</small> : null}
                  </td>
                  <td>{whenIn(item.advising.nextAppointmentAt, timeZone) ?? "—"}</td>
                  <td>
                    {item.work.open}
                    {item.work.overdue > 0 ? <small className="crimson">{item.work.overdue} overdue</small> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > shown.length ? (
            <p className="staff-profile-more">
              Showing {shown.length} of {rows.length}.{" "}
              <button type="button" className="link-button" onClick={() => setVisible((count) => count + CASELOAD_PAGE)}>
                Show {Math.min(CASELOAD_PAGE, rows.length - shown.length)} more
              </button>
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function TeamCard({ me }: { me: StaffMe }) {
  const summary = me.componentSummary;
  const notes: string[] = [];
  if (summary) {
    if (summary.studentsWithDepartedAdviser > 0) {
      notes.push(`${summary.studentsWithDepartedAdviser} students are still assigned to an adviser who has left.`);
    }
    if (summary.studentsWithAdviserOnLeave > 0) {
      notes.push(`${summary.studentsWithAdviserOnLeave} students have an adviser on leave with no cover.`);
    }
    if (summary.acceptedStudentsWithoutPrimaryAdviser > 0) {
      notes.push(`${summary.acceptedStudentsWithoutPrimaryAdviser} accepted students have no primary adviser.`);
    }
    if (summary.unassignedComponentItems > 0) {
      notes.push(`${summary.unassignedComponentItems} open items in ${summary.component} have no owner.`);
    }
    if (summary.overdueComponentItems > 0) {
      notes.push(`${summary.overdueComponentItems} open items in ${summary.component} are overdue.`);
    }
  }
  return (
    <section className="section-card" aria-labelledby="staff-profile-team">
      <SectionHead
        id="staff-profile-team"
        icon="users"
        title="My team"
        lede={
          summary
            ? `${summary.component} · ${summary.members} people (${summary.directReports ?? me.directReports.length} direct) · ${summary.primaryAdvisees}${summary.caseloadCap ? ` / ${summary.caseloadCap}` : ""} primary advisees · ${summary.membersOnLeave} on leave · ${summary.membersDeparted} departed · ${summary.membersOverCap} over cap.`
            : `${me.team.length} people report up to you.`
        }
      />
      {notes.length > 0 ? (
        <ul className="staff-profile-gaps">
          {notes.map((note) => (
            <li className="staff-profile-gap amber" key={note}>
              <Icon name="alert" size={15} />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="staff-profile-team">
        {me.team.map((member) => (
          <TeamRow key={member.id} member={member} timeZone={me.staff.timezone} />
        ))}
      </ul>
    </section>
  );
}

function TeamRow({ member, timeZone }: { member: StaffTeamMember; timeZone: string }) {
  return (
    <li className={member.level > 1 ? "indirect" : undefined}>
      <span className="avatar avatar-sm" aria-hidden="true">
        {initialsOf(member.name)}
      </span>
      <div>
        <strong>{member.name}</strong>
        <span>
          {[member.title, member.component].filter(Boolean).join(" · ")}
          {member.level > 1 ? " · indirect report" : ""}
        </span>
        {member.flags.length > 0 ? (
          <ul className="staff-profile-flags">
            {member.flags.map((flag) => (
              <li className={`staff-profile-pill ${TEAM_FLAG_COPY[flag].tone}`} key={flag}>
                {TEAM_FLAG_COPY[flag].label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <dl>
        <div>
          <dt>Caseload</dt>
          <dd>
            {member.caseload.primaryAdvisees}
            {member.caseload.cap != null ? ` / ${member.caseload.cap}` : ""}
          </dd>
        </div>
        <div>
          <dt>Open</dt>
          <dd>{member.work.open}</dd>
        </div>
        <div>
          <dt>Overdue</dt>
          <dd>{member.work.overdue}</dd>
        </div>
        <div>
          <dt>Stale</dt>
          <dd>{member.work.staleInProgress}</dd>
        </div>
        <div>
          <dt>Next slot</dt>
          <dd>{whenIn(member.availability.nextOpenSlotAt, timeZone) ?? "None"}</dd>
        </div>
      </dl>
    </li>
  );
}

function ResponsibilitiesCard({ me }: { me: StaffMe }) {
  const lines = responsibilities(me);
  return (
    <div className="offices-card">
      <span className="panel-label">Responsibilities</span>
      {lines.length === 0 ? (
        <p className="field-note">Your record does not describe any responsibilities yet.</p>
      ) : (
        <ul className="staff-profile-responsibilities">
          {lines.map((line) => (
            <li key={line}>
              <Icon name="check" size={13} />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="field-note">Derived from your role, caseload, appointment types and reports — nothing else.</p>
    </div>
  );
}
