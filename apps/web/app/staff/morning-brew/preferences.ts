import {
  BREW_CONNECTOR_IDS,
  BREW_SECTION_IDS,
  BREW_TEAM_IDS,
  DEFAULT_BREW_CONNECTORS,
  DEFAULT_BREW_SECTIONS,
  DEFAULT_BREW_TEAMS,
} from "./catalog";
import type {
  BrewConnectorId,
  BrewDeliveryTime,
  BrewDepthId,
  BrewPreferences,
  BrewSectionId,
  BrewTeamId,
  BrewToneId,
} from "./types";

export interface BrewPreferenceStore {
  load(scope: string): BrewPreferences | null;
  save(scope: string, preferences: Omit<BrewPreferences, "version" | "updatedAt">): BrewPreferences;
  clear(scope: string): void;
}

const STORAGE_PREFIX = "audentra:morning-brew:v3";
/** v1/v2 kept broad topics rather than named campus teams. */
const LEGACY_PREFIXES = ["audentra:morning-brew:v2", "audentra:morning-brew:v1"];

const TEAM_IDS = new Set<string>(BREW_TEAM_IDS);
const DEPTHS = new Set<string>(["headlines", "balanced", "deep"]);
const TONES = new Set<string>(["executive", "narrative"]);
const TIMES = new Set<string>(["06:00", "06:30", "07:00", "07:30"]);

export const DEFAULT_BREW_PREFERENCES: Omit<BrewPreferences, "version" | "updatedAt"> = {
  teams: DEFAULT_BREW_TEAMS,
  connectors: DEFAULT_BREW_CONNECTORS,
  depth: "balanced",
  tone: "executive",
  sections: DEFAULT_BREW_SECTIONS,
  deliveryTime: "07:00",
  onboardingComplete: false,
};

function normalizeTeams(value: unknown): BrewTeamId[] {
  if (!Array.isArray(value)) return [...DEFAULT_BREW_TEAMS];
  const teams = value.filter((item): item is BrewTeamId => typeof item === "string" && TEAM_IDS.has(item));
  return teams.length ? [...new Set(teams)] : [...DEFAULT_BREW_TEAMS];
}

function normalizeConnectors(value: unknown): Record<BrewConnectorId, boolean> {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return Object.fromEntries(
    BREW_CONNECTOR_IDS.map((id) => [
      id,
      typeof record[id] === "boolean" ? record[id] : DEFAULT_BREW_CONNECTORS[id],
    ]),
  ) as Record<BrewConnectorId, boolean>;
}

function normalizeSections(value: unknown): Record<BrewSectionId, boolean> {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return Object.fromEntries(
    BREW_SECTION_IDS.map((id) => [
      id,
      typeof record[id] === "boolean" ? record[id] : DEFAULT_BREW_SECTIONS[id],
    ]),
  ) as Record<BrewSectionId, boolean>;
}

function normalize(value: Partial<BrewPreferences>): BrewPreferences {
  return {
    version: 3,
    teams: normalizeTeams(value.teams),
    connectors: normalizeConnectors(value.connectors),
    depth: DEPTHS.has(String(value.depth)) ? (value.depth as BrewDepthId) : "balanced",
    tone: TONES.has(String(value.tone)) ? (value.tone as BrewToneId) : "executive",
    sections: normalizeSections(value.sections),
    deliveryTime: TIMES.has(String(value.deliveryTime))
      ? (value.deliveryTime as BrewDeliveryTime)
      : "07:00",
    onboardingComplete: value.onboardingComplete === true,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  };
}

/**
 * Earlier releases stored broad interest topics. Map what we can onto the named
 * campus teams so a returning reader keeps their shape, then send them back
 * through onboarding to pick up the newer preferences.
 */
function migrateLegacy(scope: string): BrewPreferences | null {
  for (const prefix of LEGACY_PREFIXES) {
    try {
      const raw = window.localStorage.getItem(`${prefix}:${scope}`);
      if (!raw) continue;
      const legacy = JSON.parse(raw) as { topics?: string[]; interests?: string[] };
      const previous = new Set([...(legacy.topics ?? []), ...(legacy.interests ?? [])]);
      const teams: BrewTeamId[] = [];
      if (previous.has("financial_aid") || previous.has("financial_health")) teams.push("financial_aid");
      if (previous.has("enrollment_admissions") || previous.has("enrollment") || previous.has("admissions"))
        teams.push("admissions");
      if (previous.has("student_operations") || previous.has("student_success")) teams.push("student_success");
      if (previous.has("housing")) teams.push("housing");
      if (previous.has("academics") || previous.has("executive_performance")) teams.push("registrar");
      if (!teams.length) continue;
      return normalize({ ...DEFAULT_BREW_PREFERENCES, teams, onboardingComplete: false });
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
      if (value.version !== 3) return migrateLegacy(scope);
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
      // Nothing to do — the reader simply sees onboarding again next visit.
    }
  },
};
