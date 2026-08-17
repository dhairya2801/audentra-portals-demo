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
  StaffBrewCohortRef,
  StaffBrewDestination,
  StaffBrewSeverity,
  StaffBrewTone,
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
 * Sections the reader can switch on. The identifiers are stable across
 * versions so a saved preference survives; the labels in `catalog.ts` describe
 * what each one actually shows today.
 */
export type BrewIncludeId =
  | "requests"
  | "deadlines"
  | "numbers"
  | "signals"
  | "movements";

/** How much the reader wants in front of them each morning. */
export type BrewDepthId = "headlines" | "balanced" | "deep";

/** Voice of the generated summary. */
export type BrewToneId = "executive" | "narrative";

export type BrewDeliveryTime = "06:00" | "06:30" | "07:00" | "07:30";

/** Comparison windows the API declares it can actually support. */
export type BrewTimeframeId = StaffBrewWindowId;

export type BrewRequestDepthId = "urgent" | "handful" | "everything";
export type BrewInsightDetailId = "headline" | "impact" | "full";

/** Staff workspace views the briefing can hand the reader off to. */
export type MorningBrewDestination = StaffBrewDestination;

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

export interface BrewInclude {
  id: BrewIncludeId;
  title: string;
  blurb: string;
  /** The canonical records behind it, named plainly. */
  source: string;
  icon: string;
  accent: BrewAccent;
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
  version: 5;
  topics: BrewTopicId[];
  include: Record<BrewIncludeId, boolean>;
  depth: BrewDepthId;
  tone: BrewToneId;
  deliveryTime: BrewDeliveryTime;
  requestDepth: BrewRequestDepthId;
  deadlineNextStep: boolean;
  insightDetail: BrewInsightDetailId;
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

export interface BrewChange {
  id: string;
  topic: BrewTopicId;
  /** Clock time of the latest such event, or the window when none occurred. */
  time: string;
  title: string;
  detail: string;
  tone: StaffBrewTone;
  count: number;
  metric: string;
  destination: MorningBrewDestination;
  basis: string;
  basisNote: string;
  exact: boolean;
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
  changes: BrewChange[];
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
}

/** The raw payload, re-exported so components can name the source shape. */
export type BrewSource = StaffMorningBrew;

/* ------------------------------------------------------------------- detail */

export type BrewDetailRef =
  | { kind: "insight"; id: string }
  | { kind: "kpi"; id: string; timeframe: BrewTimeframeId }
  | { kind: "deadline"; id: string }
  | { kind: "request"; id: string }
  | { kind: "priority"; id: string }
  | { kind: "change"; id: string };

/* ------------------------------------------------------------------- edward */

export type EdwardMode = "ask" | "summarize" | "insights" | "cohort";

export interface EdwardRequest {
  mode: EdwardMode;
  /** Human label for the surface Edward was launched from. */
  context: string;
  question?: string;
}
