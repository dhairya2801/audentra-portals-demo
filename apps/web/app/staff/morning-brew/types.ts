/**
 * Morning Brew — the enrollment leader's first read of the day.
 *
 * Every value rendered on this surface arrives from `GET /v1/staff/morning-brew`
 * as a count of canonical records. The types below are a *presentation* shape:
 * they rename and trim the API payload for the components, and they add nothing
 * to it. There is deliberately no field for a target, a forecast, or a
 * confidence score — the platform holds none of those, and a slot for one is
 * how invented numbers get in.
 *
 * The reader still chooses what lands in their morning; those choices only ever
 * filter and bound what the API already sent.
 */

import type {
  StaffActionCenterQuery,
  StaffBrewCohortRef,
  StaffBrewDestination,
  StaffBrewSeverity,
  StaffBrewWindowId,
  StaffMorningBrew,
} from "@vv/contracts";

/** Subjects a leader can follow each morning; each maps to canonical state. */
export type BrewTopicId =
  | "financial_aid"
  | "admissions"
  | "housing"
  | "registrar"
  | "student_success";

/**
 * The six sources a reader can switch on. Each one owns exactly one band of
 * the briefing, and the section heading in the brief is the source's own title
 * — so a reader who switched on "Calendar" finds a section called Calendar,
 * not "Deadlines ahead".
 */
export type BrewSourceId =
  | "pulse"
  | "news"
  | "calendar"
  | "email"
  | "actions"
  | "intelligence";

/**
 * How much context a source brings. Chosen per source rather than once for the
 * whole read: a leader can want the funnel at a glance and the action center in
 * full, and a single global "depth" could never say that.
 */
export type BrewDetailLevelId = "glance" | "context" | "deep";

export type BrewDeliveryTime = "06:00" | "06:30" | "07:00" | "07:30";

/** Comparison windows the API declares it can actually support. */
export type BrewTimeframeId = StaffBrewWindowId;

/** Staff workspace views the briefing can hand the reader off to. */
export type MorningBrewDestination = StaffBrewDestination;

/**
 * Hand-off from the briefing to the workspace. When a `boardQuery` is present
 * the destination is the task board, opened with that query already applied.
 */
export type MorningBrewNavigate = (
  destination: MorningBrewDestination,
  boardQuery?: StaffActionCenterQuery | null,
) => void;

export type BrewAccent = "purple" | "blue" | "teal" | "navy" | "amber";

export interface BrewTopic {
  id: BrewTopicId;
  title: string;
  blurb: string;
  /** A concrete taste of what lands in the brief when this is on. */
  preview: string;
  icon: string;
  accent: BrewAccent;
  recommended: boolean;
  recommendation: string;
}

/** One of the three answers to "how much context would you like?". */
export interface BrewDetailOption {
  title: string;
  /** The four-word promise beside the title: "The essentials", "Goals & progress". */
  kicker: string;
  description: string;
  /** The badge across the foot of the option card: "FAST SCAN", "DEEPER INSIGHT". */
  tag: string;
}

export interface BrewSourceDefinition {
  id: BrewSourceId;
  title: string;
  /** The single line under the title in the collapsed row. */
  kicker: string;
  /** The paragraph in the opened card, describing what the source brings. */
  description: string;
  /** The canonical records behind it, named plainly. */
  source: string;
  /** A glyph name from the vendored icon set. */
  icon: string;
  accent: BrewAccent;
  recommended: boolean;
  details: Record<BrewDetailLevelId, BrewDetailOption>;
}

/** What the reader chose for one source: in or out, and at what depth. */
export interface BrewSourcePreference {
  enabled: boolean;
  detail: BrewDetailLevelId;
}

export interface BrewPreferences {
  version: 6;
  topics: BrewTopicId[];
  sources: Record<BrewSourceId, BrewSourcePreference>;
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

/** A named student from the cohort behind a headline. Never a risk score. */
export interface BrewInsightStudent {
  id: string;
  name: string;
  program: string;
  note: string;
}

export interface BrewInsight {
  id: string;
  topic: BrewTopicId;
  label: string;
  title: string;
  severity: StaffBrewSeverity;
  summary: string;
  /** The cohort stated against the roster, e.g. "3 of 14 students". */
  scope: string;
  impactLabel: string;
  impact: BrewImpactChip[];
  recommendedAction: string;
  impactLevel: "High" | "Medium" | "Low";
  destination: MorningBrewDestination;
  cohort: StaffBrewCohortRef;
  detail: {
    narrative: string[];
    drivers: { label: string; value: string; note: string }[];
    breakdown: {
      code: string;
      title: string;
      students: number;
      requirements: number;
      overdue: number;
    }[];
    breakdownNote: string | null;
    actions: BrewInsightAction[];
    students: BrewInsightStudent[];
    studentsNote: string | null;
    evidence: string[];
  };
}

export interface BrewKpiFrame {
  /** Raw number the ticker animates toward. */
  numeric: number;
  /** What the value describes in this window. */
  window: string;
  /** Share of a denominator, replacing the notion of "progress to target". */
  basisLabel: string | null;
  basisPercent: number | null;
  /** Only present where the change is reconstructable from a timestamp. */
  delta: string | null;
  direction: "up" | "down" | "flat";
  favorable: boolean;
  comparison: string | null;
  note: string;
  unavailable: boolean;
}

export interface BrewKpi {
  id: string;
  topic: BrewTopicId;
  label: string;
  icon: string;
  source: "canonical_postgres";
  cohort: StaffBrewCohortRef;
  frames: Record<BrewTimeframeId, BrewKpiFrame>;
  detail: {
    definition: string;
    segments: { label: string; value: number; percent: number | null }[];
    notes: string[];
  };
}

/**
 * One higher-education story. The only content on this surface that is not a
 * count of the tenant's own records, which is why it carries a publisher and a
 * link out: the reader can always go and check it.
 */
export interface BrewNewsItem {
  id: string;
  title: string;
  summary: string;
  publisher: string;
  /** Publisher wordmark, drawn as initials when no artwork is supplied. */
  publisherMark: string;
  publishedLabel: string;
  url: string;
  topic: BrewTopicId;
  /** Shown from "With Context" up: the figure in this brief the story would move. */
  bearing: string;
  /** Shown at "Deep Dive": what the story implies for the reader's own cohorts. */
  implication: string;
}

export interface BrewDeadline {
  id: string;
  topic: BrewTopicId;
  kind: "requirement" | "offer_response";
  kindLabel: string;
  /** The canonical requirement code, so a deadline can be traced back. */
  code: string;
  title: string;
  detail: string;
  bucket: "overdue" | "today" | "this_week" | "this_month";
  dueLabel: string;
  relativeLabel: string;
  students: number;
  priority: "high" | "medium" | "low";
  nextStep: string;
  destination: MorningBrewDestination;
}

export interface BrewRequest {
  id: string;
  topic: BrewTopicId;
  subject: string;
  summary: string;
  studentName: string;
  programName: string;
  status: "new" | "open" | "waiting_on_student" | "resolved";
  priority: "urgent" | "high" | "medium" | "low";
  waitingLabel: string;
  assigneeName: string | null;
  destination: MorningBrewDestination;
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
  breakdown: { label: string; value: string }[];
  steps: string[];
  window: string;
  count: number;
  /** Opens the task board pre-filtered on the items behind this queue. */
  boardQuery: StaffActionCenterQuery | null;
}

export interface BrewQuickLink {
  id: string;
  label: string;
  destination: MorningBrewDestination;
}

export interface BrewGlance {
  requests: number;
  requestsAwaitingReply: number;
  deadlinesOverdue: number;
  deadlinesThisWeek: number;
}

export interface BrewBriefing {
  greetingName: string;
  deck: string;
  bullets: string[];
  readTimeMinutes: number;
  updatedAt: string;
  windowLabel: string;
  deliveryLabel: string;
  students: number;
  timeframes: { id: BrewTimeframeId; label: string; short: string }[];
  insights: BrewInsight[];
  kpis: BrewKpi[];
  news: BrewNewsItem[];
  deadlines: BrewDeadline[];
  requests: BrewRequest[];
  priorities: BrewPriority[];
  quickLinks: BrewQuickLink[];
  glance: BrewGlance;
  coverage: {
    notes: string[];
    unsupported: { metric: string; reason: string }[];
  };
  engagementScanAvailable: boolean;
  /** False when the tenant records no portal activity, so inactivity cannot be read. */
  engagementActivitySignal: boolean;
}

/** The raw payload, re-exported so components can name the source shape. */
export type BrewSource = StaffMorningBrew;

/* ------------------------------------------------------------------- detail */

export type BrewDetailRef =
  | { kind: "insight"; id: string }
  | { kind: "kpi"; id: string; timeframe: BrewTimeframeId }
  | { kind: "deadline"; id: string }
  | { kind: "request"; id: string }
  | { kind: "priority"; id: string };

/* ------------------------------------------------------------------- edward */

export type EdwardMode = "ask" | "summarize" | "insights" | "cohort";

export interface EdwardRequest {
  mode: EdwardMode;
  /** Human label for the surface Edward was launched from. */
  context: string;
  question?: string;
}
