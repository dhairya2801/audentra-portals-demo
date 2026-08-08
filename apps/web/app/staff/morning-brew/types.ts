/**
 * Morning Brew — a personalized executive briefing for university leadership.
 *
 * The reader picks the topics they care about, chooses what gets pulled into
 * the brief, then answers a few follow-ups about those choices. The briefing
 * builder assembles only what they asked for.
 */

/** Subjects a leader can follow each morning. */
export type BrewTopicId =
  | "financial_aid"
  | "admissions"
  | "housing"
  | "registrar"
  | "student_success";

/** What gets pulled into the morning read. */
export type BrewIncludeId = "inbox" | "calendar" | "numbers" | "signals" | "movements" | "headlines";

/** How much the reader wants in front of them each morning. */
export type BrewDepthId = "headlines" | "balanced" | "deep";

/** Voice of the generated prose. */
export type BrewToneId = "executive" | "narrative";

export type BrewDeliveryTime = "06:00" | "06:30" | "07:00" | "07:30";

/** Comparison windows offered by the Enrollment Pulse carousel. */
export type BrewTimeframeId = "yesterday" | "week" | "month" | "year";

/** Which comparison the pulse opens on; "auto" cycles through all of them. */
export type BrewPulseDefault = BrewTimeframeId | "auto";

export type BrewInboxDepthId = "urgent" | "handful" | "everything";
export type BrewInsightDetailId = "headline" | "impact" | "full";

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

export type BrewAccent = "purple" | "blue" | "teal" | "navy" | "amber";

export interface BrewTopic {
  id: BrewTopicId;
  title: string;
  blurb: string;
  /** A concrete taste of what lands in the brief when this is on. */
  preview: string;
  icon: string;
  accent: BrewAccent;
  /** Pre-selected for the demo reader (Executive Director of Financial Aid). */
  recommended: boolean;
  recommendation: string;
}

export interface BrewInclude {
  id: BrewIncludeId;
  title: string;
  blurb: string;
  /** Where it comes from, named plainly rather than as a vendor list. */
  source: string;
  icon: string;
  accent: BrewAccent;
  alwaysOn: boolean;
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

export interface BrewPreferences {
  version: 4;
  topics: BrewTopicId[];
  include: Record<BrewIncludeId, boolean>;
  depth: BrewDepthId;
  tone: BrewToneId;
  deliveryTime: BrewDeliveryTime;
  /* Follow-ups, each asked only when the matching choice is switched on. */
  inboxDepth: BrewInboxDepthId;
  draftReplies: boolean;
  calendarPrep: boolean;
  pulseDefault: BrewPulseDefault;
  insightDetail: BrewInsightDetailId;
  readingSources: string[];
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
  topic: BrewTopicId;
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
  topic: BrewTopicId;
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
  topic: BrewTopicId;
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
  topic: BrewTopicId;
  body: string[];
  asks: string[];
  thread: { sender: string; time: string; excerpt: string }[];
  suggestedReply: { subject: string; greeting: string; body: string[]; signoff: string };
  destination?: MorningBrewDestination;
}

export interface BrewPriority {
  id: string;
  topic: BrewTopicId;
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
  topics: BrewTopicId[];
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
