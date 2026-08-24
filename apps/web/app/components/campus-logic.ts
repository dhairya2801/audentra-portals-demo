import type { CampusEvent, StudentClub } from "@vv/contracts";
import { formatTenantDate, tenantDayIndex, type TenantConfig } from "../lib/tenant";

/**
 * My Campus Life — the reference's `features/campus/logic.js`, read against the
 * production feed. The reference formats ISO dates it publishes itself; here the
 * backend publishes instants, so every formatter reads them in the tenant's own
 * locale and time zone, the way the rest of the portal renders dates.
 */

function daysBetween(value: string, today: Date, tenant: TenantConfig) {
  return tenantDayIndex(value, tenant) - tenantDayIndex(today, tenant);
}

/** Inside a week of today the weekday is worth saying; past that it is noise. */
function withinWeek(value: string, today: Date, tenant: TenantConfig) {
  const diff = daysBetween(value, today, tenant);
  return diff >= 0 && diff <= 7;
}

export function dateTile(value: string, tenant: TenantConfig) {
  return {
    month: formatTenantDate(value, tenant, { month: "short" }).toUpperCase(),
    day: formatTenantDate(value, tenant, { day: "2-digit" }),
  };
}

/** `Aug 27, 2027`, or `Thursday, Aug 27, 2027` when it is less than a week away. */
export function longDate(value: string, today: Date, tenant: TenantConfig) {
  return formatTenantDate(value, tenant, {
    ...(withinWeek(value, today, tenant) ? { weekday: "long" as const } : {}),
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** `Aug 27` — month first, always. */
export function shortDate(value: string, tenant: TenantConfig) {
  return formatTenantDate(value, tenant, { month: "short", day: "numeric" });
}

function clock(value: string, tenant: TenantConfig) {
  return formatTenantDate(value, tenant, { hour: "numeric", minute: "2-digit" });
}

/** `7:30 PM–9:30 PM` — what the reference publishes as `event.time`. */
export function timeRange(startsAt: string, endsAt: string, tenant: TenantConfig) {
  return `${clock(startsAt, tenant)}–${clock(endsAt, tenant)}`;
}

export function isPast(event: Pick<CampusEvent, "endsAt">, today: Date) {
  return new Date(event.endsAt).getTime() < today.getTime();
}

function byStart(a: CampusEvent, b: CampusEvent) {
  return a.startsAt.localeCompare(b.startsAt);
}

// A past event leaves the browsable set without being deleted: the partition is
// derived from the date every time the page renders.
export function splitByTime(events: CampusEvent[], today: Date) {
  return {
    upcoming: events.filter((event) => !isPast(event, today)).sort(byStart),
    past: events.filter((event) => isPast(event, today)).sort((a, b) => byStart(b, a)),
  };
}

export function groupLabel(value: string, today: Date, tenant: TenantConfig) {
  const year = formatTenantDate(value, tenant, { year: "numeric" });
  const sameYear = year === formatTenantDate(today, tenant, { year: "numeric" });
  const month = formatTenantDate(
    value,
    tenant,
    sameYear ? { month: "long" } : { month: "long", year: "numeric" },
  );
  // A past event is grouped by the month it happened in. `This week` would be
  // true of last Tuesday and read as an invitation to something already over.
  const day = tenantDayIndex(value, tenant);
  const todayIndex = tenantDayIndex(today, tenant);
  if (day < todayIndex) return month;
  // Day 0 (1970-01-01) was a Thursday; the week ends on Saturday, as in the reference.
  const weekday = (todayIndex + 4) % 7;
  const endOfWeek = todayIndex + ((7 - weekday) % 7);
  if (day <= endOfWeek) return "This week";
  if (day <= endOfWeek + 7) return "Next week";
  return month;
}

export function groupEvents(events: CampusEvent[], today: Date, tenant: TenantConfig) {
  const groups: { label: string; items: CampusEvent[] }[] = [];
  events.forEach((event) => {
    const label = groupLabel(event.startsAt, today, tenant);
    const current = groups[groups.length - 1];
    if (current && current.label === label) current.items.push(event);
    else groups.push({ label, items: [event] });
  });
  return groups;
}

/** The backend publishes categories as lowercase keys; the chip says them as words. */
export function categoryLabel(category: string) {
  return category
    .split(/[\s_-]+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export function categoriesOf(items: { category: string }[]) {
  return [...new Set(items.map((item) => item.category))].sort((a, b) =>
    categoryLabel(a).localeCompare(categoryLabel(b)),
  );
}

/**
 * What a row offers about registering (C2, C4): a control where there is
 * something to do and a label where there is not. Registration is the portal's
 * own here — one call, one place held — so the control registers rather than
 * linking out, and a held place is a label.
 */
export function rowRegistration(event: CampusEvent, past: boolean) {
  if (past) return { label: "Ended", control: null };
  if (event.registrationStatus === "registered") return { label: "Registered", control: null };
  if (event.registrationStatus === "cancelled_by_event") return { label: "Cancelled", control: null };
  return { label: null, control: { label: "Register", icon: "arrow" } };
}

export function registrationHeading(event: CampusEvent) {
  if (event.registrationStatus === "registered") return "You’re registered";
  if (event.registrationStatus === "cancelled_by_event") return "Registration is closed";
  return "How to register";
}

/** Initials for a club with no emblem published — never a photograph. */
export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter((part) => /^[A-Za-z0-9]/.test(part))
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

/** "the Aster Chamber Choir", "Aster Robotics" — the name as a sentence says it. */
export function orgInSentence(org: Pick<StudentClub, "name">) {
  return /(Club|Society|Choir|Network|Bank|Collective|Orchestra|Exchange|Circle|Radio)$/.test(
    org.name,
  )
    ? `the ${org.name}`
    : org.name;
}

/** The question the door writes for Edward — the club's person named. */
export function contactQuestion(org: Pick<StudentClub, "name" | "contactName">) {
  return `How do I get in touch with ${org.contactName} about ${orgInSentence(org)}?`;
}

export function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** "2 hours ago" — the feed's own `generatedAt`, said the way the reference says it. */
export function relativeTime(value: string, now: Date) {
  const diff = Math.max(0, now.getTime() - new Date(value).getTime());
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
