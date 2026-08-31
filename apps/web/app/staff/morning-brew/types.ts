/**
 * Morning Brew — the enrollment leader's first read of the day.
 *
 * The types below are a *presentation* shape: they name what a card renders,
 * and nothing more. The reader still chooses what lands in their morning; those
 * choices only ever filter and bound what the corpus already holds.
 *
 * Two things this file states that the older shape did not, both because the
 * daily-briefing design asks for them:
 *
 *  - a KPI carries a **target** and the progress against it, so a card can say
 *    "650 / 900 · 72% · due by May 31" rather than only a share of the step
 *    before it;
 *  - a KPI carries **three lines** — last year, this year's actuals, and a
 *    forecast — because the deep read is a chart of where the figure has been
 *    and where the pace it is running at would put it.
 */

import type {
  StaffActionCenterQuery,
  StaffBrewCohortRef,
  StaffBrewDestination,
  StaffBrewSeverity,
} from "@vv/contracts";

/**
 * Subjects a leader can follow each morning.
 *
 * These are the five the setup screen offers, in its order. `enrollment` and
 * `admissions` are deliberately separate: an admissions figure is about who was
 * offered and who said yes, and an enrollment figure is about who paid, cleared
 * and will actually be in a seat — different offices, different weeks.
 */
export type BrewTopicId =
  | "financial_aid"
  | "admissions"
  | "enrollment"
  | "housing"
  | "campus_life";

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
 *
 * Not every source offers all three. Higher Ed News offers the first two only —
 * a curated outside feed has a headline and a reason it reached your desk, and
 * a third, longer reading of someone else's article was depth we could not
 * honestly supply. `BrewSourceDefinition.levels` is the list a source actually
 * answers for.
 */
export type BrewDetailLevelId = "glance" | "context" | "deep";

export type BrewDeliveryTime = "06:00" | "06:30" | "07:00" | "07:30";

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
  /** A glyph name from `glyphs.tsx`. */
  icon: string;
  accent: BrewAccent;
  recommended: boolean;
  recommendation: string;
}

/** One of the answers to "how much context would you like?". */
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
  /** The depths this source answers for, in the order setup offers them. */
  levels: BrewDetailLevelId[];
  details: Record<BrewDetailLevelId, BrewDetailOption>;
}

/** What the reader chose for one source: in or out, and at what depth. */
export interface BrewSourcePreference {
  enabled: boolean;
  detail: BrewDetailLevelId;
}

export interface BrewPreferences {
  version: 7;
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
  /**
   * The finding in one sentence. Deliberately identical at every depth: a
   * reader who asked for the short brief and one who asked for the long one
   * should walk away having read the same claim, not two different ones.
   */
  summary: string;
  /**
   * The consequence of the finding if nothing changes — the second paragraph
   * on the card, under the summary.
   */
  projection: string;
  /** The figures under the headline. Each depth names a different set. */
  stats: Record<BrewDetailLevelId, string>;
  /** The paragraph that arrives at "With Context". */
  context: string;
  /** The longer reading that replaces it at "Deep Dive". */
  deepDive: string;
  impactLabel: string;
  impact: BrewImpactChip[];
  /** What to do about it, stated at the depth the reader asked for. */
  recommendations: Record<BrewDetailLevelId, string>;
  /** The office the recommendation is addressed to. */
  owner: string;
  impactLevel: "High" | "Medium" | "Low";
  /** How firm the reading is, as a whole percent. Printed in the card's foot. */
  confidence: number;
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

/**
 * One comparison behind a KPI: how the figure moved against an earlier point.
 *
 * A KPI carries a list of these and the card cycles through them. The headline
 * number never changes as it cycles — only the comparison beside it does, which
 * is the honest reading: there is one current value, seen from several
 * distances.
 */
export interface BrewKpiComparison {
  id: string;
  /** "vs yesterday", "vs last 7 days" — names the distance, not the value. */
  label: string;
  /** Movement, already signed and already formatted: "+3.2%", "−1.7pp". */
  delta: string;
  /** A second reading of the same move, where one adds something. */
  percent: string | null;
  direction: "up" | "down" | "flat";
  /** Whether up is good here; a rising withdrawal count is not. */
  favorable: boolean;
}

export interface BrewKpi {
  id: string;
  topic: BrewTopicId;
  label: string;
  /** A glyph name from `glyphs.tsx`. */
  icon: string;
  /** The current figure, as a number, for the chart and the progress bar. */
  value: number;
  /** The same figure as the card prints it: "14,782", "40.1%", "$98.4M". */
  display: string;
  /** What the figure counts, in a few words. */
  window: string;
  /**
   * This cycle's actuals, oldest first, one per day, ending on today. The last
   * entry is always `value`: the line and the number above it are the same
   * measurement, so they cannot be allowed to disagree.
   */
  series: number[];
  /**
   * The same measurement over the equivalent window a year ago, drawn behind
   * the actuals. Spans the whole 30-day axis, forecast days included — last
   * year is history, and history is known all the way across.
   */
  previousYear: number[];
  /**
   * Where the current pace lands, starting from today. The first entry is
   * `value`, so the dotted run-out leaves the solid line rather than floating
   * beside it.
   */
  forecast: number[];
  /** The goal for the cycle, and the same figure as the card prints it. */
  target: number | null;
  targetDisplay: string | null;
  /** Progress to target as a whole percent. Null where there is no target. */
  progressPercent: number | null;
  /** When the target has to be met: "Due by May 31". */
  dueLabel: string | null;
  /** One line under the progress bar, at Deep Dive, reading the trend. */
  trendNote: string;
  /**
   * Where the current pace lands, and whether that clears the target.
   *
   * Deep Dive shows this instead of the trend sentence: a reader who asked for
   * trajectory wants the number the line is heading for and a colour saying
   * whether to worry, not a paragraph they have to parse. `status` is the
   * corpus's own reading against `target`, not something the card computes.
   */
  projection: {
    /** The figure the pace reaches, as the card prints it: "4,470", "$104.6M". */
    display: string;
    /** When it lands: "by May 1". */
    byLabel: string;
    status: "on_track" | "at_risk" | "off_target";
  } | null;
  cohort: StaffBrewCohortRef;
  /** Empty where nothing can be compared against; the card then says so. */
  comparisons: BrewKpiComparison[];
  unavailable: boolean;
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
  /** Publisher wordmark, shown as initials beside the byline. */
  publisherMark: string;
  /** Cover artwork, served from `public/media/news`. */
  image: string;
  /** What the artwork shows, for anyone who cannot see it. */
  imageAlt: string;
  publishedLabel: string;
  /** How long the story itself takes to read, as the publisher states it. */
  readMinutes: number;
  url: string;
  topic: BrewTopicId;
  /**
   * Shown from "With Context": the specific thing at this institution the
   * story lands on, named with the figure it would move. Not "bears on your
   * funnel" — the office, the cohort, and the number.
   */
  bearing: string;
}

/**
 * One entry on the day's calendar.
 *
 * A meeting, not a due date: the daily briefing's Calendar band answers "what
 * am I in today", which is the question a leader opens their morning with.
 * Requirement deadlines still exist in the corpus, but they reach the reader
 * through the Action Center, where something can actually be done about them.
 */
export interface BrewMeeting {
  id: string;
  topic: BrewTopicId;
  title: string;
  /** The one line under the title: what it is for, or who is in it. */
  detail: string;
  /** Clock time in the reader's timezone, as printed: "8:30 AM". */
  timeLabel: string;
  /** Minutes in the slot, for the line under the time. */
  durationMinutes: number;
  /** Sortable minute-of-day, so a filter can cut the list without reparsing. */
  startsAtMinutes: number;
  priority: "high" | "medium" | "low";
  /** Everyone in the invitation, named. The row draws the first three. */
  attendees: string[];
  /** Whether the reader is the organizer; the "Mine" filter reads this. */
  organizer: boolean;
  /** What the reader should have done before walking in. */
  prep: string;
  destination: MorningBrewDestination;
}

export interface BrewRequest {
  id: string;
  topic: BrewTopicId;
  subject: string;
  summary: string;
  /** Who sent it, and the seat they sent it from. */
  fromName: string;
  fromRole: string;
  status: "new" | "open" | "waiting_on_student" | "resolved";
  priority: "urgent" | "high" | "medium" | "low";
  /** Unopened in the reader's own mailbox; what the "Unread" view filters on. */
  unread: boolean;
  /** Flagged by the reader or by a rule; what the "Important" view filters on. */
  important: boolean;
  /** When it landed: a clock time this morning, or a day name before that. */
  receivedLabel: string;
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
  /** A glyph name from `glyphs.tsx`. */
  icon: string;
  linkLabel: string;
  destination: MorningBrewDestination;
  breakdown: { label: string; value: string }[];
  steps: string[];
  window: string;
  count: number;
  /** Whether the next move is the reader's own, or someone else's to report. */
  ownedByReader: boolean;
  /** Opens the task board pre-filtered on the items behind this queue. */
  boardQuery: StaffActionCenterQuery | null;
}

export interface BrewGlance {
  requests: number;
  requestsAwaitingReply: number;
  meetings: number;
  meetingsHighPriority: number;
  priorities: number;
  prioritiesHighPriority: number;
}

/** Who the brief is written for. The demo corpus names its own reader. */
export interface BrewReader {
  name: string;
  firstName: string;
  role: string;
  email: string;
}

export interface BrewBriefing {
  greetingName: string;
  reader: BrewReader;
  /** The admissions cycle every figure in the brief is counted against. */
  cycleLabel: string;
  deck: string;
  readTimeMinutes: number;
  updatedAt: string;
  windowLabel: string;
  deliveryLabel: string;
  students: number;
  insights: BrewInsight[];
  kpis: BrewKpi[];
  news: BrewNewsItem[];
  meetings: BrewMeeting[];
  requests: BrewRequest[];
  priorities: BrewPriority[];
  glance: BrewGlance;
  coverage: {
    notes: string[];
    unsupported: { metric: string; reason: string }[];
  };
}

/* ------------------------------------------------------------------- detail */

export type BrewDetailRef =
  | { kind: "insight"; id: string }
  | { kind: "kpi"; id: string }
  | { kind: "meeting"; id: string }
  | { kind: "request"; id: string }
  | { kind: "priority"; id: string };

/* ------------------------------------------------------------------- edward */

export type EdwardMode = "ask" | "summarize" | "insights" | "cohort";

export interface EdwardRequest {
  mode: EdwardMode;
  /** Human label for the surface Edward was launched from. */
  context: string;
  question?: string;
  /**
   * An opening line from Edward rather than a question sent on the reader's
   * behalf.
   *
   * A card that already names its subject — a KPI, say — should not guess what
   * the reader wants to know about it. When this is set the panel opens with
   * Edward's greeting on screen and the cursor in the box, and asks the API
   * nothing until the reader has typed.
   */
  greeting?: string;
}
