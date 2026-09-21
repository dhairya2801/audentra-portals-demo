import type {
  StaffActionCenterQuery,
  StaffAppointment,
  StaffAssignmentRole,
  StaffAvailabilityRule,
  StaffCaseloadItem,
  StaffMe,
  StaffPerson,
  StaffTeamMember,
  StaffWorkSummary,
  StudentAppointmentType,
} from "@vv/contracts";

/**
 * The staff profile, read off /v1/staff/me, /v1/staff/caseload and
 * /v1/staff/appointments. Every row here is a field the platform holds; a row
 * the platform has no value for is shown as blank, never filled in. This
 * module has no React and no relative imports so the unit tests can run it as
 * one transpiled file.
 */

export const ROLE_LABEL: Record<StaffAssignmentRole, string> = {
  primary_advisor: "Primary adviser",
  admissions_counselor: "Admissions counselor",
  financial_aid_counselor: "Financial aid counselor",
  international_adviser: "International adviser",
  housing_coordinator: "Housing coordinator",
};

export const APPOINTMENT_TYPE_LABEL: Record<StudentAppointmentType, string> = {
  admissions_counseling: "Admissions counseling",
  financial_aid: "Financial aid",
  enrollment_support: "Enrollment support",
  academic_advising: "Academic advising",
  international_check_in: "International check-in",
};

export const MODALITY_LABEL: Record<"in_person" | "virtual" | "either", string> = {
  in_person: "In person",
  virtual: "Virtual",
  either: "In person or virtual",
};

export const TEAM_FLAG_COPY: Record<
  StaffTeamMember["flags"][number],
  { label: string; tone: "crimson" | "amber" | "green" }
> = {
  departed_with_caseload: { label: "Departed · students still assigned", tone: "crimson" },
  departed: { label: "Departed", tone: "crimson" },
  on_leave_with_caseload: { label: "On leave · caseload not covered", tone: "amber" },
  on_leave: { label: "On leave", tone: "amber" },
  over_cap: { label: "Over caseload cap", tone: "crimson" },
  no_open_slots: { label: "No open slots · 14 days", tone: "amber" },
  falling_behind: { label: "Falling behind", tone: "crimson" },
  spare_capacity: { label: "Spare capacity", tone: "green" },
};

export const ADVISING_LABEL: Record<StaffCaseloadItem["advising"]["status"], string> = {
  completed: "Met",
  scheduled: "Booked",
  missed: "Missed",
  none: "Not yet",
};

/* ------------------------------------------------------------ formatting */

export function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function safeZone(timeZone: string | null | undefined) {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return timeZone;
  } catch {
    return "UTC";
  }
}

/** `Wed, Sep 2, 2:30 PM` in the member's own zone. */
export function whenIn(iso: string | null | undefined, timeZone: string | null | undefined) {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: safeZone(timeZone),
  }).format(new Date(time));
}

/** `2:30 PM` in the member's own zone. */
export function clockIn(iso: string, timeZone: string | null | undefined) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: safeZone(timeZone),
  }).format(new Date(iso));
}

/** `Sep 2, 2026` — a calendar date, in the member's zone when the value carries a time. */
export function dateIn(iso: string | null | undefined, timeZone: string | null | undefined) {
  if (!iso) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const time = Date.parse(dateOnly ? `${iso}T00:00:00Z` : iso);
  if (!Number.isFinite(time)) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: dateOnly ? "UTC" : safeZone(timeZone),
  }).format(new Date(time));
}

/** `9:00 AM` from minutes after midnight. */
export function minuteLabel(minute: number) {
  const hours = Math.floor(minute / 60) % 24;
  const minutes = minute % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** The zone as people say it — `ET` rather than `America/New_York` — when the browser knows it. */
export function zoneAbbreviation(timeZone: string, at = Date.now()) {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(new Date(at))
      .find((entry) => entry.type === "timeZoneName");
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

/* ------------------------------------------------------------- identity */

export interface ProfileRow {
  id: string;
  label: string;
  value: string | null;
  /** What the blank says when the platform holds nothing. */
  blank?: string;
  note?: string;
  mono?: boolean;
}

export function employmentLabel(staff: StaffPerson) {
  const type = staff.employmentType === "part_time" ? "Part-time" : "Full-time";
  if (staff.employmentStatus === "departed") {
    return `Departed${staff.endedAt ? ` · ${dateIn(staff.endedAt, staff.timezone)}` : ""}`;
  }
  if (staff.employmentStatus === "on_leave") {
    return `${type} · On leave${staff.leaveUntil ? ` until ${dateIn(staff.leaveUntil, staff.timezone)}` : ""}`;
  }
  return `${type} · Active`;
}

export function identityRows(me: StaffMe): ProfileRow[] {
  const { staff, manager } = me;
  return [
    { id: "name", label: "Name", value: staff.name },
    { id: "title", label: "Title", value: staff.title, blank: "No title on record" },
    {
      id: "role",
      label: "Role",
      value: staff.roleCode ? staff.roleCode.replaceAll("_", " ") : null,
      blank: "No role code on record",
    },
    { id: "component", label: "Department", value: staff.component },
    { id: "email", label: "Institutional email", value: staff.email, mono: true },
    {
      id: "office",
      label: "Office",
      value: staff.officeLocation,
      blank: "No office location on record",
    },
    { id: "timezone", label: "Time zone", value: staff.timezone, mono: true },
    { id: "employment", label: "Employment", value: employmentLabel(staff) },
    {
      id: "started",
      label: "Started",
      value: dateIn(staff.startedAt, staff.timezone),
      blank: "No start date on record",
    },
    {
      id: "manager",
      label: "Reports to",
      value: manager ? [manager.name, manager.title].filter(Boolean).join(" · ") : null,
      blank: "No manager on record",
    },
    {
      id: "student-facing",
      label: "Student-facing",
      value: staff.studentFacing ? "Yes — students can be assigned to you" : "No",
    },
    {
      id: "appointment-types",
      label: "Appointment types offered",
      value: staff.appointmentTypes.length
        ? staff.appointmentTypes.map((type) => APPOINTMENT_TYPE_LABEL[type] ?? type).join(", ")
        : null,
      blank: "None published",
    },
    {
      id: "staff-id",
      label: "Staff ID",
      value: staff.externalRef,
      blank: "No external reference on record",
      mono: true,
    },
  ];
}

export interface ProfileGap {
  tone: "amber" | "crimson";
  text: string;
}

/** What is not right about this chair, in one sentence each — only from real fields. */
export function profileGaps(me: StaffMe): ProfileGap[] {
  const { staff, availability, caseload, work } = me;
  const gaps: ProfileGap[] = [];
  if (staff.employmentStatus === "departed") {
    gaps.push({ tone: "crimson", text: "This account is recorded as departed; students cannot book you." });
  }
  if (staff.employmentStatus === "on_leave") {
    gaps.push({
      tone: "amber",
      text: `You are on leave${staff.leaveUntil ? ` until ${dateIn(staff.leaveUntil, staff.timezone)}` : ""}: students cannot book you${caseload.primaryAdvisees > 0 ? `, and your ${caseload.primaryAdvisees} primary advisees are not covered` : ""}.`,
    });
  }
  if (caseload.overCap && caseload.cap != null) {
    gaps.push({
      tone: "crimson",
      text: `Your caseload is over its cap: ${caseload.primaryAdvisees} primary advisees against ${caseload.cap}.`,
    });
  }
  if (staff.employmentStatus === "active" && staff.studentFacing) {
    if (!availability.bookable && availability.reason === "no_availability") {
      gaps.push({ tone: "amber", text: "You have no published availability, so students cannot book you." });
    } else if (availability.bookable && availability.openSlotsNext14Days === 0) {
      gaps.push({
        tone: "crimson",
        text: "You have no open appointment slot in the next two weeks; students who need to see you cannot book.",
      });
    }
  }
  if (work.staleInProgress >= 3) {
    gaps.push({ tone: "crimson", text: `${work.staleInProgress} of your items have been in progress for more than 10 days.` });
  }
  if (work.appointmentsAwaitingOutcome >= 3) {
    gaps.push({
      tone: "amber",
      text: `${work.appointmentsAwaitingOutcome} past appointments have not been closed out as completed or no-show.`,
    });
  }
  return gaps;
}

/* -------------------------------------------------------------- numbers */

export interface CaseloadMeter {
  primaryAdvisees: number;
  cap: number | null;
  /** 0–100, capped at 100 for the bar; `null` when there is no cap. */
  percent: number | null;
  /** The real utilization, which can exceed 100. */
  utilizationPercent: number | null;
  overCap: boolean;
}

export function caseloadMeter(me: StaffMe): CaseloadMeter {
  const { primaryAdvisees, cap, utilization, overCap } = me.caseload;
  const utilizationPercent =
    utilization != null ? Math.round(utilization * 100) : cap ? Math.round((primaryAdvisees / cap) * 100) : null;
  return {
    primaryAdvisees,
    cap,
    percent: utilizationPercent == null ? null : Math.min(100, Math.max(0, utilizationPercent)),
    utilizationPercent,
    overCap,
  };
}

export function caseloadByRole(me: StaffMe) {
  return (Object.entries(me.caseload.byRole) as Array<[StaffAssignmentRole, number]>)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .map(([role, count]) => ({ role, label: ROLE_LABEL[role] ?? role, count }));
}

export interface WorkRow {
  id: keyof StaffWorkSummary;
  label: string;
  value: number;
  tone: "neutral" | "amber" | "crimson" | "green";
  /** The task-board filter that shows exactly these items, when the board has one. */
  query: StaffActionCenterQuery | null;
  /** Where a row without a board filter points instead. */
  destination?: "appointments";
}

export function workRows(work: StaffWorkSummary): WorkRow[] {
  const mine = { assignee: "me" } as const;
  return [
    { id: "open", label: "Open", value: work.open, tone: "neutral", query: { ...mine, status: "open" } },
    {
      id: "overdue",
      label: "Overdue",
      value: work.overdue,
      tone: work.overdue > 0 ? "crimson" : "neutral",
      query: { ...mine, status: "open", due: "overdue" },
    },
    {
      id: "urgent",
      label: "Urgent",
      value: work.urgent ?? 0,
      tone: (work.urgent ?? 0) > 0 ? "crimson" : "neutral",
      query: { ...mine, status: "open", priority: "urgent" },
    },
    {
      id: "escalated",
      label: "Escalated",
      value: work.escalated ?? 0,
      tone: (work.escalated ?? 0) > 0 ? "amber" : "neutral",
      query: { ...mine, status: "open", escalated: true },
    },
    {
      id: "staleInProgress",
      label: "Stale in progress",
      value: work.staleInProgress,
      tone: work.staleInProgress > 0 ? "amber" : "neutral",
      query: { ...mine, status: "in_progress", stale: true },
    },
    {
      id: "appointmentsAwaitingOutcome",
      label: "Appointments awaiting outcome",
      value: work.appointmentsAwaitingOutcome,
      tone: work.appointmentsAwaitingOutcome > 0 ? "amber" : "neutral",
      query: null,
      destination: "appointments",
    },
    {
      id: "completedLast7Days",
      label: "Completed · last 7 days",
      value: work.completedLast7Days ?? 0,
      tone: "green",
      query: { ...mine, status: "done" },
    },
  ];
}

/* ------------------------------------------------------------- calendar */

const WEEKDAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Monday first, the way a working week reads. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export interface ScheduleDay {
  weekday: number;
  label: string;
  windows: Array<{
    start: string;
    end: string;
    slotMinutes: number;
    modality: string;
    location: string | null;
    appointmentTypes: string[];
  }>;
}

/** The weekly pattern as a readable schedule: one line per day, windows in order. */
export function weeklySchedule(rules: StaffAvailabilityRule[] | undefined): ScheduleDay[] {
  if (!rules?.length) return [];
  const byDay = new Map<number, ScheduleDay>();
  for (const rule of rules) {
    const day = byDay.get(rule.weekday) ?? {
      weekday: rule.weekday,
      label: WEEKDAY_LABEL[rule.weekday] ?? `Day ${rule.weekday}`,
      windows: [],
    };
    day.windows.push({
      start: minuteLabel(rule.startMinute),
      end: minuteLabel(rule.endMinute),
      slotMinutes: rule.slotMinutes,
      modality: MODALITY_LABEL[rule.modality] ?? rule.modality,
      location: rule.location,
      appointmentTypes: rule.appointmentTypes.map((type) => APPOINTMENT_TYPE_LABEL[type] ?? type),
    });
    byDay.set(rule.weekday, day);
  }
  for (const day of byDay.values()) {
    day.windows.sort((left, right) => toMinutes(left.start) - toMinutes(right.start));
  }
  return WEEKDAY_ORDER.filter((weekday) => byDay.has(weekday)).map((weekday) => byDay.get(weekday)!);
}

function toMinutes(label: string) {
  const match = /^(\d+):(\d+) (AM|PM)$/.exec(label);
  if (!match) return 0;
  const hour = Number(match[1]) % 12;
  return (match[3] === "PM" ? hour + 12 : hour) * 60 + Number(match[2]);
}

/** The window the profile reads: far enough back to list unclosed appointments, two weeks ahead. */
export function appointmentWindow(now: number) {
  const day = 86_400_000;
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return {
    from: new Date(start.getTime() - 45 * day).toISOString(),
    to: new Date(start.getTime() + 15 * day).toISOString(),
  };
}

export interface AppointmentBuckets {
  /** Scheduled, and already over: the ones a staff member still has to close out. */
  awaitingOutcome: StaffAppointment[];
  /** Scheduled and still ahead, soonest first. */
  upcoming: StaffAppointment[];
  /** Completed, missed or cancelled, most recent first. */
  closed: StaffAppointment[];
}

export function partitionAppointments(items: StaffAppointment[], now: number): AppointmentBuckets {
  const byStart = (left: StaffAppointment, right: StaffAppointment) =>
    Date.parse(left.startsAt) - Date.parse(right.startsAt);
  const scheduled = items.filter((item) => item.status === "scheduled");
  return {
    awaitingOutcome: scheduled.filter((item) => Date.parse(item.startsAt) < now).sort((a, b) => byStart(b, a)),
    upcoming: scheduled.filter((item) => Date.parse(item.startsAt) >= now).sort(byStart),
    closed: items.filter((item) => item.status !== "scheduled").sort((a, b) => byStart(b, a)),
  };
}

/** What a refused close-out means, in the staff member's words. */
export function closeOutFailure(status: number | null, code: string | null, message: string) {
  if (status === 403) {
    return "This appointment belongs to another staff member's calendar, so you cannot record its outcome.";
  }
  if (status === 409) {
    return "This appointment changed since the page loaded. Reload the calendar and try again.";
  }
  if (status === 404) return "This appointment no longer exists on the calendar.";
  return message || (code ? `The appointment could not be updated (${code}).` : "The appointment could not be updated.");
}

/* ------------------------------------------------------------- caseload */

export type CaseloadFilter = "all" | "not_met" | "open_work" | "overdue_work";
export type CaseloadSort = "name" | "progress" | "open_work" | "next_appointment";

export const CASELOAD_FILTERS: Array<{ id: CaseloadFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "not_met", label: "Advising not met" },
  { id: "open_work", label: "With open work" },
  { id: "overdue_work", label: "With overdue work" },
];

export function caseloadRows(
  items: StaffCaseloadItem[],
  options: { filter: CaseloadFilter; sort: CaseloadSort; role: StaffAssignmentRole | "all" },
) {
  const filtered = items.filter((item) => {
    if (options.role !== "all" && item.role !== options.role) return false;
    switch (options.filter) {
      case "not_met":
        return item.advising.status !== "completed";
      case "open_work":
        return item.work.open > 0;
      case "overdue_work":
        return item.work.overdue > 0;
      default:
        return true;
    }
  });
  const sorted = [...filtered];
  switch (options.sort) {
    case "progress":
      sorted.sort(
        (left, right) => (left.requirements.percent ?? -1) - (right.requirements.percent ?? -1) || byName(left, right),
      );
      break;
    case "open_work":
      sorted.sort(
        (left, right) =>
          right.work.overdue - left.work.overdue || right.work.open - left.work.open || byName(left, right),
      );
      break;
    case "next_appointment":
      sorted.sort((left, right) => {
        const l = left.advising.nextAppointmentAt ? Date.parse(left.advising.nextAppointmentAt) : Infinity;
        const r = right.advising.nextAppointmentAt ? Date.parse(right.advising.nextAppointmentAt) : Infinity;
        return l - r || byName(left, right);
      });
      break;
    default:
      sorted.sort(byName);
  }
  return sorted;
}

function byName(left: StaffCaseloadItem, right: StaffCaseloadItem) {
  return left.student.name.localeCompare(right.student.name);
}

/* ------------------------------------------------------- responsibilities */

/** What this chair is responsible for, said only from fields the record holds. */
export function responsibilities(me: StaffMe): string[] {
  const { staff, caseload, availability, directReports, componentSummary } = me;
  const lines: string[] = [];
  const role = staff.title ?? (staff.roleCode ? staff.roleCode.replaceAll("_", " ") : null);
  if (role) lines.push(`${role} in ${staff.component}.`);
  for (const entry of caseloadByRole(me)) {
    lines.push(`${entry.label} to ${entry.count} ${entry.count === 1 ? "student" : "students"}.`);
  }
  if (staff.studentFacing && staff.appointmentTypes.length > 0) {
    const types = staff.appointmentTypes.map((type) => APPOINTMENT_TYPE_LABEL[type] ?? type);
    const list = types.length === 1 ? types[0] : `${types.slice(0, -1).join(", ")} and ${types[types.length - 1]}`;
    lines.push(
      availability.bookable
        ? `Takes ${list.toLowerCase()} appointments · ${availability.openSlotsNext14Days} open ${availability.openSlotsNext14Days === 1 ? "slot" : "slots"} in the next 14 days.`
        : `Offers ${list.toLowerCase()} appointments, but is not bookable right now.`,
    );
  } else if (!staff.studentFacing) {
    lines.push("Not student-facing: no students are assigned to you and nothing is bookable.");
  }
  if (directReports.length > 0) {
    lines.push(`Manages ${directReports.length} direct ${directReports.length === 1 ? "report" : "reports"}${componentSummary ? ` in ${componentSummary.component}` : ""}.`);
  }
  if (caseload.cap != null) lines.push(`Primary-adviser caseload cap of ${caseload.cap}.`);
  return lines;
}
