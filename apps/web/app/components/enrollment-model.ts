import type { StudentRequirementDetail, StudentRewardSummary } from "@vv/contracts";
import { kindIcon, requirementKind, type RequirementKind } from "../lib/requirement-kind";
import { formatTenantDate, type TenantConfig } from "../lib/tenant";

/**
 * The checklist's vocabulary, read from the platform's requirement records —
 * the production counterpart of the reference's `features/enrollment/logic.js`.
 * Priority, unlocks and deadlines derive from canonical records. Effort durations
 * are explicitly illustrative UI estimates until the platform publishes them.
 */

export type RequirementGroup = "next" | "reviewing" | "later" | "completed";
export type Priority = "critical" | "soon" | "normal";
export type SortMode = "smart" | "due" | "quick";
export type GroupId = "reviewing" | "later" | "completed";

export const GROUPS_STORE = "aster.enrollment.groups";
export const GROUPS_DEFAULT: Record<GroupId, boolean> = { reviewing: false, later: false, completed: false };

/** A deadline this many days out or closer is escalated on screen (reference ENR-160 AC 6). */
export const ESCALATION_WINDOW = 14;

const terminalStatuses = new Set(["completed", "waived", "not_applicable"]);
const PRIORITY_ORDER: Record<Priority, number> = { critical: 0, soon: 1, normal: 2 };
const DAY = 86_400_000;

const actionLabels: Record<string, string> = {
  profile_verification: "Verify profile",
  identity_document: "Upload ID",
  official_transcript: "Upload transcript",
  financial_aid_verification: "Upload documents",
  immunization_record: "Send record",
  housing_preference: "Choose housing",
  enrollment_deposit: "Pay deposit",
  orientation_registration: "Choose a session",
};

export function isTerminal(item: StudentRequirementDetail) {
  return terminalStatuses.has(item.status);
}

export function isReviewing(item: StudentRequirementDetail) {
  return item.status === "submitted" || item.status === "under_review";
}

export function groupOf(item: StudentRequirementDetail): RequirementGroup {
  if (isTerminal(item)) return "completed";
  if (isReviewing(item)) return "reviewing";
  if (item.status === "blocked") return "later";
  return "next";
}

export function kindOf(item: StudentRequirementDetail): RequirementKind {
  return requirementKind(item);
}

export function iconOf(item: StudentRequirementDetail) {
  if (item.submissionType === "document") return "upload";
  if (item.submissionType === "payment") return "card";
  if (item.interactionType === "signature" || item.interactionType === "ferpa") return "pen";
  if (item.submissionType === "form") return "checklist";
  return kindIcon(kindOf(item));
}

/** Illustrative effort estimates for the UI review, until the platform publishes durations.
 * Kept separate from requirement records and presented as estimates, never processing SLAs. */
export function estimatedMinutes(item: StudentRequirementDetail) {
  if (/emergency/.test(item.code)) return 2;
  if (item.submissionType === "document") return 5;
  if (item.submissionType === "payment") return 3;
  if (item.submissionType === "appointment") return 4;
  if (item.interactionType === "signature" || item.interactionType === "ferpa") return 3;
  return item.submissionType === "form" ? 4 : 2;
}

export function progressOf(item: StudentRequirementDetail) {
  return Math.round(Math.min(100, Math.max(0, item.progressPercent || 0)));
}

/** Whole days until the due date; negative once it has passed; null without one. */
export function daysLeft(item: StudentRequirementDetail, now = Date.now()) {
  if (!item.dueAt) return null;
  const due = Date.parse(item.dueAt);
  if (!Number.isFinite(due)) return null;
  return Math.ceil((due - now) / DAY);
}

export function dueTime(item: StudentRequirementDetail) {
  const time = item.dueAt ? Date.parse(item.dueAt) : Number.POSITIVE_INFINITY;
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

/** "Jul 31" — the reference's short date; null without a deadline. */
export function dueShort(item: StudentRequirementDetail, tenant: TenantConfig) {
  if (!item.dueAt) return null;
  const date = new Date(item.dueAt);
  if (Number.isNaN(date.getTime())) return null;
  return formatTenantDate(date, tenant, { month: "short", day: "numeric" });
}

/** The reference's `dueLabel`: a date says it is due; no date says nothing. */
export function dueLabel(item: StudentRequirementDetail, tenant: TenantConfig) {
  const short = dueShort(item, tenant);
  return short ? `Due ${short}` : "No deadline";
}

/** The bold clause after the date on a task fact: "· 11 days", "· today", "· overdue". */
export function daysClause(item: StudentRequirementDetail) {
  const days = daysLeft(item);
  if (days == null) return null;
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * The reference's three priorities, read from what the platform says: a step
 * that holds something is `critical`; one due inside the escalation window is
 * `soon`; the rest are `normal`. A numeric `priority` above zero also escalates.
 */
export function priorityOf(item: StudentRequirementDetail): Priority {
  if (item.blocking || (item.priority ?? 0) > 0) return "critical";
  const days = daysLeft(item);
  if (days != null && days <= ESCALATION_WINDOW) return "soon";
  return "normal";
}

export function priorityLabel(priority: Priority) {
  if (priority === "critical") return "Important";
  if (priority === "soon") return "Do soon";
  return "Flexible";
}

/** How many other steps name this one as a prerequisite. */
export function unlocksOf(item: StudentRequirementDetail, all: StudentRequirementDetail[]) {
  return all.filter((other) => other.id !== item.id && other.dependencyCodes.includes(item.code)).length;
}

/** The steps this one waits on, by title, for a locked row's prerequisite line. */
export function prerequisiteLine(item: StudentRequirementDetail, all: StudentRequirementDetail[]) {
  const open = item.dependencyCodes
    .map((code) => all.find((other) => other.code === code))
    .filter((dep): dep is StudentRequirementDetail => Boolean(dep) && !isTerminal(dep as StudentRequirementDetail));
  if (open.length === 0) return "Opens when its prerequisites are complete";
  if (open.length === 1) return `Complete ‘${open[0].title}’ first`;
  return `Complete ‘${open[0].title}’ and ${open.length - 1} more first`;
}

export function actionLabel(item: StudentRequirementDetail) {
  if (item.interactionType === "ferpa") return isTerminal(item) ? "Manage access" : "Complete FERPA";
  if (isTerminal(item)) return "Review";
  if (item.status === "blocked") return "View prerequisites";
  if (isReviewing(item)) return "View submission";
  return (
    actionLabels[item.code] ??
    (item.submissionType === "document"
      ? "Upload document"
      : item.submissionType === "payment"
        ? "Make payment"
        : item.submissionType === "form"
          ? "Complete form"
          : "View details")
  );
}

export function requirementHref(item: StudentRequirementDetail) {
  return `/enrollment/requirements/${encodeURIComponent(item.slug)}`;
}

/** Longest dependent path and minimum deadline slack, derived from canonical edges.
 * Review/processing time is not supplied, so effort is an illustrative lower bound. */
export function criticalPath(item: StudentRequirementDetail, all: StudentRequirementDetail[], now = Date.now()) {
  const walk = (node: StudentRequirementDetail, seen: Set<string>): {minutes: number; deadline: number; slack: number; count: number} => {
    if (seen.has(node.code) || isTerminal(node)) return {minutes: 0, deadline: Infinity, slack: Infinity, count: 0};
    const nextSeen = new Set([...seen, node.code]);
    const children = all.filter(other => other.dependencyCodes.includes(node.code) && !isTerminal(other));
    const paths = children.map(child => walk(child, nextSeen));
    const effort = isReviewing(node) ? 0 : estimatedMinutes(node);
    return {minutes: effort + Math.max(0, ...paths.map(path => path.minutes)),
      deadline: Math.min(dueTime(node), ...paths.map(path => path.deadline)),
      slack: Math.min((dueTime(node)-now)/60000-effort, ...paths.map(path=>path.slack-effort)),
      count: new Set(all.filter(other => other.code !== node.code && dependsOn(other, node.code, all)).map(other => other.code)).size};
  };
  const path = walk(item, new Set());
  return path;
}
function dependsOn(item: StudentRequirementDetail, code: string, all: StudentRequirementDetail[], seen = new Set<string>()): boolean {
  if (seen.has(item.code) || isTerminal(item)) return false;
  if (item.dependencyCodes.includes(code)) return true;
  const next = new Set([...seen, item.code]);
  return item.dependencyCodes.some(dependency => { const parent = all.find(task => task.code === dependency); return parent ? dependsOn(parent, code, all, next) : false; });
}
export function sortTasks(tasks: StudentRequirementDetail[], mode: SortMode, all: StudentRequirementDetail[]) {
  const list = [...tasks];
  if (mode === "quick") list.sort((a,b) => estimatedMinutes(a)-estimatedMinutes(b) || dueTime(a)-dueTime(b));
  if (mode === "due") list.sort((a,b) => dueTime(a)-dueTime(b));
  if (mode === "smart") {
    const now=Date.now(), paths=new Map(list.map(item=>[item.id,criticalPath(item,all,now)]));
    list.sort((a,b)=>{
      const x=paths.get(a.id)!,y=paths.get(b.id)!;
      return Number(!a.blocking)-Number(!b.blocking) || x.slack-y.slack || y.count-x.count || y.minutes-x.minutes || PRIORITY_ORDER[priorityOf(a)] - PRIORITY_ORDER[priorityOf(b)] || estimatedMinutes(a)-estimatedMinutes(b) || (a.order??0)-(b.order??0);
    });
  }
  return list;
}

/** The Help office a responsible office maps to — the key Edward's escalation understands. */
function helpOfficeOf(office: string) {
  const name = office.toLowerCase();
  if (name.includes("financial")) return "financial-services";
  if (name.includes("admission") || name.includes("enrollment")) return "admissions";
  if (name.includes("housing") || name.includes("residen")) return "housing";
  if (name.includes("health")) return "health";
  if (name.includes("registrar")) return "registrar";
  if (name.includes("accessib")) return "accessibility";
  return null;
}

/**
 * What the inline ask hands to Edward — the reference's `edwardAskFor`: the
 * question in the student's voice, naming the step, written and not sent.
 */
export function edwardAskFor(item: StudentRequirementDetail, tenant: TenantConfig) {
  const due = dueShort(item, tenant);
  return {
    question: due
      ? `What exactly do I need to do for “${item.title}”, and what happens if I miss ${due}?`
      : `What exactly do I need to do for “${item.title}”?`,
    context: {
      label: `My Enrollment · ${item.title}`,
      intent: "task",
      taskId: item.id,
      office: helpOfficeOf(item.responsibleOffice ?? ""),
      topic: /advis/i.test(item.responsibleOffice ?? "") ? "academic" : null,
    },
  };
}

/** "Completed Jun 8" when the record carries a stamp; "Completed" when it does not. */
export function completedLabel(item: StudentRequirementDetail, tenant: TenantConfig) {
  const loose = item as StudentRequirementDetail & { completedAt?: string | null; updatedAt?: string | null };
  const stamp = loose.completedAt ?? loose.updatedAt ?? null;
  if (!stamp) return "Completed";
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return "Completed";
  return `Completed ${formatTenantDate(date, tenant, { month: "short", day: "numeric" })}`;
}

/**
 * The next whole dollar of bookstore credit — the one threshold the platform's
 * reward summary can state. The reference reads a catalogue of rewards the
 * platform does not hold, so this is the honest ladder rung.
 */
export function nextCreditStep(rewards: StudentRewardSummary) {
  const step = Math.max(1, rewards.pointsPerUsd);
  const cost = (Math.floor(rewards.lifetimePoints / step) + 1) * step;
  return { cost, away: cost - rewards.lifetimePoints, dollars: cost / step };
}

/** The "How it works" steps a requirement can honestly list. */
export function stepsOf(item: StudentRequirementDetail) {
  const steps: string[] = [];
  const policy = item.immunizationPolicy;
  if (policy && policy.requirements.length > 0) {
    steps.push(`Gather your immunization record. ${policy.name} asks for:`);
    policy.requirements
      .filter((rule) => rule.required)
      .forEach((rule) =>
        steps.push(
          `${rule.name}${rule.doseCount ? ` — ${rule.doseCount} ${rule.doseCount === 1 ? "dose" : "doses"}` : ""}${rule.description ? `. ${rule.description}` : ""}`,
        ),
      );
    return steps;
  }
  const pages = item.inputConfig.form?.pages ?? [];
  if (pages.length > 1) return pages.map((page) => page.title);
  const fields = item.inputConfig.flow ?? item.inputConfig.fields ?? [];
  if (fields.length > 1) return fields.map((field) => field.title);
  return [item.description];
}
