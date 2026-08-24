import type {
  StudentDocument,
  StudentOnboarding,
  StudentRequirementDetail,
} from "@vv/contracts";
import { formatTenantDate, type TenantConfig } from "../lib/tenant";

/**
 * What the Health section is in, said once — the reference's
 * `features/health/logic.js` and `features/documents/logic.js`, read against the
 * production record: the immunization requirement (`getStudentRequirements`)
 * and the documents sent for it (`getStudentDocuments`).
 *
 * The state is derived, never stored twice: the requirement's own status wins
 * where it is decisive, and the newest document decides the rest.
 */

export type RecordState =
  | "blocked"
  | "needed"
  | "checking"
  | "in-review"
  | "accepted"
  | "changes-requested";

export type PillTone = "act" | "wait" | "progress" | "done" | "stop" | "quiet";

export const RECORD_STATES: Record<
  RecordState,
  { label: string; tone: PillTone; holder: "you" | "aster" | "nobody" | "later"; consequence: string | null }
> = {
  blocked: { label: "Coming up", tone: "quiet", holder: "later", consequence: null },
  needed: { label: "Not sent", tone: "act", holder: "you", consequence: null },
  checking: {
    label: "Sent",
    tone: "progress",
    holder: "nobody",
    consequence: "Being checked. Nothing for you to do.",
  },
  "in-review": {
    label: "In review",
    tone: "wait",
    holder: "aster",
    consequence: "Nothing for you to do while they have it",
  },
  accepted: { label: "Accepted", tone: "done", holder: "nobody", consequence: null },
  "changes-requested": { label: "Came back", tone: "stop", holder: "you", consequence: null },
};

const SETTLED = new Set(["completed", "waived", "not_applicable"]);
const REVIEWING = new Set(["submitted", "under_review"]);

export function isImmunizationRequirement(item: StudentRequirementDetail) {
  return (
    item.code === "immunization_record" ||
    item.slug.includes("immunization") ||
    item.documentCategory === "health"
  );
}

/** The documents sent for this requirement, oldest first. */
export function recordDocuments(
  requirement: StudentRequirementDetail | null,
  documents: readonly StudentDocument[],
): StudentDocument[] {
  if (!requirement) return [];
  return documents
    .filter(
      (document) =>
        document.requirementId === requirement.id ||
        (!document.requirementId && document.category === "health"),
    )
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function latestDocument(documents: readonly StudentDocument[]) {
  return documents.length > 0 ? documents[documents.length - 1] : null;
}

export function documentOutcome(document: StudentDocument): RecordState {
  switch (document.status) {
    case "placeholder":
    case "processing":
      return "checking";
    case "accepted":
    case "waived":
      return "accepted";
    case "rejected":
    case "needs_resubmission":
      return "changes-requested";
    default:
      return "in-review";
  }
}

export function stateOf(
  requirement: StudentRequirementDetail,
  documents: readonly StudentDocument[],
): RecordState {
  if (SETTLED.has(requirement.status)) return "accepted";
  if (requirement.status === "rejected") return "changes-requested";
  if (requirement.status === "blocked") return "blocked";
  const last = latestDocument(documents);
  if (last) return documentOutcome(last);
  if (REVIEWING.has(requirement.status)) return "in-review";
  return "needed";
}

export function stateInfo(state: RecordState) {
  return RECORD_STATES[state];
}

export function officeName(requirement: StudentRequirementDetail | null) {
  return requirement?.responsibleOffice?.trim() || "Health Services";
}

/** The decision that came back on the newest document, if one did. */
export function latestDecision(documents: readonly StudentDocument[]) {
  const last = latestDocument(documents);
  return last?.review ?? null;
}

export function shortDate(iso: string | null | undefined, tenant: TenantConfig) {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  return formatTenantDate(new Date(time), tenant, { month: "short", day: "numeric" });
}

export function longDate(iso: string | null | undefined, tenant: TenantConfig) {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  return formatTenantDate(new Date(time), tenant, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function daysLeft(iso: string | null | undefined) {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  return Math.ceil((time - Date.now()) / 86_400_000);
}

export function daysLabel(days: number | null) {
  if (days === null) return null;
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} overdue`;
  if (days === 0) return "due today";
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function fileSize(bytes: number) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** The step this record waits on while it is blocked, by title. */
export function dependencyTitles(
  requirement: StudentRequirementDetail,
  all: readonly StudentRequirementDetail[],
) {
  return requirement.dependencyCodes
    .map((code) => all.find((item) => item.code === code))
    .filter((item): item is StudentRequirementDetail => Boolean(item) && !SETTLED.has(item!.status));
}

/**
 * The record, as the panel and the card say it: the pill, the consequence and
 * the one line under the figure — H8's order.
 */
export function recordStanding({
  requirement,
  documents,
  all,
  unavailable,
  tenant,
}: {
  requirement: StudentRequirementDetail | null;
  documents: readonly StudentDocument[];
  all: readonly StudentRequirementDetail[];
  unavailable: boolean;
  tenant: TenantConfig;
}) {
  if (unavailable || !requirement) {
    return {
      state: null as RecordState | null,
      pill: null as { label: string; tone: PillTone; pulse: boolean } | null,
      consequence: null as string | null,
      figure: "—",
      line: requirement
        ? "Your record couldn’t be read just now, so nothing here is a claim about where it is."
        : "Nothing has been asked of you here. If a record is ever needed, it appears on this page.",
    };
  }

  const state = stateOf(requirement, documents);
  const info = stateInfo(state);
  const office = officeName(requirement);
  const due = shortDate(requirement.dueAt, tenant);
  const days = daysLabel(daysLeft(requirement.dueAt));
  const decision = latestDecision(documents);
  const deps = dependencyTitles(requirement, all);

  return {
    state,
    pill: { label: info.label, tone: info.tone, pulse: state === "checking" },
    consequence:
      info.holder === "you"
        ? requirement.blocking
          ? "Holds class registration"
          : null
        : state === "blocked"
          ? deps.length > 0
            ? `Opens once “${deps[0].title}” is complete`
            : "Opens once an earlier step is complete"
          : info.consequence,
    figure: null as string | null,
    line:
      info.holder === "you" || state === "blocked"
        ? due
          ? `${office} asks for it by ${due}${days ? ` · ${days}` : ""}`
          : null
        : state === "accepted"
          ? decision?.decidedAt
            ? `Accepted ${shortDate(decision.decidedAt, tenant)} by ${office}`
            : `Accepted by ${office}`
          : state === "checking"
            ? null
            : `With ${office} since your last upload`,
  };
}

export type AccommodationAnswer = { value: "yes" | "no"; on: string | null; where: string } | null;

/**
 * The accommodation answer the backend holds: `accommodationInterest` on the
 * onboarding record. `not_now` reads as *not right now*; any interest reads as
 * *asked to talk*. Never answered is the one open condition.
 */
export function accommodationAnswer(
  onboarding: StudentOnboarding | null,
  tenant: TenantConfig,
): AccommodationAnswer {
  const interest = onboarding?.data.accommodationInterest;
  if (!interest) return null;
  return {
    value: interest === "not_now" ? "no" : "yes",
    on: shortDate(onboarding?.completedAt ?? onboarding?.updatedAt ?? null, tenant),
    where: "onboarding",
  };
}

export function questionStanding({
  answer,
  unavailable,
}: {
  answer: AccommodationAnswer;
  unavailable: boolean;
}) {
  if (unavailable) {
    return {
      pill: null as { label: string; tone: PillTone } | null,
      consequence: "Your answer couldn’t be read just now.",
      where: "Open",
      foot: "Accessibility question: couldn’t be read just now.",
    };
  }
  if (!answer) {
    return {
      pill: { label: "Not answered", tone: "quiet" as PillTone },
      consequence: "Optional. Nothing happens until you answer.",
      where: "See the question",
      foot: "Accessibility question: not answered · Optional. Nothing happens until you answer.",
    };
  }
  return {
    pill: { label: "Answered", tone: "done" as PillTone },
    consequence: null,
    where: "See your answer",
    foot: "Accessibility question: answered.",
  };
}

/** The page's one band — H6. */
export function bandFor({
  state,
  answer,
  gating,
  office,
  unavailable,
}: {
  state: RecordState | null;
  answer: AccommodationAnswer;
  gating: boolean;
  office: string;
  unavailable: boolean;
}): { kind: "record" | "question"; icon: string; label: string } | null {
  if (unavailable || !state) return null;
  if (state === "changes-requested") {
    return { kind: "record", icon: "alert", label: `One file came back from ${office}` };
  }
  if (state === "needed") {
    return {
      kind: "record",
      icon: "flag",
      label: gating ? "Class registration is waiting on this" : "A record still to send",
    };
  }
  if (!answer) {
    return { kind: "question", icon: "spark", label: "There’s one optional question left" };
  }
  return null;
}

export const ACCOMMODATION_QUESTION = {
  title: "Would you like to talk to Accessibility Services?",
  lede: "They set up things like extra time, note-taking, accessible rooms, and flexible attendance. It’s a conversation, not an application. You don’t have to explain anything to start it.",
  seenBy: "Accessibility Services sees this. Your instructors and your advisor don’t.",
  collects: "{institution} isn’t asking what your condition is, and this page has nowhere to put it.",
};

export const ACCOMMODATION_ANSWERS = [
  {
    id: "yes" as const,
    label: "Yes, I’d like to talk",
    said: "You asked to talk to Accessibility Services",
    next: "Accessibility Services has your name. Nothing’s pending on you, and they set up anything you agree on before your first classes.",
  },
  {
    id: "no" as const,
    label: "Not right now",
    said: "You said not right now",
    next: "This is a complete answer. Nothing’s pending and nobody’s waiting on you.",
  },
];
