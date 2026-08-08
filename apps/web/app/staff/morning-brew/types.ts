/**
 * Morning Brew — a personalized executive briefing for university leadership.
 *
 * The reader picks the university teams they own, connects day-to-day context
 * (mail, calendar, systems of record), and tunes how the brief is written. The
 * briefing builder then assembles only the sections that reader asked for.
 */

/** University teams a leader can follow. These map to real campus org units. */
export type BrewTeamId =
  | "financial_aid"
  | "admissions"
  | "housing"
  | "registrar"
  | "student_success";

export type BrewConnectorId = "outlook" | "calendar" | "sis" | "teams" | "analytics";

/** How much the reader wants in front of them each morning. */
export type BrewDepthId = "headlines" | "balanced" | "deep";

/** Voice of the generated prose. */
export type BrewToneId = "executive" | "narrative";

/** Optional sections the reader can keep or drop. */
export type BrewSectionId = "insights" | "pulse" | "changes" | "priorities" | "news";

export type BrewDeliveryTime = "06:00" | "06:30" | "07:00" | "07:30";

/** Comparison windows offered by the Enrollment Pulse carousel. */
export type BrewTimeframeId = "yesterday" | "week" | "month" | "year";

export type BrewSignalSource = "workspace" | "modeled" | "connected_demo";

/** Staff workspace views the briefing can hand the reader off to. */
export type MorningBrewDestination =
  | "overview"
  | "outreach"
  | "tasks"
  | "students"
  | "messages"
  | "campus_life"
  | "academics"
  | "journeys"
  | "knowledge"
  | "edward";

export interface BrewTeam {
  id: BrewTeamId;
  title: string;
  lead: string;
  description: string;
  icon: string;
  accent: "purple" | "blue" | "teal" | "navy" | "amber";
  /** Pre-selected for the demo reader (Executive Director of Financial Aid). */
  recommended: boolean;
  recommendation: string;
}

export interface BrewConnector {
  id: BrewConnectorId;
  title: string;
  vendor: string;
  description: string;
  unlocks: string;
  icon: string;
  /** Non-optional connectors ship with the workspace and cannot be turned off. */
  optional: boolean;
}

export interface BrewDepthOption {
  id: BrewDepthId;
  title: string;
  description: string;
  readTime: string;
  storyCount: number;
}

export interface BrewToneOption {
  id: BrewToneId;
  title: string;
  description: string;
  sample: string;
}

export interface BrewSectionOption {
  id: BrewSectionId;
  title: string;
  description: string;
  icon: string;
}

export interface BrewPreferences {
  version: 3;
  teams: BrewTeamId[];
  connectors: Record<BrewConnectorId, boolean>;
  depth: BrewDepthId;
  tone: BrewToneId;
  sections: Record<BrewSectionId, boolean>;
  deliveryTime: BrewDeliveryTime;
  onboardingComplete: boolean;
  updatedAt: string;
}

/* ------------------------------------------------------------------ content */

export interface BrewImpactChip {
  label: string;
  tone: "negative" | "positive" | "neutral";
}

export interface BrewInsightAction {
  title: string;
  detail: string;
  owner: string;
  due: string;
}

export interface BrewInsightStudent {
  name: string;
  program: string;
  note: string;
  risk: "critical" | "high" | "medium";
}

export interface BrewInsight {
  id: string;
  team: BrewTeamId;
  label: string;
  title: string;
  severity: "high" | "medium" | "positive";
  summary: string;
  projection: string;
  impactLabel: string;
  impact: BrewImpactChip[];
  recommendedAction: string;
  impactLevel: "High" | "Medium" | "Low";
  confidence: number;
  source: BrewSignalSource;
  destination?: MorningBrewDestination;
  detail: {
    narrative: string[];
    drivers: { label: string; value: string; note: string }[];
    trend: { label: string; value: number }[];
    trendUnit: string;
    actions: BrewInsightAction[];
    students: BrewInsightStudent[];
    evidence: string[];
  };
}

export type BrewNumberFormat = "int" | "percent" | "currencyM" | "currencyK";

export interface BrewKpiFrame {
  /** Raw number the ticker animates toward. */
  numeric: number;
  /** Window the value describes, e.g. "yesterday" or "cycle to date". */
  window: string;
  delta: string;
  direction: "up" | "down" | "flat";
  favorable: boolean;
  comparison: string;
  points: number[];
  target: string;
  targetProgress: number;
  note: string;
}

export interface BrewKpi {
  id: string;
  team: BrewTeamId;
  label: string;
  icon: string;
  format: BrewNumberFormat;
  source: BrewSignalSource;
  frames: Record<BrewTimeframeId, BrewKpiFrame>;
  detail: {
    definition: string;
    owner: string;
    updated: string;
    segments: { label: string; value: string; delta: string; favorable: boolean }[];
    history: { label: string; value: number; benchmark: number }[];
    historyUnit: string;
    notes: string[];
  };
}

export interface BrewChange {
  id: string;
  team: BrewTeamId;
  time: string;
  title: string;
  detail: string;
  tone: "positive" | "watch" | "neutral";
  source: BrewSignalSource;
  destination?: MorningBrewDestination;
  metric?: string;
}

export interface BrewMeeting {
  id: string;
  time: string;
  duration: string;
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
  attendees: string[];
  extraAttendees?: string;
  location: string;
  organizer: string;
  agenda: string[];
  prep: string[];
  destination?: MorningBrewDestination;
}

export interface BrewEmail {
  id: string;
  time: string;
  sender: string;
  senderRole: string;
  subject: string;
  summary: string;
  priority: "high" | "medium" | "low";
  team: BrewTeamId;
  body: string[];
  asks: string[];
  thread: { sender: string; time: string; excerpt: string }[];
  suggestedReply: { subject: string; greeting: string; body: string[]; signoff: string };
  destination?: MorningBrewDestination;
}

export interface BrewPriority {
  id: string;
  team: BrewTeamId;
  title: string;
  level: "High" | "Medium" | "Low";
  detail: string;
  icon: string;
  linkLabel: string;
  destination: MorningBrewDestination;
  source: BrewSignalSource;
  breakdown: { label: string; value: string }[];
  steps: string[];
  window: string;
}

export interface BrewNewsItem {
  id: string;
  sourceName: string;
  published: string;
  headline: string;
  readTime: string;
  image: string;
  imageAlt: string;
  teams: BrewTeamId[];
  summary: string;
  keyPoints: string[];
  relevance: string;
  category: "Industry" | "Policy" | "Research" | "Technology";
}

export interface BrewQuickLink {
  id: string;
  label: string;
  destination: MorningBrewDestination;
}

export interface BrewInboxSummary {
  unread: number;
  highPriority: number;
  meetings: number;
  meetingsHighPriority: number;
}

export interface BrewBriefing {
  greetingName: string;
  deck: string;
  readTimeMinutes: number;
  updatedAt: string;
  deliveryLabel: string;
  insights: BrewInsight[];
  kpis: BrewKpi[];
  changes: BrewChange[];
  meetings: BrewMeeting[];
  emails: BrewEmail[];
  priorities: BrewPriority[];
  news: BrewNewsItem[];
  quickLinks: BrewQuickLink[];
  inbox: BrewInboxSummary;
}

/* ------------------------------------------------------------------- detail */

export type BrewDetailRef =
  | { kind: "insight"; id: string }
  | { kind: "kpi"; id: string; timeframe: BrewTimeframeId }
  | { kind: "meeting"; id: string }
  | { kind: "email"; id: string }
  | { kind: "priority"; id: string }
  | { kind: "change"; id: string }
  | { kind: "news"; id: string };

/* ------------------------------------------------------------------- edward */

export type EdwardMode = "ask" | "summarize" | "insights" | "draft_reply" | "prep";

export interface EdwardRequest {
  mode: EdwardMode;
  /** Human label for the surface Edward was launched from. */
  context: string;
  question?: string;
  emailId?: string;
}

export interface EdwardAnswer {
  question: string;
  answer: string;
  bullets?: string[];
  followUp?: string;
  draft?: { subject: string; body: string[] };
}
