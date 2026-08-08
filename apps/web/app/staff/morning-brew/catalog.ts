import type {
  BrewDeliveryTime,
  BrewDepthOption,
  BrewInclude,
  BrewIncludeId,
  BrewInsightDetailId,
  BrewInboxDepthId,
  BrewPulseDefault,
  BrewTopic,
  BrewTopicId,
  BrewTimeframeId,
  BrewToneOption,
} from "./types";

/**
 * The demo reader. What we pre-select on the first screen is justified against
 * this role, so the setup reads like it already knows who is sitting there.
 */
export const BREW_READER_ROLE = "Executive Director of Financial Aid";

export const BREW_TOPICS: BrewTopic[] = [
  {
    id: "financial_aid",
    title: "Financial aid",
    blurb: "Where families are getting stuck, and how fast we're clearing it.",
    preview: "Verification waits · appeals · packaging pace",
    icon: "◆",
    accent: "purple",
    recommended: true,
    recommendation: "You run this one",
  },
  {
    id: "admissions",
    title: "Admissions & enrollment",
    blurb: "Who's applying, who's saying yes, and who's still deciding.",
    preview: "Applications · deposits · yield",
    icon: "▲",
    accent: "blue",
    recommended: true,
    recommendation: "Your aid calls move these",
  },
  {
    id: "student_success",
    title: "Student success",
    blurb: "Students who've committed but haven't quite landed yet.",
    preview: "Melt risk · advising · orientation",
    icon: "◇",
    accent: "teal",
    recommended: true,
    recommendation: "Aid gaps show up here first",
  },
  {
    id: "housing",
    title: "Housing",
    blurb: "Rooms, contracts, and anything blocking a student from moving in.",
    preview: "Contracts · room selection · blockers",
    icon: "⌂",
    accent: "amber",
    recommended: false,
    recommendation: "Good for deposit-to-bed visibility",
  },
  {
    id: "registrar",
    title: "Records & registration",
    blurb: "Transcripts, holds, and the paperwork that quietly stalls people.",
    preview: "Transfer credit · holds · census",
    icon: "▤",
    accent: "navy",
    recommended: false,
    recommendation: "Handy around census dates",
  },
];

/**
 * What the reader wants pulled into their morning. Some of these reach into the
 * day around them (inbox, calendar); the rest are things Audentra assembles.
 */
export const BREW_INCLUDES: BrewInclude[] = [
  {
    id: "inbox",
    title: "Your inbox",
    blurb: "We'll pull out the handful of messages that actually need you, and leave the rest alone.",
    source: "Outlook · priya.shah@aster.example.edu",
    icon: "✉",
    accent: "blue",
    alwaysOn: false,
  },
  {
    id: "calendar",
    title: "Your calendar",
    blurb: "Today's meetings, each with a line on what you'd want to walk in knowing.",
    source: "Outlook Calendar",
    icon: "▦",
    accent: "teal",
    alwaysOn: false,
  },
  {
    id: "numbers",
    title: "The numbers you watch",
    blurb: "Applications, deposits, yield — compared however you like to look at them.",
    source: "Your workspace · Tableau",
    icon: "◈",
    accent: "purple",
    alwaysOn: false,
  },
  {
    id: "signals",
    title: "What we spot overnight",
    blurb: "Patterns worth a look, with what they might cost and what we'd do about it.",
    source: "Audentra",
    icon: "✦",
    accent: "purple",
    alwaysOn: false,
  },
  {
    id: "movements",
    title: "What moved since yesterday",
    blurb: "A short log of what actually changed while you were away.",
    source: "Audentra",
    icon: "↻",
    accent: "navy",
    alwaysOn: false,
  },
  {
    id: "headlines",
    title: "What the rest of higher ed is reading",
    blurb: "Headlines and newsletters, filtered down to the ones that touch your work.",
    source: "Publications and feeds you choose",
    icon: "◎",
    accent: "amber",
    alwaysOn: false,
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
    description: "All of it, plus the drivers and segments behind each number.",
    readTime: "about 7 minutes",
    storyCount: 5,
  },
];

export const BREW_TONE_OPTIONS: BrewToneOption[] = [
  {
    id: "executive",
    title: "Straight to the point",
    description: "Numbers first, short sentences, the decision up front.",
    sample: "Deposit pace is 6.4% behind. $1.8M is exposed. Clear 312 aid-incomplete files.",
  },
  {
    id: "narrative",
    title: "A bit more story",
    description: "A little context on why the number moved and what it means.",
    sample: "Commuter deposits slowed once the verification queue grew, putting about $1.8M at risk this month.",
  },
];

export const BREW_INBOX_DEPTHS: { id: BrewInboxDepthId; title: string; caption: string }[] = [
  { id: "urgent", title: "Only what's urgent", caption: "The two or three that can't wait" },
  { id: "handful", title: "A short list", caption: "Roughly four, ranked" },
  { id: "everything", title: "Everything worth a look", caption: "All flagged messages" },
];

export const BREW_PULSE_DEFAULTS: { id: BrewPulseDefault; label: string; caption: string }[] = [
  { id: "auto", label: "Cycle through", caption: "Rotates every few seconds" },
  { id: "yesterday", label: "Yesterday", caption: "Day over day" },
  { id: "week", label: "This week", caption: "Week over week" },
  { id: "month", label: "This month", caption: "Month over month" },
  { id: "year", label: "vs Last year", caption: "Same point last cycle" },
];

export const BREW_INSIGHT_DETAILS: { id: BrewInsightDetailId; title: string; caption: string }[] = [
  { id: "headline", title: "Just the headline", caption: "What we found, one line" },
  { id: "impact", title: "With the likely impact", caption: "Plus what it could cost" },
  { id: "full", title: "The full reasoning", caption: "Impact and what we'd do next" },
];

/** Publications and feeds the reader can pick from on the last screen. */
export const BREW_READING_SOURCES = [
  { id: "Inside Higher Ed", label: "Inside Higher Ed", kind: "Publication" },
  { id: "The Chronicle", label: "The Chronicle", kind: "Publication" },
  { id: "Higher Ed Dive", label: "Higher Ed Dive", kind: "Publication" },
  { id: "EAB", label: "EAB Research", kind: "Newsletter" },
  { id: "NASFAA", label: "NASFAA Today", kind: "Newsletter" },
  { id: "Federal Register", label: "Federal Register", kind: "Policy feed" },
] as const;

export const BREW_DELIVERY_TIMES: { id: BrewDeliveryTime; label: string; caption: string }[] = [
  { id: "06:00", label: "6:00 AM", caption: "Before the commute" },
  { id: "06:30", label: "6:30 AM", caption: "Early desk time" },
  { id: "07:00", label: "7:00 AM", caption: "Most people pick this" },
  { id: "07:30", label: "7:30 AM", caption: "Just before stand-up" },
];

export const BREW_TIMEFRAMES: { id: BrewTimeframeId; label: string; short: string }[] = [
  { id: "yesterday", label: "Yesterday", short: "1D" },
  { id: "week", label: "This week", short: "1W" },
  { id: "month", label: "This month", short: "1M" },
  { id: "year", label: "vs Last year", short: "1Y" },
];

/* ----------------------------------------------------------------- defaults */

export const DEFAULT_BREW_TOPICS: BrewTopicId[] = BREW_TOPICS.filter((topic) => topic.recommended).map(
  (topic) => topic.id,
);

export const DEFAULT_BREW_INCLUDES: Record<BrewIncludeId, boolean> = {
  inbox: true,
  calendar: true,
  numbers: true,
  signals: true,
  movements: true,
  headlines: true,
};

export const DEFAULT_READING_SOURCES: string[] = BREW_READING_SOURCES.map((source) => source.id);

export const BREW_INCLUDE_IDS: BrewIncludeId[] = BREW_INCLUDES.map((include) => include.id);
export const BREW_TOPIC_IDS: BrewTopicId[] = BREW_TOPICS.map((topic) => topic.id);

export const topicById = (id: BrewTopicId) => BREW_TOPICS.find((topic) => topic.id === id);
export const includeById = (id: BrewIncludeId) => BREW_INCLUDES.find((include) => include.id === id);
