import type {
  HousingPreference,
  StudentHousingPlan,
  StudentHousingResidence,
  StudentOnboarding,
  StudentRequirementDetail,
} from "@vv/contracts";
import { formatTenantDate, type TenantConfig } from "../lib/tenant";

/**
 * The rules that keep the two housing questions apart — the reference
 * `features/housing/logic.js`, read against the production record: the plan
 * (`getStudentHousingPlan`), its ordered `residencePreferences`, the published
 * residence catalogue, and the housing step's deadline on the checklist.
 */

export const SHORTLIST_MAX = 3;

export type PlanOption = {
  id: HousingPreference;
  label: string;
  hint: string;
  consequence: string;
  complete: boolean;
};

export function planOptions(deadline: string | null): PlanOption[] {
  const until = deadline ? ` until ${deadline}` : "";
  return [
    {
      id: "on_campus",
      label: "Living on campus",
      hint: "Rank the residence halls you would like. Residential Life assigns your room.",
      consequence: `Your enrollment checklist reads this same answer, and you can rank residence halls below${until}.`,
      complete: true,
    },
    {
      id: "commuting",
      label: "Commuting",
      hint: "You will live at home and travel in. No residence hall to rank.",
      consequence: "Your enrollment checklist reads this same answer. This is a complete answer.",
      complete: true,
    },
    {
      id: "off_campus",
      label: "Arranging my own housing",
      hint: "You will rent near campus yourself. Nothing further is needed.",
      consequence:
        "Your enrollment checklist reads this same answer. This is a complete answer, and nothing about housing stays open.",
      complete: true,
    },
    {
      id: "family",
      label: "Living with family",
      hint: "You will live with family while you study. No residence hall to rank.",
      consequence: "Your enrollment checklist reads this same answer. This is a complete answer.",
      complete: true,
    },
    {
      id: "undecided",
      label: "I need help deciding",
      hint: "Residential Life will help you decide. Your plan stays open.",
      consequence: `Nothing is recorded as your plan yet. Residential Life will help you decide, and you can still answer any time${until}.`,
      complete: false,
    },
  ];
}

export function planById(id: HousingPreference | null, deadline: string | null) {
  return planOptions(deadline).find((option) => option.id === id) ?? null;
}

export function planIsAnswered(plan: HousingPreference | null) {
  return Boolean(plan) && plan !== "undecided";
}

export function opensShortlist(plan: HousingPreference | null) {
  return plan === "on_campus";
}

export function showsCatalogue(plan: HousingPreference | null) {
  return plan === "on_campus" || plan === "undecided";
}

export function shortlistState(shortlist: readonly string[]) {
  if (shortlist.length === 0) return "none";
  return shortlist.length >= SHORTLIST_MAX ? "complete" : "partial";
}

export function ordinal(index: number) {
  return `${["1st", "2nd", "3rd"][index] ?? `${index + 1}th`} preference`;
}

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export type ResidenceImage = { src: string; alt: string; caption: string | null } | null;

export function residenceImage(residence: StudentHousingResidence): ResidenceImage {
  if (!residence.imageUrl) return null;
  return {
    src: residence.imageUrl,
    alt: residence.imageAlt ?? "",
    caption: residence.attribution || null,
  };
}

export function residenceById(catalogue: readonly StudentHousingResidence[], value: string) {
  return catalogue.find((item) => item.value === value) ?? null;
}

/** The ordered shortlist the backend holds. `residenceOption` alone reads as a one-item list. */
export function shortlistOf(plan: StudentHousingPlan | null) {
  if (!plan) return [] as string[];
  if (plan.residencePreferences && plan.residencePreferences.length > 0) return [...plan.residencePreferences];
  return plan.residenceOption ? [plan.residenceOption] : [];
}

export function housingRequirement(items: readonly StudentRequirementDetail[]) {
  return items.find((item) => item.code === "housing_preference" || item.code.includes("housing")) ?? null;
}

export function shortDate(iso: string | null | undefined, tenant: TenantConfig) {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  return formatTenantDate(new Date(time), tenant, { month: "short", day: "numeric" });
}

export function fullDate(iso: string | null | undefined, tenant: TenantConfig) {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  return formatTenantDate(new Date(time), tenant, {
    month: "short",
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

export type Deadline = { label: string; full: string; daysLeft: number } | null;

export function deadlineOf(requirement: StudentRequirementDetail | null, tenant: TenantConfig): Deadline {
  const label = shortDate(requirement?.dueAt, tenant);
  const full = fullDate(requirement?.dueAt, tenant);
  const days = daysLeft(requirement?.dueAt);
  if (!label || !full || days === null) return null;
  return { label, full, daysLeft: days };
}

function untilLine(deadline: Deadline) {
  if (!deadline) return null;
  if (deadline.daysLeft < 0) return `${deadline.label} · that date has passed`;
  if (deadline.daysLeft === 0) return `${deadline.label} · due today`;
  return `${deadline.label} · ${deadline.daysLeft} ${deadline.daysLeft === 1 ? "day" : "days"}`;
}

export function planSourceOf(plan: HousingPreference | null, onboarding: StudentOnboarding | null) {
  if (!plan || !onboarding?.completedAt) return "portal" as const;
  return onboarding.data.housingPreference === plan ? ("onboarding" as const) : ("portal" as const);
}

export type Tone = "act" | "wait" | "progress" | "done" | "stop" | "quiet";

/** What the page is asking of her, said once, in the summary panel (G4). */
export function planStanding({
  plan,
  source,
  deadline,
}: {
  plan: HousingPreference | null;
  source: "onboarding" | "portal";
  deadline: Deadline;
}): { status: string; tone: Tone; line: string | null; asking: boolean } {
  const until = untilLine(deadline);
  if (planIsAnswered(plan)) {
    return source === "onboarding"
      ? {
          status: "Recorded at onboarding",
          tone: "done",
          line: until ? `Nothing is being asked of you here. You can change it until ${until}.` : "Nothing is being asked of you here. You can change it any time.",
          asking: false,
        }
      : {
          status: "Recorded",
          tone: "done",
          line: until ? `Yours to change until ${until}.` : "Yours to change any time.",
          asking: false,
        };
  }
  if (plan === "undecided") {
    return {
      status: "On your checklist",
      tone: "wait",
      line: until ? `Residential Life will help you decide. Due ${until}.` : "Residential Life will help you decide.",
      asking: true,
    };
  }
  return {
    status: "On your checklist",
    tone: "wait",
    line: until ? `You skipped this while accepting your offer. Due ${until}.` : "You skipped this while accepting your offer.",
    asking: true,
  };
}

export function rankedLine(plan: HousingPreference | null, shortlist: readonly string[]) {
  return opensShortlist(plan) ? `${shortlist.length} of ${SHORTLIST_MAX} residences ranked` : null;
}

export type Band = {
  kind: "retry" | "plan" | "shortlist";
  icon: string;
  label: string;
  action: { label: string; icon?: string };
} | null;

/** The band — G7. */
export function bandFor({
  plan,
  shortlist,
  catalogueCount,
  deadline,
  failure,
}: {
  plan: HousingPreference | null;
  shortlist: readonly string[];
  catalogueCount: number;
  deadline: Deadline;
  failure: string | null;
}): Band {
  if (failure) {
    return {
      kind: "retry",
      icon: "alert",
      label: "Residential Life didn’t accept that change",
      action: { label: "Try again", icon: "refresh" },
    };
  }
  if (!planIsAnswered(plan)) {
    return {
      kind: "plan",
      icon: "flag",
      label: deadline ? `Your housing plan is due ${deadline.label}` : "Your housing plan is still open",
      action: { label: "Choose your plan" },
    };
  }
  if (opensShortlist(plan) && shortlistState(shortlist) !== "complete" && catalogueCount > 0) {
    return {
      kind: "shortlist",
      icon: "spark",
      label: `You’ve ranked ${shortlist.length} of ${SHORTLIST_MAX} residences`,
      action: { label: "Rank residences" },
    };
  }
  return null;
}

/* ---- the compare view's filters ---------------------------------------------------- */

/**
 * The catalogue the backend publishes carries a description and amenities and
 * no rate, room type or walk — so the one filter a card's attributes can back
 * is the amenity. The rule is the reference's: no filter returns nothing.
 */
export type Filters = { amenity: string | null };
export const NO_FILTERS: Filters = { amenity: null };

export function amenityOptions(catalogue: readonly StudentHousingResidence[]) {
  const seen = new Map<string, number>();
  for (const residence of catalogue) {
    for (const amenity of residence.amenities) {
      seen.set(amenity, (seen.get(amenity) ?? 0) + 1);
    }
  }
  return [...seen.keys()].sort((a, b) => a.localeCompare(b));
}

export function matchesFilters(residence: StudentHousingResidence, { amenity }: Filters) {
  if (amenity && !residence.amenities.includes(amenity)) return false;
  return true;
}

export function filterCatalogue(catalogue: readonly StudentHousingResidence[], filters: Filters) {
  return catalogue.filter((residence) => matchesFilters(residence, filters));
}

export function countWith(
  catalogue: readonly StudentHousingResidence[],
  filters: Filters,
  key: keyof Filters,
  value: string,
) {
  return filterCatalogue(catalogue, { ...filters, [key]: value }).length;
}

export function activeFilterCount(filters: Filters) {
  return Object.values(filters).filter(Boolean).length;
}
