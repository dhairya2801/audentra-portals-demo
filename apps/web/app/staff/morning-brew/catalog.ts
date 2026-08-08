import type {
  BrewConnector,
  BrewConnectorId,
  BrewDeliveryTime,
  BrewDepthOption,
  BrewSectionId,
  BrewSectionOption,
  BrewTeam,
  BrewTeamId,
  BrewTimeframeId,
  BrewToneOption,
} from "./types";

/**
 * The demo reader. Everything pre-selected during onboarding is justified
 * against this role so the first screen feels personal rather than generic.
 */
export const BREW_READER_ROLE = "Executive Director of Financial Aid";

export const BREW_TEAMS: BrewTeam[] = [
  {
    id: "financial_aid",
    title: "Financial Aid & Scholarships",
    lead: "Your team",
    description: "FAFSA and verification throughput, packaging, appeals, and affordability pressure.",
    icon: "◆",
    accent: "purple",
    recommended: true,
    recommendation: "You lead this team",
  },
  {
    id: "admissions",
    title: "Admissions & Enrollment",
    lead: "Dana Whitfield, AVP",
    description: "Applications, admits, deposits, yield, and the segments moving the funnel.",
    icon: "▲",
    accent: "blue",
    recommended: true,
    recommendation: "Aid decisions move yield",
  },
  {
    id: "student_success",
    title: "Student Success & Retention",
    lead: "Marcus Bell, Dean",
    description: "Melt risk, advising touchpoints, early alerts, and persistence signals.",
    icon: "◇",
    accent: "teal",
    recommended: true,
    recommendation: "Aid gaps surface here",
  },
  {
    id: "housing",
    title: "Housing & Residence Life",
    lead: "Elena Ruiz, Director",
    description: "Contracts, room selection, deposits held, and residency blockers.",
    icon: "⌂",
    accent: "amber",
    recommended: false,
    recommendation: "Deposit-to-bed visibility",
  },
  {
    id: "registrar",
    title: "Registrar & Academic Records",
    lead: "Sam Oduya, Registrar",
    description: "Transcripts, registration holds, credit evaluation, and census reporting.",
    icon: "▤",
    accent: "navy",
    recommended: false,
    recommendation: "Holds and census dates",
  },
];

export const BREW_CONNECTORS: BrewConnector[] = [
  {
    id: "outlook",
    title: "Email",
    vendor: "Microsoft Outlook",
    description: "Priya Shah · aster.example.edu",
    unlocks: "Adds the Email Highlights panel and lets Edward draft replies.",
    icon: "✉",
    optional: true,
  },
  {
    id: "calendar",
    title: "Calendar",
    vendor: "Outlook Calendar",
    description: "Work calendar and shared enrollment calendars",
    unlocks: "Adds Today's Calendar with agendas and prep notes.",
    icon: "▦",
    optional: true,
  },
  {
    id: "teams",
    title: "Chat",
    vendor: "Microsoft Teams",
    description: "Financial Aid Ops and Enrollment Leadership channels",
    unlocks: "Surfaces decisions waiting on you in team channels.",
    icon: "◍",
    optional: true,
  },
  {
    id: "analytics",
    title: "Reporting",
    vendor: "Tableau · Institutional Research",
    description: "Fall 2026 enrollment and net tuition workbooks",
    unlocks: "Deepens Enrollment Pulse with target pacing and segments.",
    icon: "◫",
    optional: true,
  },
  {
    id: "sis",
    title: "Student Information System",
    vendor: "Audentra workspace",
    description: "Cohort, journeys, tasks, and risk signals",
    unlocks: "Always on — this is the source behind your live workspace numbers.",
    icon: "A",
    optional: false,
  },
];

export const BREW_DEPTH_OPTIONS: BrewDepthOption[] = [
  {
    id: "headlines",
    title: "Just the headlines",
    description: "Two insights, six numbers, and anything that needs a decision today.",
    readTime: "~2 min read",
    storyCount: 2,
  },
  {
    id: "balanced",
    title: "Balanced",
    description: "The full morning read: insights with impact, the pulse, and your day.",
    readTime: "~4 min read",
    storyCount: 3,
  },
  {
    id: "deep",
    title: "Deep dive",
    description: "Everything above plus supporting drivers, segments, and secondary signals.",
    readTime: "~7 min read",
    storyCount: 5,
  },
];

export const BREW_TONE_OPTIONS: BrewToneOption[] = [
  {
    id: "executive",
    title: "Executive",
    description: "Numbers first, short sentences, decision framed up front.",
    sample: "Deposit pace is 6.4% behind. $1.8M of net tuition is exposed. Act on 312 aid-incomplete admits.",
  },
  {
    id: "narrative",
    title: "Narrative",
    description: "A little more context on why the number moved and what it means.",
    sample: "Commuter deposits slowed after the verification backlog grew, putting roughly $1.8M of net tuition at risk this month.",
  },
];

export const BREW_SECTION_OPTIONS: BrewSectionOption[] = [
  {
    id: "insights",
    title: "Emerging AI insights",
    description: "Patterns Audentra found overnight, with projected impact and a recommended action.",
    icon: "✦",
  },
  {
    id: "pulse",
    title: "Enrollment pulse",
    description: "Live KPI board with yesterday, week, month, and year-over-year comparisons.",
    icon: "◈",
  },
  {
    id: "changes",
    title: "Since yesterday",
    description: "What actually moved in the last 24 hours across your teams.",
    icon: "↻",
  },
  {
    id: "priorities",
    title: "Today's priorities",
    description: "The short list of things only you can unblock today.",
    icon: "⚑",
  },
  {
    id: "news",
    title: "Higher ed news",
    description: "Industry, policy, and research stories filtered for institutional relevance.",
    icon: "◎",
  },
];

export const BREW_DELIVERY_TIMES: { id: BrewDeliveryTime; label: string; caption: string }[] = [
  { id: "06:00", label: "6:00 AM", caption: "Before the commute" },
  { id: "06:30", label: "6:30 AM", caption: "Early desk time" },
  { id: "07:00", label: "7:00 AM", caption: "Most common" },
  { id: "07:30", label: "7:30 AM", caption: "Ahead of stand-up" },
];

export const BREW_TIMEFRAMES: { id: BrewTimeframeId; label: string; short: string }[] = [
  { id: "yesterday", label: "Yesterday", short: "1D" },
  { id: "week", label: "This week", short: "1W" },
  { id: "month", label: "This month", short: "1M" },
  { id: "year", label: "vs Last year", short: "1Y" },
];

export const DEFAULT_BREW_TEAMS: BrewTeamId[] = BREW_TEAMS.filter((team) => team.recommended).map(
  (team) => team.id,
);

export const DEFAULT_BREW_CONNECTORS: Record<BrewConnectorId, boolean> = {
  outlook: true,
  calendar: true,
  teams: false,
  analytics: false,
  sis: true,
};

export const DEFAULT_BREW_SECTIONS: Record<BrewSectionId, boolean> = {
  insights: true,
  pulse: true,
  changes: true,
  priorities: true,
  news: true,
};

export const BREW_CONNECTOR_IDS: BrewConnectorId[] = BREW_CONNECTORS.map((connector) => connector.id);
export const BREW_SECTION_IDS: BrewSectionId[] = BREW_SECTION_OPTIONS.map((section) => section.id);
export const BREW_TEAM_IDS: BrewTeamId[] = BREW_TEAMS.map((team) => team.id);

export const teamById = (id: BrewTeamId) => BREW_TEAMS.find((team) => team.id === id);
