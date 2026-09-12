import {
  supportedLevel,
  BREW_SOURCE_IDS,
  BREW_TOPIC_IDS,
  DEFAULT_BREW_SOURCES,
  DEFAULT_BREW_TOPICS,
} from "./catalog";
import type {
  BrewDeliveryTime,
  BrewDetailLevelId,
  BrewPreferences,
  BrewSourceId,
  BrewSourcePreference,
  BrewTopicId,
} from "./types";

export interface BrewPreferenceStore {
  load(scope: string): BrewPreferences | null;
  save(scope: string, preferences: Omit<BrewPreferences, "version" | "updatedAt">): BrewPreferences;
  clear(scope: string): void;
  /** Every scope in this browser, of every shape — what a demo sign-in resets. */
  clearAll(): void;
}

const STORAGE_PREFIX = "audentra:morning-brew:v7";
/**
 * Earlier shapes. v6 asked one question per source — is it in, and how much
 * context does it bring — against five topics named after internal offices
 * (registrar, student success). v7 keeps the source question unchanged and
 * renames the topics to the five a leader actually thinks in: Financial Aid,
 * Admissions, Enrollment, Housing, Campus Life.
 *
 * The topic rename is not a pure relabelling — "student success" split across
 * Enrollment and Campus Life, and "registrar" has no successor at all — so a
 * returning reader is walked back through setup with their nearest topics
 * pre-selected rather than silently assigned a set they never chose.
 */
const LEGACY_PREFIXES = [
  "audentra:morning-brew:v6",
  "audentra:morning-brew:v5",
  "audentra:morning-brew:v4",
  "audentra:morning-brew:v3",
  "audentra:morning-brew:v2",
  "audentra:morning-brew:v1",
];

const TOPIC_IDS = new Set<string>(BREW_TOPIC_IDS);
const DETAIL_LEVELS = new Set<string>(["glance", "context", "deep"]);
const TIMES = new Set<string>(["06:00", "06:30", "07:00", "07:30"]);

export const DEFAULT_BREW_PREFERENCES: Omit<BrewPreferences, "version" | "updatedAt"> = {
  topics: DEFAULT_BREW_TOPICS,
  sources: DEFAULT_BREW_SOURCES,
  deliveryTime: "07:00",
  onboardingComplete: false,
};

function normalizeTopics(value: unknown): BrewTopicId[] {
  if (!Array.isArray(value)) return [...DEFAULT_BREW_TOPICS];
  const topics = value.filter(
    (item): item is BrewTopicId => typeof item === "string" && TOPIC_IDS.has(item),
  );
  return topics.length ? [...new Set(topics)] : [...DEFAULT_BREW_TOPICS];
}

function normalizeSources(value: unknown): Record<BrewSourceId, BrewSourcePreference> {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return Object.fromEntries(
    BREW_SOURCE_IDS.map((id) => {
      const fallback = DEFAULT_BREW_SOURCES[id];
      const stored = record[id];
      if (!stored || typeof stored !== "object") return [id, { ...fallback }];
      const { enabled, detail } = stored as Partial<BrewSourcePreference>;
      return [
        id,
        {
          enabled: typeof enabled === "boolean" ? enabled : fallback.enabled,
          detail: DETAIL_LEVELS.has(String(detail))
            ? supportedLevel(id, detail as BrewDetailLevelId)
            : fallback.detail,
        },
      ];
    }),
  ) as Record<BrewSourceId, BrewSourcePreference>;
}

function normalize(value: Partial<BrewPreferences>): BrewPreferences {
  return {
    version: 7,
    topics: normalizeTopics(value.topics),
    sources: normalizeSources(value.sources),
    deliveryTime: TIMES.has(String(value.deliveryTime))
      ? (value.deliveryTime as BrewDeliveryTime)
      : "07:00",
    onboardingComplete: value.onboardingComplete === true,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  };
}

/** Every source a legacy switch can be read as, with the level it starts at. */
function sourcesFromLegacy(
  include: Record<string, boolean | undefined>,
): Record<BrewSourceId, BrewSourcePreference> {
  // An explicit "on" anywhere wins, then an explicit "off"; a switch the reader
  // never saw falls back to the default rather than being read as a decision.
  const carry = (id: BrewSourceId, ...keys: string[]): BrewSourcePreference => {
    const answers = keys.map((key) => include[key]).filter((value) => typeof value === "boolean");
    return {
      enabled: answers.length ? answers.some(Boolean) : DEFAULT_BREW_SOURCES[id].enabled,
      detail: DEFAULT_BREW_SOURCES[id].detail,
    };
  };
  return {
    pulse: carry("pulse", "numbers", "pulse"),
    // New in v6 and backed by an outside feed, so nothing earlier can speak for
    // it. It starts on and the reader meets it in setup before it ever renders.
    news: { ...DEFAULT_BREW_SOURCES.news },
    calendar: carry("calendar", "deadlines", "calendar"),
    email: carry("email", "requests", "inbox"),
    // v5 gated the queues and the read-across on one "signals" switch. Both
    // carry forward from it, and the reader re-answers them separately.
    actions: carry("actions", "signals"),
    intelligence: carry("intelligence", "signals", "insights"),
  };
}

/**
 * Carry a returning reader's topics and section choices forward where we can,
 * then send them back through setup so they can answer the detail-level
 * question this version adds.
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
        include?: Record<string, boolean>;
        connectors?: Record<string, boolean>;
        sections?: Record<string, boolean>;
        deliveryTime?: string;
      };
      const previous = new Set([
        ...(legacy.topics ?? []),
        ...(legacy.teams ?? []),
        ...(legacy.interests ?? []),
      ]);
      const topics: BrewTopicId[] = [];
      if (previous.has("financial_aid") || previous.has("financial_health"))
        topics.push("financial_aid");
      if (previous.has("admissions") || previous.has("enrollment_admissions"))
        topics.push("admissions");
      // v6's "admissions" covered offers *and* deposits, and its
      // "student_success" covered the blocked-after-deposit cohort. Both of
      // those are Enrollment now.
      if (
        previous.has("enrollment") ||
        previous.has("admissions") ||
        previous.has("student_success") ||
        previous.has("student_operations")
      )
        topics.push("enrollment");
      if (previous.has("housing")) topics.push("housing");
      // "registrar" has no successor: records work reaches the reader through
      // the Action Center now rather than as a subject of its own. A reader who
      // followed it is offered Campus Life, which is the nearest thing to the
      // student-facing half of what they were watching.
      if (
        previous.has("campus_life") ||
        previous.has("registrar") ||
        previous.has("academics") ||
        previous.has("executive_performance")
      )
        topics.push("campus_life");
      if (!topics.length) continue;

      return normalize({
        ...DEFAULT_BREW_PREFERENCES,
        topics,
        sources: sourcesFromLegacy({
          ...(legacy.sections ?? {}),
          ...(legacy.connectors ?? {}),
          ...(legacy.include ?? {}),
        }),
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
      if (value.version !== 7) return migrateLegacy(scope);
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

  /**
   * Signing in as a demo persona starts the demo at the beginning, so whatever
   * a previous visitor answered on this machine — under any scope, and under
   * any earlier shape of the preferences — is dropped rather than inherited.
   */
  clearAll() {
    try {
      const prefixes = [STORAGE_PREFIX, ...LEGACY_PREFIXES];
      const stale = Object.keys(window.localStorage).filter((key) =>
        prefixes.some((prefix) => key.startsWith(`${prefix}:`)),
      );
      for (const key of stale) window.localStorage.removeItem(key);
    } catch {
      // Storage can be unavailable; the reader simply keeps what they had.
    }
  },
};
