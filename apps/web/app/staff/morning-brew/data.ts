import type {
  StaffBrewAttentionItem,
  StaffBrewDeadline,
  StaffBrewMetric,
  StaffBrewPriority,
  StaffBrewRequest,
  StaffMorningBrew,
} from "@vv/contracts";
import { BREW_TIMEFRAMES } from "./catalog";
import { HIGHER_ED_NEWS } from "./news";
import type {
  BrewBriefing,
  BrewDeadline,
  BrewDetailLevelId,
  BrewInsight,
  BrewKpi,
  BrewKpiFrame,
  BrewNewsItem,
  BrewPreferences,
  BrewPriority,
  BrewQuickLink,
  BrewRequest,
  BrewSourceId,
  BrewTimeframeId,
  BrewTopicId,
} from "./types";

/**
 * Turn the canonical briefing payload into the shape the page renders.
 *
 * This module does exactly two things: rename fields, and apply the reader's
 * own filters and limits. It computes no metric, derives no severity, and
 * writes no prose about the institution. That rule is why the frontend cannot
 * quietly disagree with the API — there is nothing here to disagree with.
 */

const INT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const ONE_DECIMAL = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Formats a KPI value. Shared by the static card and the animated ticker. */
export function formatBrewNumber(value: number): string {
  return INT.format(value);
}

export function formatBrewPercent(value: number): string {
  return `${ONE_DECIMAL.format(value)}%`;
}

const DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/New_York",
});

/* ---------------------------------------------------------------- filtering */

/**
 * How long a section runs is now the source's own answer, not one global
 * setting: a reader who asked for the funnel at a glance and the action center
 * in full gets a short KPI band and a long queue, which is what they said.
 */
const levelOf = (preferences: BrewPreferences, id: BrewSourceId): BrewDetailLevelId =>
  preferences.sources[id].detail;

const enabled = (preferences: BrewPreferences, id: BrewSourceId): boolean =>
  preferences.sources[id].enabled;

/** Picks the count for a level, in `[glance, context, deep]` order. */
const byLevel = (level: BrewDetailLevelId, counts: [number, number, number]): number =>
  level === "glance" ? counts[0] : level === "context" ? counts[1] : counts[2];

const kpiLimit = (preferences: BrewPreferences) =>
  byLevel(levelOf(preferences, "pulse"), [4, 6, 12]);
const insightLimit = (preferences: BrewPreferences) =>
  byLevel(levelOf(preferences, "intelligence"), [2, 3, 4]);
const priorityLimit = (preferences: BrewPreferences) =>
  byLevel(levelOf(preferences, "actions"), [3, 4, 6]);
const deadlineLimit = (preferences: BrewPreferences) =>
  byLevel(levelOf(preferences, "calendar"), [3, 6, 12]);
const requestLimit = (preferences: BrewPreferences) =>
  byLevel(levelOf(preferences, "email"), [3, 5, 12]);
const newsLimit = (preferences: BrewPreferences) =>
  byLevel(levelOf(preferences, "news"), [4, 6, 8]);

/**
 * A minute per switched-on source, and a second minute for one asked for in
 * full. It is a reading estimate over what is actually on the page, not a
 * setting the reader chose and we then honour.
 */
function readTimeFor(preferences: BrewPreferences): number {
  const on = Object.values(preferences.sources).filter((source) => source.enabled);
  const deep = on.filter((source) => source.detail === "deep").length;
  return Math.max(1, Math.round(on.length * 0.7 + deep * 0.8));
}

/* ------------------------------------------------------------------ mapping */

function frameFor(frame: StaffBrewMetric["frames"][number]): BrewKpiFrame {
  return {
    numeric: frame.value,
    window: frame.window,
    basisLabel: frame.basisLabel,
    basisPercent: frame.basisPercent,
    delta: frame.change ? frame.change.label : null,
    direction: frame.change ? frame.change.direction : "flat",
    favorable: frame.change ? frame.change.favorable : true,
    comparison: frame.change ? frame.change.comparison : null,
    note: frame.note,
    unavailable: frame.unavailable,
  };
}

function toKpi(metric: StaffBrewMetric): BrewKpi {
  const frames = {} as Record<BrewTimeframeId, BrewKpiFrame>;
  for (const frame of metric.frames) frames[frame.windowId] = frameFor(frame);
  return {
    id: metric.id,
    topic: metric.topic,
    label: metric.label,
    icon: metric.icon,
    source: metric.source,
    cohort: metric.cohort,
    frames,
    detail: {
      definition: metric.definition,
      segments: metric.segments.map((segment) => ({
        label: segment.label,
        value: segment.value,
        percent: segment.percent,
      })),
      notes: [
        `Cohort: ${metric.cohort.clauses.join("; ") || "every student in this tenant"}.`,
        "Counted from canonical PostgreSQL records at the time shown in the masthead.",
      ],
    },
  };
}

function toInsight(item: StaffBrewAttentionItem): BrewInsight {
  return {
    id: item.id,
    topic: item.topic,
    label: item.label,
    title: item.title,
    severity: item.severity,
    summary: item.summary,
    scope: item.scope,
    impactLabel: item.impactLabel,
    impact: item.impact,
    recommendedAction: item.recommendedAction,
    impactLevel: item.priorityLevel,
    destination: item.destination,
    cohort: item.cohort,
    detail: item.detail,
  };
}

/**
 * Deadlines carry no topic of their own on the wire, so route them to the
 * topic that owns the underlying requirement. An unknown code stays under
 * student progress rather than being dropped — a deadline nobody claims is
 * still a deadline.
 */
const DEADLINE_TOPICS: Record<string, BrewTopicId> = {
  offer_response: "admissions",
  enrollment_deposit: "admissions",
  financial_aid_verification: "financial_aid",
  fafsa_submission: "financial_aid",
  official_transcript: "registrar",
  identity_document: "registrar",
  transcript_upload: "registrar",
  housing_preference: "housing",
  housing_contract: "housing",
};

const NEXT_STEP: Record<BrewDeadline["bucket"], string> = {
  overdue: "Confirm whether the student or the university is holding this.",
  today: "Clear it today or move the date deliberately.",
  this_week: "Remind the affected students before the date passes.",
  this_month: "Schedule the reminder so it does not arrive late.",
};

function toDeadline(deadline: StaffBrewDeadline): BrewDeadline {
  const bucket = deadline.bucket;
  return {
    id: deadline.id,
    topic: DEADLINE_TOPICS[deadline.code] ?? "student_success",
    kind: deadline.kind,
    kindLabel:
      deadline.kind === "offer_response" ? "Admission offer response" : "Enrollment requirement",
    code: deadline.code,
    title: deadline.title,
    detail: deadline.detail,
    bucket,
    dueLabel: DAY.format(new Date(deadline.dueAt)),
    relativeLabel: deadline.relativeLabel,
    students: deadline.students,
    priority: deadline.priority,
    nextStep: NEXT_STEP[bucket],
    destination: deadline.destination,
  };
}

const REQUEST_TOPICS: Record<string, BrewTopicId> = {
  payments: "admissions",
  documents: "registrar",
  getting_started: "student_success",
  support: "student_success",
};

function toRequest(request: StaffBrewRequest): BrewRequest {
  return {
    id: request.id,
    topic: REQUEST_TOPICS[request.topicCode] ?? "student_success",
    subject: request.subject,
    summary: request.summary,
    studentName: request.studentName,
    programName: request.programName,
    status: request.status,
    priority: request.priority,
    waitingLabel: request.waitingLabel,
    assigneeName: request.assigneeName,
    destination: request.destination,
  };
}

function toPriority(priority: StaffBrewPriority): BrewPriority {
  return {
    id: priority.id,
    topic: priority.topic,
    title: priority.title,
    level: priority.level,
    detail: priority.detail,
    icon: priority.icon,
    linkLabel: priority.linkLabel,
    destination: priority.destination,
    breakdown: priority.breakdown,
    steps: priority.steps,
    window: priority.window,
    count: priority.count,
    boardQuery: priority.boardQuery ?? null,
  };
}

/**
 * The news list is a constant, so "building" it is only ever filtering: the
 * topics the reader follows, bounded by the depth they asked for. No story is
 * scored, reordered by relevance, or joined to a student.
 */
function newsFor(preferences: BrewPreferences, topics: Set<BrewTopicId>): BrewNewsItem[] {
  return HIGHER_ED_NEWS.filter((item) => topics.has(item.topic)).slice(0, newsLimit(preferences));
}

export const BREW_QUICK_LINKS: BrewQuickLink[] = [
  { id: "students", label: "Student roster", destination: "students" },
  { id: "tasks", label: "Action Center", destination: "tasks" },
  { id: "messages", label: "Messages", destination: "messages" },
  { id: "edward", label: "Ask Edward", destination: "edward" },
];

/* ------------------------------------------------------------------- builder */

/**
 * The deck the API wrote, lengthened by its own first bullet when the reader
 * asked for the read-across in full. Nothing here composes a sentence.
 */
function deckFor(preferences: BrewPreferences, brew: StaffMorningBrew): string {
  const full =
    enabled(preferences, "intelligence") && levelOf(preferences, "intelligence") === "deep";
  if (full && brew.synthesis.bullets.length) {
    return `${brew.synthesis.headline} ${brew.synthesis.bullets[0]}`;
  }
  return brew.synthesis.headline;
}

/**
 * Assemble today's briefing from the canonical payload and the reader's
 * choices.
 *
 * Preferences only ever subtract. A section the reader switched off is empty;
 * a topic they do not follow is filtered out; a shorter read is a shorter
 * slice. Nothing here can add a value the API did not send.
 */
export function buildBrewBriefing(
  brew: StaffMorningBrew,
  preferences: BrewPreferences,
  staffName: string,
): BrewBriefing {
  const topics = new Set<BrewTopicId>(preferences.topics);
  const pulse = enabled(preferences, "pulse");
  const news = enabled(preferences, "news");
  const calendar = enabled(preferences, "calendar");
  const email = enabled(preferences, "email");
  const actions = enabled(preferences, "actions");
  const intelligence = enabled(preferences, "intelligence");

  const kpis = brew.metrics
    .filter((metric) => topics.has(metric.topic))
    .slice(0, kpiLimit(preferences))
    .map(toKpi);

  const insights = brew.attention
    .filter((item) => topics.has(item.topic))
    .slice(0, insightLimit(preferences))
    .map(toInsight);

  const deadlineItems = brew.deadlines
    .map(toDeadline)
    .filter((deadline) => topics.has(deadline.topic))
    .slice(0, deadlineLimit(preferences));

  const requestItems = brew.requests.items
    .map(toRequest)
    .filter((request) => topics.has(request.topic) || request.priority === "urgent")
    .slice(0, requestLimit(preferences));

  const priorities = brew.priorities
    .filter((priority) => topics.has(priority.topic))
    .slice(0, priorityLimit(preferences))
    .map(toPriority);

  const timeframes = (brew.windows.length ? brew.windows : BREW_TIMEFRAMES).map((window) => ({
    id: window.id as BrewTimeframeId,
    label: window.label,
    short: window.short,
  }));

  // Headcounts, not a sum over deadline rows: a student with four overdue
  // requirements is one person to chase, and summing the rows would print a
  // number larger than the roster.
  const overdue = brew.population.cohorts.overdue ?? 0;
  const thisWeek = brew.population.cohorts.due_soon ?? 0;

  return {
    greetingName: staffName.split(" ")[0] || "there",
    deck: deckFor(preferences, brew),
    bullets: intelligence ? brew.synthesis.bullets : [],
    readTimeMinutes: readTimeFor(preferences),
    updatedAt: brew.generatedAt,
    windowLabel: brew.window.label,
    deliveryLabel: preferences.deliveryTime.replace(/^0/, ""),
    students: brew.population.students,
    timeframes,
    insights: intelligence ? insights : [],
    kpis: pulse ? kpis : [],
    news: news ? newsFor(preferences, topics) : [],
    deadlines: calendar ? deadlineItems : [],
    requests: email ? requestItems : [],
    priorities: actions ? priorities : [],
    quickLinks: BREW_QUICK_LINKS,
    glance: {
      requests: email ? brew.requests.total : 0,
      requestsAwaitingReply: email ? brew.requests.awaitingFirstReply : 0,
      deadlinesOverdue: calendar ? overdue : 0,
      deadlinesThisWeek: calendar ? thisWeek : 0,
    },
    coverage: {
      notes: brew.coverage.notes,
      unsupported: brew.coverage.unsupported,
    },
    engagementScanAvailable: brew.engagementScan.available,
    engagementActivitySignal: brew.engagementScan.activitySignal !== false,
  };
}

/* -------------------------------------------------------------------- edward */

export const EDWARD_SUGGESTIONS = [
  "What should I pay attention to today?",
  "Which deposited students have an overdue requirement?",
  "Which accepted students have not paid their enrollment deposit?",
  "What is blocking the most students right now?",
  "Which students have a requirement due in the next 7 days?",
] as const;

/**
 * The opening question for an Edward turn launched from a Morning Brew card.
 *
 * Every branch hands Edward a cohort question it can answer from canonical
 * reads. The panel deliberately does not compose an answer itself: a second
 * answering path beside the real assistant is exactly how a briefing starts
 * quoting numbers nothing produced.
 */
export function edwardOpeningQuestion(
  mode: "ask" | "summarize" | "insights" | "cohort",
  context: string,
  briefing: BrewBriefing,
  question?: string,
): string {
  const trimmed = (question ?? "").trim();
  if (trimmed) return trimmed;
  if (mode === "cohort") return context;
  if (mode === "insights") {
    const first = briefing.insights[0];
    return first
      ? `${first.cohort.question} And what is the most common blocker among them?`
      : "What should I pay attention to across the incoming class today?";
  }
  if (mode === "summarize") {
    return `Summarise ${context.toLowerCase()} for the incoming class, using canonical records only.`;
  }
  return "What should I pay attention to today?";
}
