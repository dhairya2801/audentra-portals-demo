import type {
  OnboardingEmergencyContact,
  OnboardingStep,
  StudentDocument,
  StudentOnboarding,
  StudentOnboardingData,
} from "@vv/contracts";

/**
 * The ten screens of first-time onboarding, and how they read the platform's
 * eight-step record.
 *
 * The platform owns progress. `StudentOnboarding.currentStep`,
 * `completedSteps` and `data.skippedSteps` are the only facts about what is
 * done, and every reading below is a function of them. The browser adds two
 * things the record has no column for — that *Confirm your details* was
 * finished before *How we reach you* wrote `about_you`, and whether the
 * optional photo was sent or set aside — and keeps both in `sessionStorage`,
 * named as local, never claimed as saved on the server.
 *
 * Screen order follows step order because the platform refuses a step saved
 * out of sequence (`ONBOARDING_STEP_OUT_OF_ORDER`). Two screens share
 * `about_you`; one screen (`photo`) maps to no step and uploads a document.
 */
export type ScreenId =
  | "offer"
  | "details"
  | "contact"
  | "housing"
  | "health"
  | "emergency"
  | "permissions"
  | "photo"
  | "review"
  | "deposit";

export type Screen = {
  id: ScreenId;
  /** The platform step this screen writes. `null` for the photo. */
  step: OnboardingStep | null;
  icon: string;
  name: string;
  question: string;
  lede: string;
  /** `false` is the only thing that produces a skip control. */
  required: boolean;
  minutes: number;
};

export type ScreenCopyContext = {
  institution: string;
  deadline: string;
};

export function screensFor({ institution, deadline }: ScreenCopyContext): Screen[] {
  return [
    {
      id: "offer",
      step: "offer",
      icon: "award",
      name: "Your offer",
      question: `Your offer from ${institution}`,
      lede: `Read it, then tell ${institution} whether you are coming. Answer by ${deadline}.`,
      required: true,
      minutes: 2,
    },
    {
      id: "details",
      step: "about_you",
      icon: "profile",
      name: "Confirm your details",
      question: "Confirm your details",
      lede: `Check what ${institution} has. Add a preferred name if you want to, and send an ID.`,
      required: true,
      minutes: 3,
    },
    {
      id: "contact",
      step: "about_you",
      icon: "mail",
      name: `How ${institution} reaches you`,
      question: `How ${institution} reaches you`,
      lede: `Where ${institution} writes, and which way it writes first.`,
      required: true,
      minutes: 3,
    },
    {
      id: "housing",
      step: "housing",
      icon: "home",
      name: "Where you will live",
      question: "Where will you live?",
      lede: "Every answer here is a complete one. Only living on campus opens anything more.",
      required: true,
      minutes: 4,
    },
    {
      id: "health",
      step: "campus_life",
      icon: "accessibility",
      name: "Health and accessibility",
      question: "Would you like to talk to Accessibility Services?",
      lede: "Not right now is a complete answer. Nothing about your health is asked here.",
      required: true,
      minutes: 3,
    },
    {
      id: "emergency",
      step: "emergency_contacts",
      icon: "bell",
      name: "Emergency contact",
      question: `Who should ${institution} call in an emergency?`,
      lede: `One person ${institution} can reach if something happens to you on campus.`,
      required: true,
      minutes: 2,
    },
    {
      id: "permissions",
      step: "family_permissions",
      icon: "users",
      name: "Who can see your record",
      question: `Who can talk to ${institution} about you?`,
      lede: "Right now, nobody but you: your record is yours by law. Going on without adding anyone is a complete answer.",
      required: true,
      minutes: 4,
    },
    {
      id: "photo",
      step: null,
      icon: "card",
      name: "Your student photo",
      question: "Your student photo",
      lede: `Your campus card, and the class list your instructors see. Nothing else, and never outside ${institution}.`,
      required: false,
      minutes: 2,
    },
    {
      id: "review",
      step: "review_and_sign",
      icon: "pen",
      name: "Review and sign",
      question: "Review and sign",
      lede: `What you told ${institution}, and the document enrolling asks you to sign.`,
      required: true,
      minutes: 5,
    },
    {
      id: "deposit",
      step: "deposit",
      icon: "wallet",
      name: "Deposit",
      question: "Your enrollment deposit",
      lede: "The last step. It can be paid now, paid by the deadline, or waived.",
      required: true,
      minutes: 3,
    },
  ];
}

export const TOTAL_SCREENS = 10;

/* ------------------------------------------------------------------ *
 * What the browser keeps beside the record
 * ------------------------------------------------------------------ */

export type LocalProgress = {
  /** Screens finished in this browser that the platform has no column for. */
  done: ScreenId[];
  /** Optional screens set aside in this browser. */
  skipped: ScreenId[];
};

export type ContactDraft = {
  fullName: string;
  relationship: OnboardingEmergencyContact["relationship"] | "";
  mobilePhone: string;
  email: string;
};

export function emptyContact(): ContactDraft {
  return { fullName: "", relationship: "", mobilePhone: "", email: "" };
}

export function contactProblem(contact: ContactDraft, required: boolean) {
  const empty = !contact.fullName.trim() && !contact.mobilePhone.trim();
  if (empty) return required ? "Add one person to call." : null;
  if (!contact.fullName.trim()) return "Add their full name.";
  if (!contact.relationship) return "Say how they are related to you.";
  if (!contact.mobilePhone.trim()) return "Add a number to call.";
  if (contact.email.trim() && !contact.email.includes("@")) return "That email address is incomplete.";
  return null;
}

export type OnboardingDraft = {
  data: Partial<StudentOnboardingData>;
  pronouns?: string | null;
  contacts?: ContactDraft[];
  local: LocalProgress;
};

const DRAFT_VERSION = "v2";

function draftKey(studentId: string) {
  return `audentra:onboarding-draft:${DRAFT_VERSION}:${studentId}`;
}

export function emptyDraft(): OnboardingDraft {
  return { data: {}, local: { done: [], skipped: [] } };
}

export function readDraft(studentId: string): OnboardingDraft {
  try {
    const raw = window.sessionStorage.getItem(draftKey(studentId));
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    return {
      data: parsed.data ?? {},
      pronouns: parsed.pronouns,
      contacts: parsed.contacts,
      local: {
        done: parsed.local?.done ?? [],
        skipped: parsed.local?.skipped ?? [],
      },
    };
  } catch {
    return emptyDraft();
  }
}

export function writeDraft(studentId: string, draft: OnboardingDraft) {
  try {
    window.sessionStorage.setItem(draftKey(studentId), JSON.stringify(draft));
  } catch {
    // A browser that refuses storage still runs the flow; it only forgets the
    // in-between screen on reload, and the server copy is untouched.
  }
}

/* ------------------------------------------------------------------ *
 * Readings of the record
 * ------------------------------------------------------------------ */

export type FlowRecord = {
  completed: OnboardingStep[];
  skipped: OnboardingStep[];
  currentStep: OnboardingStep;
  offerAnswered: boolean;
  local: LocalProgress;
};

export function recordFrom(
  onboarding: StudentOnboarding,
  local: LocalProgress,
): FlowRecord {
  return {
    completed: onboarding.completedSteps,
    skipped: onboarding.data.skippedSteps ?? [],
    currentStep: onboarding.currentStep,
    offerAnswered: onboarding.completedSteps.includes("offer"),
    local,
  };
}

export function isSaved(screen: Screen, record: FlowRecord) {
  if (screen.id === "photo") return record.local.done.includes("photo");
  if (screen.id === "details") {
    return (
      record.completed.includes("about_you") || record.local.done.includes("details")
    );
  }
  return screen.step ? record.completed.includes(screen.step) && !record.skipped.includes(screen.step) : false;
}

export function isSkipped(screen: Screen, record: FlowRecord) {
  if (screen.id === "photo") return record.local.skipped.includes("photo");
  return screen.step ? record.skipped.includes(screen.step) : false;
}

export function isResolved(screen: Screen, record: FlowRecord) {
  return isSaved(screen, record) || isSkipped(screen, record);
}

/** Every screen after the first is locked until the offer is answered. */
export function isLocked(screen: Screen, record: FlowRecord) {
  return screen.id !== "offer" && !record.offerAnswered;
}

export const LOCK_REASON = "Opens once you have answered your offer";

export function firstUnresolved(screens: Screen[], record: FlowRecord): ScreenId {
  const open = screens.find(
    (screen) => !isResolved(screen, record) && !isLocked(screen, record),
  );
  if (open) return open.id;
  const locked = screens.find((screen) => !isResolved(screen, record));
  return locked ? locked.id : screens[screens.length - 1].id;
}

export type ScreenState =
  | "saved"
  | "skipped"
  | "current"
  | "locked"
  | "upcoming";

export function screenState(
  screen: Screen,
  record: FlowRecord,
  currentId: ScreenId | null,
): ScreenState {
  if (isSaved(screen, record)) return "saved";
  if (isSkipped(screen, record)) return "skipped";
  if (screen.id === currentId) return "current";
  if (isLocked(screen, record)) return "locked";
  return "upcoming";
}

/**
 * A screen opens when it is not locked and it is either resolved, the one
 * she is on, or the first thing still open. The platform enforces the same
 * rule for its steps; this is the same rule for screens.
 */
export function isReachable(
  screens: Screen[],
  screen: Screen,
  record: FlowRecord,
  currentId: ScreenId | null,
) {
  if (isLocked(screen, record)) return false;
  return (
    isResolved(screen, record) ||
    screen.id === currentId ||
    screen.id === firstUnresolved(screens, record)
  );
}

export function screenById(screens: Screen[], id: ScreenId) {
  return screens.find((screen) => screen.id === id) ?? null;
}

export function screenNumber(screens: Screen[], id: ScreenId) {
  return screens.findIndex((screen) => screen.id === id) + 1;
}

export function savedCount(screens: Screen[], record: FlowRecord) {
  return screens.filter((screen) => isSaved(screen, record)).length;
}

export function skippedCount(screens: Screen[], record: FlowRecord) {
  return screens.filter((screen) => isSkipped(screen, record)).length;
}

export function allResolved(screens: Screen[], record: FlowRecord) {
  return screens.every((screen) => isResolved(screen, record));
}

export function progressLine(
  screens: Screen[],
  record: FlowRecord,
  institution: string,
) {
  const skipped = skippedCount(screens, record);
  const left = TOTAL_SCREENS - savedCount(screens, record) - skipped;
  if (left === 0 && skipped === 0) return `Everything ${institution} asked for.`;
  const parts: string[] = [];
  if (skipped) parts.push(`${skipped} skipped`);
  parts.push(left === 0 ? "nothing left to do" : `${left} still to do`);
  return parts.join(" · ");
}

export function meter(screens: Screen[], record: FlowRecord) {
  return {
    saved: (savedCount(screens, record) / TOTAL_SCREENS) * 100,
    skipped: (skippedCount(screens, record) / TOTAL_SCREENS) * 100,
  };
}

export function railSteps(
  screens: Screen[],
  record: FlowRecord,
  currentId: ScreenId | null,
) {
  return screens.map((screen) => {
    const state = screenState(screen, record, currentId);
    const meta =
      state === "locked"
        ? LOCK_REASON
        : state === "upcoming"
          ? `${screen.minutes} min${screen.required ? "" : " · optional"}`
          : undefined;
    return {
      id: screen.id,
      name: screen.name,
      state,
      meta,
      faint: state === "upcoming",
      reachable:
        isReachable(screens, screen, record, currentId) && screen.id !== currentId,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Documents, read as a sentence
 * ------------------------------------------------------------------ */

export type DocumentLine = {
  tone: "quiet" | "working" | "done" | "alert";
  icon: string;
  text: string;
};

export function documentLine(
  document: StudentDocument | null,
  sentOn: string | null,
): DocumentLine | null {
  if (!document) return null;
  switch (document.status) {
    case "accepted":
    case "waived":
      return { tone: "done", icon: "check", text: `Accepted${sentOn ? `, sent ${sentOn}` : ""}.` };
    case "rejected":
    case "needs_resubmission":
      return {
        tone: "alert",
        icon: "alert",
        text:
          document.review?.note ??
          "It was sent back. Send a clearer copy, or ask for help from the rail.",
      };
    case "uploaded":
    case "processing":
    case "needs_review":
    case "under_review":
      return {
        tone: "working",
        icon: "clock",
        text: `Sent${sentOn ? ` ${sentOn}` : ""}. Nothing is needed from you while it is read.`,
      };
    default:
      return null;
  }
}

/** What a citizenship status decides about the identity document. */
export const CITIZENSHIP: Record<
  NonNullable<StudentOnboardingData["citizenshipStatus"]>,
  { label: string; documents: string; why: string; domestic: boolean }
> = {
  us_citizen: {
    label: "U.S. citizen",
    documents: "A passport or a driver’s license",
    why: "Either one proves both who you are and where you live.",
    domestic: true,
  },
  permanent_resident: {
    label: "U.S. permanent resident",
    documents: "A passport, a permanent resident card, or a driver’s license",
    why: "Any of these proves who you are; a license also proves where you live.",
    domestic: true,
  },
  eligible_noncitizen: {
    label: "Other eligible noncitizen",
    documents: "A passport or an immigration document",
    why: "It has to show the status that makes you eligible, so a driver’s license cannot stand in for it.",
    domestic: true,
  },
  international: {
    label: "International student",
    documents: "A passport",
    why: "An international student is verified against the passport, so a U.S. driver’s license cannot stand in for it.",
    domestic: false,
  },
};

export const RELATIONSHIPS: Array<{
  value: NonNullable<StudentOnboardingData["emergencyContacts"]>[number]["relationship"];
  label: string;
}> = [
  { value: "parent", label: "Parent" },
  { value: "guardian", label: "Guardian" },
  { value: "partner", label: "Spouse or partner" },
  { value: "sibling", label: "Sibling" },
  { value: "relative", label: "Relative" },
  { value: "friend", label: "Friend" },
  { value: "other", label: "Other" },
];

export const MAX_EMERGENCY_CONTACTS = 3;

export const RANK_NAMES = ["1st choice", "2nd choice", "3rd choice"];

export function listSentence(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Digits and a leading plus, the way the platform stores a mobile number. */
export function normalizedPhone(value: string) {
  const compact = value.replace(/[\s()-]/g, "");
  if (!compact) return "";
  return compact.startsWith("+") ? compact : `+${compact}`;
}

export const PHOTO_RULES = [
  "Face forward, with your whole face visible. Religious head coverings are fine.",
  "A plain wall behind you.",
  "Taken in the last six months.",
];
