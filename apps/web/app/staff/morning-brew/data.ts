import { HIGHER_ED_NEWS } from "./news";
import type { BrewDemoSource } from "./demo-brew";
import type {
  BrewBriefing,
  BrewDetailLevelId,
  BrewNewsItem,
  BrewPreferences,
  BrewQuickLink,
  BrewSourceId,
  BrewTopicId,
} from "./types";

/**
 * Turn the briefing corpus into the shape the page renders.
 *
 * This module does exactly one thing: apply the reader's own filters and
 * limits. It computes no metric, derives no severity, and writes no prose about
 * the institution — everything it returns was already written in
 * `demo-brew.ts`. Preferences may only ever subtract.
 *
 * Until this commit the corpus arrived from `GET /v1/staff/morning-brew` and
 * this module also renamed the contract's fields. The live read is off for the
 * demo; the mappers are recoverable from git history.
 */

const INT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const ONE_DECIMAL = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Formats a KPI value. Shared by the card and the drill-down. */
export function formatBrewNumber(value: number): string {
  return Number.isInteger(value) ? INT.format(value) : ONE_DECIMAL.format(value);
}

export function formatBrewPercent(value: number): string {
  return `${ONE_DECIMAL.format(value)}%`;
}

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

/* ------------------------------------------------------------------- builder */

export const BREW_QUICK_LINKS: BrewQuickLink[] = [
  { id: "students", label: "Student roster", destination: "students" },
  { id: "tasks", label: "Action Center", destination: "tasks" },
  { id: "messages", label: "Messages", destination: "messages" },
  { id: "edward", label: "Ask Edward", destination: "edward" },
];

/**
 * The news list is a constant, so "building" it is only ever filtering: the
 * topics the reader follows, bounded by the depth they asked for. No story is
 * scored, reordered by relevance, or joined to a student.
 */
function newsFor(preferences: BrewPreferences, topics: Set<BrewTopicId>): BrewNewsItem[] {
  return HIGHER_ED_NEWS.filter((item) => topics.has(item.topic)).slice(0, newsLimit(preferences));
}

/**
 * The deck the corpus wrote, lengthened by its own first bullet when the reader
 * asked for the read-across in full. Nothing here composes a sentence.
 */
function deckFor(preferences: BrewPreferences, source: BrewDemoSource): string {
  const full =
    enabled(preferences, "intelligence") && levelOf(preferences, "intelligence") === "deep";
  if (full && source.synthesis.bullets.length) {
    return `${source.synthesis.headline} ${source.synthesis.bullets[0]}`;
  }
  return source.synthesis.headline;
}

/**
 * Assemble today's briefing from the corpus and the reader's choices.
 *
 * Preferences only ever subtract. A section the reader switched off is empty; a
 * topic they do not follow is filtered out; a shallower level is a shorter
 * slice. Nothing here can add a value the corpus did not hold.
 */
export function buildBrewBriefing(
  source: BrewDemoSource,
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

  const kpis = source.kpis
    .filter((kpi) => topics.has(kpi.topic))
    .slice(0, kpiLimit(preferences));

  const insights = source.insights
    .filter((item) => topics.has(item.topic))
    .slice(0, insightLimit(preferences));

  const deadlineItems = source.deadlines
    .filter((deadline) => topics.has(deadline.topic))
    .slice(0, deadlineLimit(preferences));

  // An urgent request reaches the reader even from a topic they do not follow:
  // a student waiting on money is not a subject preference.
  const requestItems = source.requests
    .filter((request) => topics.has(request.topic) || request.priority === "urgent")
    .slice(0, requestLimit(preferences));

  const priorities = source.priorities
    .filter((priority) => topics.has(priority.topic))
    .slice(0, priorityLimit(preferences));

  return {
    greetingName: staffName.split(" ")[0] || "there",
    deck: deckFor(preferences, source),
    bullets: intelligence ? source.synthesis.bullets : [],
    readTimeMinutes: readTimeFor(preferences),
    updatedAt: source.generatedAt,
    windowLabel: source.windowLabel,
    deliveryLabel: preferences.deliveryTime.replace(/^0/, ""),
    students: source.students,
    insights: intelligence ? insights : [],
    kpis: pulse ? kpis : [],
    news: news ? newsFor(preferences, topics) : [],
    deadlines: calendar ? deadlineItems : [],
    requests: email ? requestItems : [],
    priorities: actions ? priorities : [],
    quickLinks: BREW_QUICK_LINKS,
    glance: {
      requests: email ? source.glance.requests : 0,
      requestsAwaitingReply: email ? source.glance.requestsAwaitingReply : 0,
      deadlinesOverdue: calendar ? source.glance.deadlinesOverdue : 0,
      deadlinesThisWeek: calendar ? source.glance.deadlinesThisWeek : 0,
    },
    coverage: source.coverage,
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
