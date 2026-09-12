import type { BrewKpiComparison, BrewRequest } from "./types";

export const initialsOf = (name: string) =>
  name
    .replace(/^(Dr\.?|Prof\.?)\s+/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .filter((_, index, parts) => index === 0 || index === parts.length - 1)
    .join("")
    .toUpperCase();

export function movementLabel(label: string, compact = false): string {
  if (/yesterday/i.test(label)) return "Since yesterday";
  if (/7 days/i.test(label)) return compact ? "7 days" : "Over the last 7 days";
  if (/30 days/i.test(label))
    return compact ? "30 days" : "Over the last 30 days";
  if (/last year/i.test(label))
    return compact ? "Last year" : "Since this time last year";
  return label.replace(/^(vs\.?|versus)\s*/i, "Since ");
}
export const movementTone = (comparison: BrewKpiComparison) =>
  comparison.direction === "flat"
    ? "is-neutral"
    : comparison.favorable
      ? "is-good"
      : "is-watch";
export const targetStatus = {
  on_track: "On target",
  at_risk: "At risk",
  off_target: "Off target",
} as const;

// Presentation-only metadata for the existing pinned demo. No inbox ranking,
// provider writes, or pending-response inference runs here.
const EMAIL_DEMO: Record<
  string,
  { receivedAt: string; pendingResponse: boolean; avatarUrl?: string }
> = {
  "r-1": { receivedAt: "2025-05-19T21:00:00-04:00", pendingResponse: true },
  "r-2": { receivedAt: "2025-05-20T06:30:00-04:00", pendingResponse: true },
  "r-3": { receivedAt: "2025-05-20T06:45:00-04:00", pendingResponse: false },
  "r-4": { receivedAt: "2025-05-20T07:15:00-04:00", pendingResponse: true },
  "r-5": { receivedAt: "2025-05-20T06:12:00-04:00", pendingResponse: true },
  "r-6": { receivedAt: "2025-05-20T05:58:00-04:00", pendingResponse: true },
  "r-7": { receivedAt: "2025-05-19T16:40:00-04:00", pendingResponse: true },
  "r-8": { receivedAt: "2025-05-19T14:15:00-04:00", pendingResponse: true },
  "r-9": { receivedAt: "2025-05-19T11:05:00-04:00", pendingResponse: true },
};
export function emailPresentation(request: BrewRequest) {
  const demo = EMAIL_DEMO[request.id];
  const signal = request.unread
    ? "unread"
    : demo?.pendingResponse
      ? "pending"
      : request.important
        ? "flagged"
        : "read";
  return {
    ...demo,
    signal,
    label: {
      unread: "Unread",
      pending: "Pending response",
      flagged: "Flagged / Important",
      read: "Read",
    }[signal],
  };
}

/** Calendar-day comparisons in the briefing's timezone, including DST boundaries. */
export function formatEmailTimestamp(
  timestamp: string | undefined,
  reference: string,
  fallback = "",
): string {
  if (!timestamp) return fallback;
  const date = new Date(timestamp),
    now = new Date(reference);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(now.getTime()))
    return fallback;
  const timeZone = "America/New_York";
  const day = (value: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(value);
    const part = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value);
    return Date.UTC(part("year"), part("month") - 1, part("day"));
  };
  const dayOfDate = day(date),
    today = day(now),
    elapsed = Math.round((today - dayOfDate) / 86400000);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  if (elapsed === 0) return time;
  if (elapsed === 1) return `Yesterday, ${time}`;
  const weekday = (new Date(today).getUTCDay() + 6) % 7;
  if (elapsed > 1 && elapsed <= weekday)
    return `${new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(date)}, ${time}`;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    ...(new Date(today).getUTCFullYear() !==
    new Date(dayOfDate).getUTCFullYear()
      ? { year: "numeric" as const }
      : {}),
  }).format(date);
}

/** Short editorial labels for the existing demo findings in setup previews. */
export const insightPreviewActions: Record<string, string> = {
  "commuter-deposit-pace": "Reach 312 students awaiting aid.",
  "verification-backlog": "Add 2 reviewers for priority files.",
  "transfer-volume": "Add events at key feeder colleges.",
  "housing-signing-lag": "Clear aid holds, then assign rooms.",
  "orientation-melt-signal": "Rebalance sessions and follow up.",
  "discount-rate-creep": "Adjust the top two merit bands.",
};
