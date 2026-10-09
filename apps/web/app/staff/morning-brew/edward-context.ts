import { topicById } from "./catalog";
import type { BrewBriefing, BrewDetailRef, EdwardRequest } from "./types";
import type { StaffEdwardOpening } from "../../lib/staff-edward-opening";

/** Displayed demo figures are labeled reference context, never canonical institutional evidence. */
export function brewEdwardOpening(
  request: EdwardRequest,
  briefing: BrewBriefing,
  detail: BrewDetailRef | null,
): StaffEdwardOpening {
  const candidates = [...briefing.kpis, ...briefing.insights];
  const card = candidates.find(
    (item) => item.id === (request.sourceId ?? detail?.id),
  );
  const metric = briefing.kpis.find(
    (item) => item.id === (request.sourceId ?? detail?.id),
  );
  const comparison = request.pulseComparison ?? metric?.comparisons[0];
  const day = [
    ...briefing.meetings,
    ...briefing.requests,
    ...briefing.priorities,
  ].find((item) => item.id === (request.sourceId ?? detail?.id));
  const label = card?.label ?? request.context;
  const subject = /verification/i.test(label)
    ? "financial aid verification"
    : /orientation/i.test(label)
      ? "orientation registration"
      : /deposit/i.test(label)
        ? "deposits"
        : label;
  return {
    context: {
      surface: "morning_brew",
      sourceId: card?.id ?? day?.id ?? request.context,
      topic: card?.topic ?? day?.topic ?? "briefing",
      label,
      dataOrigin: "demo",
      displayedAsOf: briefing.updatedAt,
      ...(card ? { cohort: card.cohort } : {}),
      ...(metric
        ? {
            displayedPulse: {
              metric: metric.label,
              value: metric.display,
              target: metric.targetDisplay,
              period: metric.window,
              comparison: comparison
                ? `${comparison.label}: ${comparison.delta}${comparison.percent ? ` (${comparison.percent})` : ""}`
                : null,
              forecast: metric.projection
                ? `${metric.projection.display} ${metric.projection.byLabel}`
                : null,
              definition: metric.detail.definition,
              topics: [...new Set(briefing.kpis.map((k) => topicById(k.topic)?.title ?? k.topic))],
            },
          }
        : {}),
    },
    greeting: `Hi! What would you like to know about ${subject}?`,
    ...(request.question?.trim() ? { question: request.question } : {}),
  };
}
