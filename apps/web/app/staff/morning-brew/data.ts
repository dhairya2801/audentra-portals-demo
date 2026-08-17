import type {
  StaffBrewAttentionItem,
  StaffBrewChange,
  StaffBrewDeadline,
  StaffBrewMetric,
  StaffBrewPriority,
  StaffBrewRequest,
  StaffMorningBrew,
} from "@vv/contracts";
import { BREW_DEPTH_OPTIONS, BREW_TIMEFRAMES } from "./catalog";
import type {
  BrewBriefing,
  BrewChange,
  BrewDeadline,
  BrewInsight,
  BrewKpi,
  BrewKpiFrame,
  BrewPreferences,
  BrewPriority,
  BrewQuickLink,
  BrewRequest,
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

const CLOCK = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

const DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/New_York",
});

/* ---------------------------------------------------------------- filtering */

const depthOption = (preferences: BrewPreferences) =>
  BREW_DEPTH_OPTIONS.find((option) => option.id === preferences.depth) ?? BREW_DEPTH_OPTIONS[1];

const readTimeFor = (preferences: BrewPreferences) =>
  preferences.depth === "headlines" ? 2 : preferences.depth === "deep" ? 6 : 4;

const kpiLimit = (preferences: BrewPreferences) => (preferences.depth === "deep" ? 12 : 6);
const changeLimit = (preferences: BrewPreferences) =>
  preferences.depth === "headlines" ? 4 : preferences.depth === "deep" ? 12 : 6;
const priorityLimit = (preferences: BrewPreferences) => (preferences.depth === "deep" ? 5 : 3);
const deadlineLimit = (preferences: BrewPreferences) =>
  preferences.depth === "headlines" ? 3 : 6;

/** The reader's own answer about their request list wins over the general length. */
const requestLimit = (preferences: BrewPreferences) =>
  preferences.requestDepth === "urgent" ? 2 : preferences.requestDepth === "everything" ? 12 : 4;

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

function toChange(change: StaffBrewChange): BrewChange {
  return {
    id: change.id,
    topic: change.topic,
    time: change.occurredAt ? CLOCK.format(new Date(change.occurredAt)) : "No activity",
    title: change.title,
    detail: change.detail,
    tone: change.tone,
    count: change.count,
    metric: change.metric,
    destination: change.destination,
    basis: change.basis,
    basisNote: change.basisNote,
    exact: change.exact,
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
  };
}

export const BREW_QUICK_LINKS: BrewQuickLink[] = [
  { id: "students", label: "Student roster", destination: "students" },
  { id: "tasks", label: "Action Center", destination: "tasks" },
  { id: "messages", label: "Messages", destination: "messages" },
  { id: "edward", label: "Ask Edward", destination: "edward" },
];

/* ------------------------------------------------------------------- builder */

function deckFor(preferences: BrewPreferences, brew: StaffMorningBrew): string {
  if (preferences.tone === "narrative" && brew.synthesis.bullets.length) {
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
  const { requests, deadlines, numbers, signals, movements } = preferences.include;

  const kpis = brew.metrics
    .filter((metric) => topics.has(metric.topic))
    .slice(0, kpiLimit(preferences))
    .map(toKpi);

  const insights = brew.attention
    .filter((item) => topics.has(item.topic))
    .slice(0, depthOption(preferences).storyCount)
    .map(toInsight);

  // Quiet classes stay in the payload but only surface at the deepest read;
  // a rail of zeroes buries the one line that moved.
  const changeItems = brew.changes.filter(
    (change) => topics.has(change.topic) && (change.count > 0 || preferences.depth === "deep"),
  );

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
    bullets: signals ? brew.synthesis.bullets : [],
    readTimeMinutes: readTimeFor(preferences),
    updatedAt: brew.generatedAt,
    windowLabel: brew.window.label,
    deliveryLabel: preferences.deliveryTime.replace(/^0/, ""),
    students: brew.population.students,
    timeframes,
    insights: signals ? insights : [],
    kpis: numbers ? kpis : [],
    changes: movements ? changeItems.slice(0, changeLimit(preferences)).map(toChange) : [],
    deadlines: deadlines ? deadlineItems : [],
    requests: requests ? requestItems : [],
    priorities: signals ? priorities : [],
    quickLinks: BREW_QUICK_LINKS,
    glance: {
      requests: requests ? brew.requests.total : 0,
      requestsAwaitingReply: requests ? brew.requests.awaitingFirstReply : 0,
      deadlinesOverdue: deadlines ? overdue : 0,
      deadlinesThisWeek: deadlines ? thisWeek : 0,
    },
    coverage: {
      notes: brew.coverage.notes,
      unsupported: brew.coverage.unsupported,
    },
    engagementScanAvailable: brew.engagementScan.available,
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
