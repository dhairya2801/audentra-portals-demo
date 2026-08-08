import {
  BREW_INCLUDE_IDS,
  BREW_READING_SOURCES,
  BREW_TOPIC_IDS,
  DEFAULT_BREW_INCLUDES,
  DEFAULT_BREW_TOPICS,
  DEFAULT_READING_SOURCES,
} from "./catalog";
import type {
  BrewDeliveryTime,
  BrewDepthId,
  BrewIncludeId,
  BrewInboxDepthId,
  BrewInsightDetailId,
  BrewPreferences,
  BrewPulseDefault,
  BrewTopicId,
  BrewToneId,
} from "./types";

export interface BrewPreferenceStore {
  load(scope: string): BrewPreferences | null;
  save(scope: string, preferences: Omit<BrewPreferences, "version" | "updatedAt">): BrewPreferences;
  clear(scope: string): void;
}

const STORAGE_PREFIX = "audentra:morning-brew:v4";
/** Earlier shapes: v3 kept separate connector/section maps, v1–v2 broad topics. */
const LEGACY_PREFIXES = [
  "audentra:morning-brew:v3",
  "audentra:morning-brew:v2",
  "audentra:morning-brew:v1",
];

const TOPIC_IDS = new Set<string>(BREW_TOPIC_IDS);
const SOURCE_IDS = new Set<string>(BREW_READING_SOURCES.map((source) => source.id));
const DEPTHS = new Set<string>(["headlines", "balanced", "deep"]);
const TONES = new Set<string>(["executive", "narrative"]);
const TIMES = new Set<string>(["06:00", "06:30", "07:00", "07:30"]);
const INBOX_DEPTHS = new Set<string>(["urgent", "handful", "everything"]);
const INSIGHT_DETAILS = new Set<string>(["headline", "impact", "full"]);
const PULSE_DEFAULTS = new Set<string>(["auto", "yesterday", "week", "month", "year"]);

export const DEFAULT_BREW_PREFERENCES: Omit<BrewPreferences, "version" | "updatedAt"> = {
  topics: DEFAULT_BREW_TOPICS,
  include: DEFAULT_BREW_INCLUDES,
  depth: "balanced",
  tone: "executive",
  deliveryTime: "07:00",
  inboxDepth: "handful",
  draftReplies: true,
  calendarPrep: true,
  pulseDefault: "auto",
  insightDetail: "full",
  readingSources: DEFAULT_READING_SOURCES,
  onboardingComplete: false,
};

function normalizeTopics(value: unknown): BrewTopicId[] {
  if (!Array.isArray(value)) return [...DEFAULT_BREW_TOPICS];
  const topics = value.filter((item): item is BrewTopicId => typeof item === "string" && TOPIC_IDS.has(item));
  return topics.length ? [...new Set(topics)] : [...DEFAULT_BREW_TOPICS];
}

function normalizeInclude(value: unknown): Record<BrewIncludeId, boolean> {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return Object.fromEntries(
    BREW_INCLUDE_IDS.map((id) => [
      id,
      typeof record[id] === "boolean" ? record[id] : DEFAULT_BREW_INCLUDES[id],
    ]),
  ) as Record<BrewIncludeId, boolean>;
}

function normalizeSources(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_READING_SOURCES];
  const sources = value.filter((item): item is string => typeof item === "string" && SOURCE_IDS.has(item));
  return sources.length ? [...new Set(sources)] : [...DEFAULT_READING_SOURCES];
}

function normalize(value: Partial<BrewPreferences>): BrewPreferences {
  return {
    version: 4,
    topics: normalizeTopics(value.topics),
    include: normalizeInclude(value.include),
    depth: DEPTHS.has(String(value.depth)) ? (value.depth as BrewDepthId) : "balanced",
    tone: TONES.has(String(value.tone)) ? (value.tone as BrewToneId) : "executive",
    deliveryTime: TIMES.has(String(value.deliveryTime))
      ? (value.deliveryTime as BrewDeliveryTime)
      : "07:00",
    inboxDepth: INBOX_DEPTHS.has(String(value.inboxDepth))
      ? (value.inboxDepth as BrewInboxDepthId)
      : "handful",
    draftReplies: value.draftReplies !== false,
    calendarPrep: value.calendarPrep !== false,
    pulseDefault: PULSE_DEFAULTS.has(String(value.pulseDefault))
      ? (value.pulseDefault as BrewPulseDefault)
      : "auto",
    insightDetail: INSIGHT_DETAILS.has(String(value.insightDetail))
      ? (value.insightDetail as BrewInsightDetailId)
      : "full",
    readingSources: normalizeSources(value.readingSources),
    onboardingComplete: value.onboardingComplete === true,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  };
}

/**
 * Carry a returning reader's shape forward where we can, then send them back
 * through setup so they can answer the questions this version adds.
 */
function migrateLegacy(scope: string): BrewPreferences | null {
  for (const prefix of LEGACY_PREFIXES) {
    try {
      const raw = window.localStorage.getItem(`${prefix}:${scope}`);
      if (!raw) continue;
      const legacy = JSON.parse(raw) as {
        topics?: string[];
        teams?: string[];
        interests?: string[];
        connectors?: Record<string, boolean>;
        sections?: Record<string, boolean>;
        depth?: string;
        tone?: string;
        deliveryTime?: string;
      };
      const previous = new Set([...(legacy.topics ?? []), ...(legacy.teams ?? []), ...(legacy.interests ?? [])]);
      const topics: BrewTopicId[] = [];
      if (previous.has("financial_aid") || previous.has("financial_health")) topics.push("financial_aid");
      if (previous.has("admissions") || previous.has("enrollment_admissions") || previous.has("enrollment"))
        topics.push("admissions");
      if (previous.has("student_success") || previous.has("student_operations")) topics.push("student_success");
      if (previous.has("housing")) topics.push("housing");
      if (previous.has("registrar") || previous.has("academics") || previous.has("executive_performance"))
        topics.push("registrar");
      if (!topics.length) continue;

      return normalize({
        ...DEFAULT_BREW_PREFERENCES,
        topics,
        include: {
          inbox: legacy.connectors?.outlook ?? true,
          calendar: legacy.connectors?.calendar ?? true,
          numbers: legacy.sections?.pulse ?? true,
          signals: legacy.sections?.insights ?? true,
          movements: legacy.sections?.changes ?? true,
          headlines: legacy.sections?.news ?? true,
        },
        depth: legacy.depth as BrewDepthId | undefined,
        tone: legacy.tone as BrewToneId | undefined,
        deliveryTime: legacy.deliveryTime as BrewDeliveryTime | undefined,
        onboardingComplete: false,
      });
    } catch {
      // A malformed legacy entry should never block today's briefing.
    }
  }
  return null;
}

export const browserBrewPreferenceStore: BrewPreferenceStore = {
  load(scope) {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:${scope}`);
      if (!raw) return migrateLegacy(scope);
      const value = JSON.parse(raw) as Partial<BrewPreferences>;
      if (value.version !== 4) return migrateLegacy(scope);
      return normalize(value);
    } catch {
      return null;
    }
  },

  save(scope, preferences) {
    const value = normalize({ ...preferences, updatedAt: new Date().toISOString() });
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}:${scope}`, JSON.stringify(value));
    } catch {
      // Storage can be unavailable in private windows; the session still works.
    }
    return value;
  },

  clear(scope) {
    try {
      window.localStorage.removeItem(`${STORAGE_PREFIX}:${scope}`);
    } catch {
      // Nothing to do — the reader simply sees setup again next visit.
    }
  },
};
