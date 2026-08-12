const EXPERIENCE_UPDATE_SESSION_PREFIX = "audentra:experience-update-session:v1";

/**
 * A browser portal has no native app-launch lifecycle. Five minutes away from
 * the visible portal is treated as a new visit, while client-side navigation
 * remains part of the same visit.
 */
export const EXPERIENCE_UPDATE_IDLE_MS = 5 * 60_000;

type ExperienceUpdateSession = {
  lastActivityAt: number;
};

const inMemorySessions = new Map<string, ExperienceUpdateSession>();

function readSession(key: string): ExperienceUpdateSession | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return inMemorySessions.get(key) ?? null;
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      !("lastActivityAt" in value) ||
      typeof value.lastActivityAt !== "number" ||
      !Number.isFinite(value.lastActivityAt)
    ) {
      return null;
    }
    const session = { lastActivityAt: value.lastActivityAt };
    inMemorySessions.set(key, session);
    return session;
  } catch {
    // Privacy/storage restrictions must never block the student portal or turn
    // every route navigation into a fresh portal visit.
    return inMemorySessions.get(key) ?? null;
  }
}

function saveSession(key: string, lastActivityAt: number) {
  inMemorySessions.set(key, { lastActivityAt });
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ lastActivityAt }));
  } catch {
    // Without session storage the current mount still behaves correctly.
  }
}

export function studentExperienceUpdateSessionKey(
  tenantId: string,
  studentId: string,
) {
  return `${EXPERIENCE_UPDATE_SESSION_PREFIX}:${tenantId}:${studentId}`;
}

/** Return true only when this is a new portal visit eligible for a modal. */
export function beginExperienceUpdateVisit(key: string, now = Date.now()) {
  const previous = readSession(key);
  const isNewVisit =
    previous === null || now - previous.lastActivityAt >= EXPERIENCE_UPDATE_IDLE_MS;
  saveSession(key, now);
  return isNewVisit;
}

/** Record meaningful in-portal activity without re-presenting a modal. */
export function touchExperienceUpdateVisit(key: string, now = Date.now()) {
  saveSession(key, now);
}
