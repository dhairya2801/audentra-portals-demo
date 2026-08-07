import type {
  MorningBrewConnectorId,
  MorningBrewPreferences,
  MorningBrewTopicId,
} from "./types";

export interface MorningBrewPreferenceStore {
  load(scope: string): MorningBrewPreferences | null;
  save(scope: string, preferences: Omit<MorningBrewPreferences, "version" | "updatedAt">): MorningBrewPreferences;
}

export const DEFAULT_CONNECTORS: Record<MorningBrewConnectorId, boolean> = {
  outlook: false,
  calendar: false,
  student_crm: true,
};

const STORAGE_PREFIX = "audentra:morning-brew:v2";
const LEGACY_STORAGE_PREFIX = "audentra:morning-brew:v1";
const TOPIC_IDS = new Set<MorningBrewTopicId>([
  "enrollment_admissions",
  "financial_aid",
  "student_operations",
  "executive_performance",
  "industry_policy",
]);
const CONNECTOR_IDS: MorningBrewConnectorId[] = ["outlook", "calendar", "student_crm"];

function isTopic(value: unknown): value is MorningBrewTopicId {
  return typeof value === "string" && TOPIC_IDS.has(value as MorningBrewTopicId);
}

function normalizeConnectors(value: unknown) {
  if (!value || typeof value !== "object") return { ...DEFAULT_CONNECTORS };
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    CONNECTOR_IDS.map((id) => [id, typeof record[id] === "boolean" ? record[id] : DEFAULT_CONNECTORS[id]]),
  ) as Record<MorningBrewConnectorId, boolean>;
}

function migrateLegacy(scope: string): MorningBrewPreferences | null {
  try {
    const raw = window.localStorage.getItem(`${LEGACY_STORAGE_PREFIX}:${scope}`);
    if (!raw) return null;
    const legacy = JSON.parse(raw) as { interests?: string[] };
    const interests = new Set(legacy.interests ?? []);
    const topics: MorningBrewTopicId[] = [];
    if (interests.has("enrollment") || interests.has("admissions")) topics.push("enrollment_admissions");
    if (interests.has("financial_aid") || interests.has("financial_health")) topics.push("financial_aid");
    if (["student_success", "housing", "staff_operations", "alerts", "deadlines"].some((id) => interests.has(id))) topics.push("student_operations");
    if (["institutional_trends", "academics", "campus_life"].some((id) => interests.has(id))) topics.push("executive_performance");
    if (!topics.length) return null;
    return {
      version: 2,
      topics,
      connectors: { ...DEFAULT_CONNECTORS },
      onboardingComplete: false,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export const browserMorningBrewPreferenceStore: MorningBrewPreferenceStore = {
  load(scope) {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:${scope}`);
      if (!raw) return migrateLegacy(scope);
      const value = JSON.parse(raw) as Partial<MorningBrewPreferences>;
      if (value.version !== 2 || !Array.isArray(value.topics) || !value.topics.every(isTopic)) return null;
      return {
        version: 2,
        topics: value.topics,
        connectors: normalizeConnectors(value.connectors),
        onboardingComplete: value.onboardingComplete === true,
        updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },

  save(scope, preferences) {
    const value: MorningBrewPreferences = {
      version: 2,
      topics: [...new Set(preferences.topics)],
      connectors: normalizeConnectors(preferences.connectors),
      onboardingComplete: preferences.onboardingComplete,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(`${STORAGE_PREFIX}:${scope}`, JSON.stringify(value));
    return value;
  },
};
