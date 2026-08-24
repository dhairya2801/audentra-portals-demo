import type { HelpArticle, StudentHelpRequest, TenantContact } from "@vv/contracts";
import type { TenantConfig } from "../lib/tenant";
import { formatTenantDate } from "../lib/tenant";

/**
 * What a request is doing, said in the student's terms — the reference's `REQUEST_STATES` over
 * the production request status. Every state describes the request; none names a person, a queue
 * or an inbox (ENR-177 AC 3).
 */
export type RequestTone = "neutral" | "progress" | "act" | "done";

export const REQUEST_STATES: Record<StudentHelpRequest["status"], { label: string; tone: RequestTone; line: (office: string) => string }> = {
  new: { label: "Received", tone: "neutral", line: (office) => `${office} has it. Nothing is needed from you.` },
  open: { label: "In progress", tone: "progress", line: (office) => `${office} is working on it. The answer lands here.` },
  waiting_on_student: {
    label: "Needs you",
    tone: "act",
    line: (office) => `${office} asked you something. Reply here to keep it moving.`,
  },
  resolved: { label: "Answered", tone: "done", line: (office) => `${office} answered. Reply here if it is not settled.` },
};

export function stateOf(request: StudentHelpRequest) {
  return REQUEST_STATES[request.status] ?? REQUEST_STATES.new;
}

const OPEN = new Set<StudentHelpRequest["status"]>(["new", "open", "waiting_on_student"]);

export function openRequests(requests: StudentHelpRequest[]) {
  return requests.filter((request) => OPEN.has(request.status));
}

/** The one that can reach the notice: it is the only state that asks her for anything. */
export function waitingOnYou(requests: StudentHelpRequest[]) {
  return requests.find((request) => request.status === "waiting_on_student") ?? null;
}

/** Newest movement first. What moved last is what she came back to read. */
export function sortRequests(requests: StudentHelpRequest[]) {
  return [...requests].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

/** The office a request reaches. The backend routes every request to the institution's support contact. */
export function officeName(support: TenantContact) {
  return support.label || "Student support";
}

/**
 * What a question can be about — the production topic codes, written as things that happen to a
 * student. `guide` is the article the backend publishes under that topic, if it has one.
 */
export const helpTopics: { id: HelpArticle["category"]; label: string }[] = [
  { id: "getting_started", label: "Getting started" },
  { id: "documents", label: "A document I sent or need to send" },
  { id: "payments", label: "My bill or a payment" },
  { id: "support", label: "Something else" },
];

export function topicLabel(id: HelpArticle["category"]) {
  return helpTopics.find((topic) => topic.id === id)?.label ?? "Something else";
}

export function guideFor(articles: HelpArticle[], topic: HelpArticle["category"]) {
  return articles.find((article) => article.category === topic) ?? null;
}

const DAY_MS = 86400000;

/** How long ago something moved. */
export function sinceLabel(iso: string, now = Date.now()) {
  const days = Math.round((now - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  return `${Math.floor(days / 7)} weeks ago`;
}

/** `Aug 27` — month first, always. */
export function shortDate(iso: string, tenant: TenantConfig) {
  return formatTenantDate(iso, tenant, { month: "short", day: "numeric" });
}

/** `Aug 27, 2026` */
export function longDate(iso: string, tenant: TenantConfig) {
  return formatTenantDate(iso, tenant, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * The thread as one ordered path: what somebody wrote, and what happened to the request. The
 * receipt event is derived from the request's own opening so the row and the drawer cannot
 * disagree about when the office had it.
 */
export type ThreadEntry =
  | { id: string; kind: "message"; from: "student" | "office"; when: string; body: string[] }
  | { id: string; kind: "event"; when: string; text: string };

export function threadOf(request: StudentHelpRequest, office: string): ThreadEntry[] {
  const messages = request.messages.filter((message) => !message.privateToStaff);
  const entries: ThreadEntry[] = [];
  const first = messages[0];
  if (!first || first.direction !== "student") {
    entries.push({
      id: `${request.id}-asked`,
      kind: "message",
      from: "student",
      when: request.createdAt,
      body: request.message.split("\n").filter(Boolean),
    });
  }
  messages.forEach((message, index) => {
    entries.push({
      id: message.id,
      kind: "message",
      from: message.direction === "student" ? "student" : "office",
      when: message.createdAt,
      body: message.body.split("\n").filter(Boolean),
    });
    if (index === 0 && message.direction === "student") {
      entries.push({ id: `${message.id}-received`, kind: "event", when: message.createdAt, text: `Received by ${office}` });
    }
  });
  if (entries.length === 1) {
    entries.push({ id: `${request.id}-received`, kind: "event", when: request.createdAt, text: `Received by ${office}` });
  }
  if (request.status === "open" && !messages.some((message) => message.direction === "staff")) {
    entries.push({ id: `${request.id}-working`, kind: "event", when: request.updatedAt, text: `${office} is working on this` });
  }
  return entries;
}
