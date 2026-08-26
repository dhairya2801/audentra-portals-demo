import type { StudentAppointment, StudentAppointmentType } from "@vv/contracts";
import type { TenantConfig } from "../lib/tenant";
import { formatTenantDate, tenantDayIndex } from "../lib/tenant";

/**
 * The reference's `conversationTypes`, read off the production contract. The type decides which
 * team receives the booking (ENR-178 AC 2), so the team is a property of the type. The backend
 * publishes no availability, no person and no place — the student chooses the start time — so
 * those zones are omitted rather than invented.
 */
export interface ConversationType {
  id: StudentAppointmentType;
  category: string;
  label: string;
  blurb: string;
  team: string;
}

export const conversationTypes: ConversationType[] = [
  {
    id: "academic_advising",
    category: "Your adviser",
    label: "Academic advising",
    blurb: "Your courses, your plan for the term, or anything your academic adviser should hear first.",
    team: "Academic Advising",
  },
  {
    id: "admissions_counseling",
    category: "Your offer",
    label: "Admissions counseling",
    blurb: "Your offer, your enrollment timeline, or a decision that is holding you up.",
    team: "Admissions Office",
  },
  {
    id: "enrollment_support",
    category: "Your enrollment",
    label: "Enrollment support",
    blurb: "A step on your checklist that is blocked, unclear, or that you would rather do with someone.",
    team: "Admissions Office",
  },
  {
    id: "financial_aid",
    category: "Your financials",
    label: "Financial aid",
    blurb: "Your package, what a figure means, or what happens to it if something changes.",
    team: "Financial Aid Office",
  },
  {
    id: "international_check_in",
    category: "Your visa",
    label: "International check-in",
    blurb: "Your SEVIS check-in, your I-20, or a question about your status.",
    team: "International Student Services",
  },
];

export function typeById(id: StudentAppointmentType): ConversationType {
  return conversationTypes.find((type) => type.id === id) ?? conversationTypes[1];
}

/** An office named in running text takes its article — *the Financial Aid Office needs…*. */
export function articled(name: string, capital = false) {
  if (!/\bOffice\b/.test(name)) return name;
  return `${capital ? "The" : "the"} ${name}`;
}

/** "Admissions Office" → "Admissions" — the office as the campus says it. */
export function runningName(name: string) {
  if (name.startsWith("Office of the ")) return `the ${name.slice("Office of the ".length)}`;
  return name.replace(/ Office$/, "");
}

export type AppointmentTone = "confirmed" | "done" | "cancelled";

/**
 * What the row's badge says. A scheduled conversation whose time has passed is not still
 * "Confirmed" — it happened (or, when the person on the other side recorded it, it did not).
 * A rescheduled one lives on as its replacement. Derived, never stored.
 */
export function stateOf(appointment: StudentAppointment, now: number): { tone: AppointmentTone; label: string } {
  if (appointment.status === "cancelled") return { tone: "cancelled", label: "Cancelled" };
  if (appointment.status === "rescheduled") return { tone: "cancelled", label: "Rescheduled" };
  if (appointment.status === "no_show") return { tone: "done", label: "Missed" };
  if (appointment.status === "completed" || new Date(appointment.startsAt).getTime() < now) {
    return { tone: "done", label: "Completed" };
  }
  return { tone: "confirmed", label: "Confirmed" };
}

/** Who the student meets: the named person when the record has one, otherwise the team. */
export function whoLabel(appointment: StudentAppointment, type: ConversationType) {
  const staff = appointment.staff;
  if (!staff) return type.team;
  return staff.title ? `${staff.name} · ${staff.title}` : staff.name;
}

/** The short name of the person, for running text; the team when nobody is named. */
export function whoShort(appointment: StudentAppointment, type: ConversationType) {
  return appointment.staff?.name ?? type.team;
}

/** The slot picker groups a person's open times by local day. */
export function groupSlotsByDay<T extends { startsAt: string }>(slots: T[], tenant: TenantConfig): Array<{ day: string; slots: T[] }> {
  const groups = new Map<string, T[]>();
  for (const slot of slots) {
    const key = formatTenantDate(slot.startsAt, tenant, { weekday: "long", month: "short", day: "numeric" });
    const list = groups.get(key) ?? [];
    list.push(slot);
    groups.set(key, list);
  }
  return [...groups].map(([day, entries]) => ({ day, slots: entries }));
}

/** What a refused booking means, in the student's words. */
export function bookingRefusal(code: string | undefined, who: string): string | null {
  switch (code) {
    case "APPOINTMENT_SLOT_TAKEN":
      return `That time was just taken on ${who}’s calendar. Pick another.`;
    case "STAFF_UNAVAILABLE":
      return `${who} is away at that time.`;
    case "OUTSIDE_WORKING_HOURS":
      return `${who} does not take appointments at that time.`;
    case "APPOINTMENT_OFF_GRID":
      return `That time is not one of ${who}’s appointment slots.`;
    case "STAFF_MEMBER_ON_LEAVE":
      return `${who} is on leave and cannot be booked right now.`;
    case "STAFF_MEMBER_DEPARTED":
      return `${who} is no longer at the university. Ask Edward or the office who can see you instead.`;
    case "STAFF_NO_AVAILABILITY":
      return `${who} has not published appointment hours yet.`;
    case "STAFF_DOES_NOT_OFFER_TYPE":
      return `${who} does not take this kind of appointment.`;
    default:
      return null;
  }
}

/** `current` is what is still ahead; `record` is everything over or cancelled. */
export function splitAppointments(list: StudentAppointment[], now: number) {
  const byStart = (a: StudentAppointment, b: StudentAppointment) =>
    new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  const current = list.filter((item) => stateOf(item, now).tone === "confirmed").sort(byStart);
  const record = list.filter((item) => !current.includes(item)).sort((a, b) => byStart(b, a));
  return { current, record };
}

/* ---- Dates, in the tenant's own zone, in the reference's vocabulary ---- */

export function dayDiff(iso: string, tenant: TenantConfig, now = Date.now()) {
  return tenantDayIndex(iso, tenant) - tenantDayIndex(new Date(now), tenant);
}

export function dateTile(iso: string, tenant: TenantConfig) {
  return {
    month: formatTenantDate(iso, tenant, { month: "short" }).toUpperCase(),
    day: formatTenantDate(iso, tenant, { day: "2-digit" }),
  };
}

/** `Aug 27, 2026`, or `Thursday, Aug 27, 2026` when it is less than a week away. */
export function longDate(iso: string, tenant: TenantConfig, now = Date.now()) {
  const diff = dayDiff(iso, tenant, now);
  const withinWeek = diff >= 0 && diff <= 7;
  return formatTenantDate(iso, tenant, {
    ...(withinWeek ? { weekday: "long" } : {}),
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** `Aug 27` — month first, always. */
export function shortDate(iso: string, tenant: TenantConfig) {
  return formatTenantDate(iso, tenant, { month: "short", day: "numeric" });
}

/** `10:30 AM` */
export function clockTime(iso: string, tenant: TenantConfig) {
  return formatTenantDate(iso, tenant, { hour: "numeric", minute: "2-digit" });
}

/** How far away it is, in the words a student would use. */
export function relativeDay(iso: string, tenant: TenantConfig, now = Date.now()) {
  const days = dayDiff(iso, tenant, now);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1) return days < 14 ? `in ${days} days` : `in ${Math.round(days / 7)} weeks`;
  return `${Math.abs(days)} days ago`;
}

/** The invite the row and the drawer hand to the student's own calendar — a production action. */
export function calendarHref(appointment: StudentAppointment, type: ConversationType) {
  const stamp = new Date(appointment.startsAt).toISOString().replaceAll(/[-:]/g, "").replace(".000", "");
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${stamp}`,
    `SUMMARY:${type.label} · ${whoShort(appointment, type)}`,
    ...(appointment.endsAt ? [`DTEND:${new Date(appointment.endsAt).toISOString().replaceAll(/[-:]/g, "").replace(".000", "")}`] : []),
    ...(appointment.location ? [`LOCATION:${appointment.location}`] : []),
    ...(appointment.notes ? [`DESCRIPTION:${appointment.notes.replaceAll(/\r?\n/g, " ")}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
}

/** `datetime-local` wants `YYYY-MM-DDTHH:MM` in the browser's zone. */
export function localInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
