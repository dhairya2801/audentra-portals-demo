import type {
  BrewDeliveryTime,
  BrewDepthOption,
  BrewInclude,
  BrewIncludeId,
  BrewInsightDetailId,
  BrewRequestDepthId,
  BrewTimeframeId,
  BrewToneOption,
  BrewTopic,
  BrewTopicId,
} from "./types";

/**
 * What the reader can choose, and what each choice actually shows.
 *
 * Every entry here names a canonical record type rather than a vendor. The
 * earlier catalogue offered an Outlook inbox, a calendar, and a news feed; the
 * platform has none of those, so the same slots now carry the real inbound
 * channel (student support conversations) and the real dated obligations
 * (requirement due dates and offer response deadlines).
 */

export const BREW_TOPICS: BrewTopic[] = [
  {
    id: "financial_aid",
    title: "Financial aid",
    blurb: "Where aid files are stuck, and who is waiting on whom.",
    preview: "Aid documents · verification · action required",
    icon: "◆",
    accent: "purple",
    recommended: true,
    recommendation: "Aid blocks the most enrollment steps",
  },
  {
    id: "admissions",
    title: "Admissions & enrollment",
    blurb: "Who was offered, who accepted, and who has actually deposited.",
    preview: "Offers · acceptances · deposits",
    icon: "▲",
    accent: "blue",
    recommended: true,
    recommendation: "The funnel your team is measured on",
  },
  {
    id: "student_success",
    title: "Student progress",
    blurb: "Students who committed but are still blocked or overdue.",
    preview: "Blockers · overdue work · support requests",
    icon: "◇",
    accent: "teal",
    recommended: true,
    recommendation: "Where a deposit quietly stops converting",
  },
  {
    id: "housing",
    title: "Housing",
    blurb: "The housing step, and anything holding it closed.",
    preview: "Selected · actionable · blocked",
    icon: "⌂",
    accent: "amber",
    recommended: false,
    recommendation: "Good for deposit-to-bed visibility",
  },
  {
    id: "registrar",
    title: "Records & documents",
    blurb: "Transcripts and the documents waiting on a decision.",
    preview: "Transcripts · uploads · reviews",
    icon: "▤",
    accent: "navy",
    recommended: false,
    recommendation: "Handy when the review queue backs up",
  },
];

export const BREW_INCLUDES: BrewInclude[] = [
  {
    id: "numbers",
    title: "The enrollment funnel",
    blurb: "Offers, acceptances, deposits, and what share of each stage converts.",
    source: "Offers, payments, and journeys in your Audentra database",
    icon: "◈",
    accent: "purple",
  },
  {
    id: "signals",
    title: "What needs attention",
    blurb: "The cohorts that are stuck, why they are stuck, and who owns the fix.",
    source: "Requirements, documents, and aid records",
    icon: "✦",
    accent: "purple",
  },
  {
    id: "movements",
    title: "What changed overnight",
    blurb: "Deposits, acceptances, uploads, and staff work recorded in the last 24 hours.",
    source: "Canonical record timestamps",
    icon: "↻",
    accent: "navy",
  },
  {
    id: "deadlines",
    title: "Deadlines ahead",
    blurb: "Requirement due dates and offer response deadlines, with who they affect.",
    source: "Requirement due dates and admission offers",
    icon: "▦",
    accent: "teal",
  },
  {
    id: "requests",
    title: "Student requests",
    blurb: "The support conversations waiting on a reply from your team.",
    source: "Student support conversations",
    icon: "✉",
    accent: "blue",
  },
];

/* ------------------------------------------------------- step three follow-ups */

export const BREW_DEPTH_OPTIONS: BrewDepthOption[] = [
  {
    id: "headlines",
    title: "Quick scan",
    description: "The two things that matter and the numbers. Nothing else.",
    readTime: "about 2 minutes",
    storyCount: 2,
  },
  {
    id: "balanced",
    title: "The usual",
    description: "Enough to walk into a meeting without opening anything else.",
    readTime: "about 4 minutes",
    storyCount: 3,
  },
  {
    id: "deep",
    title: "Give me everything",
    description: "All of it, plus the cohorts and evidence behind each number.",
    readTime: "about 6 minutes",
    storyCount: 4,
  },
];

export const BREW_TONE_OPTIONS: BrewToneOption[] = [
  {
    id: "executive",
    title: "Straight to the point",
    description: "The counted facts, in one line each.",
    sample: "4 deposits posted in the last 24 hours.",
  },
  {
    id: "narrative",
    title: "A bit more context",
    description: "The same facts, with the cohort they describe spelled out.",
    sample:
      "4 deposits posted in the last 24 hours, taking the deposited group to 9 of 11 accepted students.",
  },
];

export const BREW_REQUEST_DEPTHS: {
  id: BrewRequestDepthId;
  title: string;
  caption: string;
}[] = [
  { id: "urgent", title: "Only what's urgent", caption: "The two or three that can't wait" },
  { id: "handful", title: "A short list", caption: "Roughly four, longest wait first" },
  { id: "everything", title: "Everything open", caption: "All active conversations" },
];

export const BREW_INSIGHT_DETAILS: {
  id: BrewInsightDetailId;
  title: string;
  caption: string;
}[] = [
  { id: "headline", title: "Just the headline", caption: "What we found, one line" },
  { id: "impact", title: "With the affected cohort", caption: "Plus how many students" },
  { id: "full", title: "The full reasoning", caption: "Cohort and what we'd do next" },
];

export const BREW_DELIVERY_TIMES: { id: BrewDeliveryTime; label: string; caption: string }[] = [
  { id: "06:00", label: "6:00 AM", caption: "Before the commute" },
  { id: "06:30", label: "6:30 AM", caption: "Early desk time" },
  { id: "07:00", label: "7:00 AM", caption: "Most people pick this" },
  { id: "07:30", label: "7:30 AM", caption: "Just before stand-up" },
];

/**
 * Fallback comparison windows. The live list comes from the API, which only
 * declares windows it can actually reconstruct — there is no week, month, or
 * year here because the platform keeps no end-of-period snapshot.
 */
export const BREW_TIMEFRAMES: { id: BrewTimeframeId; label: string; short: string }[] = [
  { id: "now", label: "Now", short: "NOW" },
  { id: "day", label: "Last 24 hours", short: "24H" },
];

/* ----------------------------------------------------------------- defaults */

export const DEFAULT_BREW_TOPICS: BrewTopicId[] = BREW_TOPICS.filter(
  (topic) => topic.recommended,
).map((topic) => topic.id);

export const DEFAULT_BREW_INCLUDES: Record<BrewIncludeId, boolean> = {
  requests: true,
  deadlines: true,
  numbers: true,
  signals: true,
  movements: true,
};

export const BREW_INCLUDE_IDS: BrewIncludeId[] = BREW_INCLUDES.map((include) => include.id);
export const BREW_TOPIC_IDS: BrewTopicId[] = BREW_TOPICS.map((topic) => topic.id);

export const topicById = (id: BrewTopicId) => BREW_TOPICS.find((topic) => topic.id === id);
export const includeById = (id: BrewIncludeId) =>
  BREW_INCLUDES.find((include) => include.id === id);
