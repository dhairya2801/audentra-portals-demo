import { supportedLevel } from "./catalog";
import { HIGHER_ED_NEWS } from "./news";
import type { BrewDemoSource } from "./demo-brew";
import type {
  BrewBriefing,
  BrewDetailLevelId,
  BrewInsight,
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
 * `demo-brew.ts`. Preferences may only ever subtract, with one stated exception
 * described on `insightsFor` below.
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
 * How long a section runs is the source's own answer, not one global setting: a
 * reader who asked for the funnel at a glance and the action center in full
 * gets a short KPI band and a long queue, which is what they said.
 *
 * The level is passed through `supportedLevel` so a stored answer for a depth a
 * source no longer offers reads at the deepest depth it does.
 */
export const levelOf = (
  preferences: BrewPreferences,
  id: BrewSourceId,
): BrewDetailLevelId => supportedLevel(id, preferences.sources[id].detail);

const enabled = (preferences: BrewPreferences, id: BrewSourceId): boolean =>
  preferences.sources[id].enabled;

/** Picks the count for a level, in `[glance, context, deep]` order. */
const byLevel = (level: BrewDetailLevelId, counts: [number, number, number]): number =>
  level === "glance" ? counts[0] : level === "context" ? counts[1] : counts[2];

/**
 * How many KPIs reach the band.
 *
 * The Pulse row is one horizontal row with a next control, so this is the size
 * of the reel rather than the height of the section — a deeper read is worth
 * more cards to page through, not a taller block.
 */
const kpiLimit = (preferences: BrewPreferences) =>
  byLevel(levelOf(preferences, "pulse"), [8, 10, 12]);

/**
 * The three day panels each render four rows and put the rest behind "View
 * more", so the level no longer decides how tall the column is — the panel
 * does. These bounds are the reader's appetite for the whole queue.
 */
const priorityLimit = (preferences: BrewPreferences) =>
  byLevel(levelOf(preferences, "actions"), [9, 10, 14]);
const meetingLimit = (preferences: BrewPreferences) =>
  byLevel(levelOf(preferences, "calendar"), [9, 10, 14]);
const requestLimit = (preferences: BrewPreferences) =>
  byLevel(levelOf(preferences, "email"), [9, 10, 14]);
const newsLimit = (preferences: BrewPreferences) =>
  byLevel(levelOf(preferences, "news"), [4, 4, 4]);

/** The brief prints three findings, at every depth. See `insightsFor`. */
export const BREW_INSIGHT_COUNT = 3;

/**
 * A minute per switched-on source, and a second minute for one asked for in
 * full. It is a reading estimate over what is actually on the page, not a
 * setting the reader chose and we then honour.
 */
function readTimeFor(preferences: BrewPreferences): number {
  const on = Object.values(preferences.sources).filter((source) => source.enabled);
  const deep = on.filter((source) => source.detail === "deep").length;
  return Math.max(1, Math.round(on.length * 0.4 + deep * 0.5));
}

/* ------------------------------------------------------------------- builder */

export const BREW_QUICK_LINKS: BrewQuickLink[] = [
  { id: "overview", label: "Enrollment Dashboard", destination: "overview" },
  { id: "tasks", label: "Team Updates", destination: "tasks" },
  { id: "knowledge", label: "Reports Center", destination: "knowledge" },
  { id: "edward", label: "Ask Edward", destination: "edward" },
];

/**
 * The news list is a constant, so "building" it is only ever filtering: the
 * topics the reader follows, bounded by the depth they asked for. No story is
 * scored, reordered by relevance, or joined to a student.
 *
 * Where a reader's topics leave the band short, stories from outside them fill
 * the row in corpus order. A four-across rail with one card in it looks broken,
 * and the stories are a curated sector feed rather than a per-topic queue.
 */
function newsFor(preferences: BrewPreferences, topics: Set<BrewTopicId>): BrewNewsItem[] {
  const limit = newsLimit(preferences);
  const followed = HIGHER_ED_NEWS.filter((item) => topics.has(item.topic));
  if (followed.length >= limit) return followed.slice(0, limit);
  const rest = HIGHER_ED_NEWS.filter((item) => !topics.has(item.topic));
  return [...followed, ...rest].slice(0, limit);
}

/**
 * Three findings, chosen by what the reader follows.
 *
 * The count is fixed on purpose. Three is what a leader can act on before
 * lunch, and a band that grew with the topics followed would turn a briefing
 * into a backlog. So the reader's topics reorder the pool rather than shorten
 * it: findings inside their topics come first, in corpus order, and the rest
 * pad the band when their choices do not fill it.
 *
 * This is the one place a preference does not purely subtract, and it is worth
 * being explicit about why: a two-card row of findings would read as "there are
 * only two things wrong today", which is a claim about the institution rather
 * than about the reader's settings.
 */
function insightsFor(
  insights: BrewInsight[],
  topics: Set<BrewTopicId>,
): BrewInsight[] {
  const followed = insights.filter((insight) => topics.has(insight.topic));
  const rest = insights.filter((insight) => !topics.has(insight.topic));
  return [...followed, ...rest].slice(0, BREW_INSIGHT_COUNT);
}

/**
 * The deck the corpus wrote, and the bullets under it when the read-across is
 * switched on. Nothing here composes a sentence.
 */
function deckFor(source: BrewDemoSource): string {
  return source.synthesis.headline;
}

/**
 * Assemble today's briefing from the corpus and the reader's choices.
 *
 * A section the reader switched off is empty; a topic they do not follow is
 * filtered out; a shallower level is a shorter slice. Nothing here can add a
 * value the corpus did not hold.
 */
export function buildBrewBriefing(
  source: BrewDemoSource,
  preferences: BrewPreferences,
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

  const insights = insightsFor(source.insights, topics);

  // Bound to what actually ships, because the Calendar card at the top counts
  // the same list the Calendar panel prints — a card reading "9 meetings today"
  // above a switched-off section would be the page contradicting itself.
  const meetings = calendar
    ? source.meetings
        .filter((meeting) => topics.has(meeting.topic))
        .slice(0, meetingLimit(preferences))
    : [];

  // An urgent request reaches the reader even from a topic they do not follow:
  // a provost waiting on a number is not a subject preference.
  const requests = source.requests
    .filter((request) => topics.has(request.topic) || request.priority === "urgent")
    .slice(0, requestLimit(preferences));

  const priorities = source.priorities
    .filter((priority) => topics.has(priority.topic))
    .slice(0, priorityLimit(preferences));

  return {
    // The demo brief is written for one named reader, so the greeting is the
    // corpus's own rather than whichever persona opened the workspace.
    greetingName: source.reader.firstName,
    reader: source.reader,
    cycleLabel: source.cycleLabel,
    deck: deckFor(source),
    bullets: intelligence ? source.synthesis.bullets : [],
    readTimeMinutes: readTimeFor(preferences),
    updatedAt: source.generatedAt,
    windowLabel: source.windowLabel,
    deliveryLabel: preferences.deliveryTime.replace(/^0/, ""),
    students: source.students,
    insights: intelligence ? insights : [],
    kpis: pulse ? kpis : [],
    news: news ? newsFor(preferences, topics) : [],
    meetings,
    requests: email ? requests : [],
    priorities: actions ? priorities : [],
    quickLinks: BREW_QUICK_LINKS,
    glance: {
      // The mailbox total, which is larger than the curated slice below it.
      requests: email ? source.glance.requests : 0,
      requestsAwaitingReply: email ? source.glance.requestsAwaitingReply : 0,
      // The calendar card counts the same meetings the panel prints, so the two
      // can never disagree in front of the reader.
      meetings: meetings.length,
      meetingsHighPriority: meetings.filter((meeting) => meeting.priority === "high").length,
    },
    coverage: source.coverage,
  };
}

/* -------------------------------------------------------------------- edward */

export const EDWARD_SUGGESTIONS = [
  "What should I pay attention to today?",
  "Which commuter admits have not paid a deposit?",
  "Which students have an open financial aid verification?",
  "What is blocking the most students right now?",
  "Which deposited students have not registered for orientation?",
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

/**
 * The question a KPI's Edward button opens with.
 *
 * Addressed to the reader by name and to the figure by its label, because the
 * button sits on one card and a generic opener would make the reader say which
 * card they meant after having already pointed at it.
 */
export function edwardKpiGreeting(firstName: string, label: string): string {
  return `Hello ${firstName}, what would you like to know more about ${label}?`;
}
