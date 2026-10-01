import type { BrewBriefing, BrewDetailRef, EdwardRequest } from "./types";
import type { StaffEdwardOpening } from "../../lib/staff-edward-opening";

/** Only navigation/scope metadata crosses this boundary, never mock figures or student IDs. */
export function brewEdwardOpening(request: EdwardRequest, briefing: BrewBriefing, detail: BrewDetailRef | null): StaffEdwardOpening {
  const candidates = [...briefing.kpis, ...briefing.insights];
  const card = candidates.find(item => item.id === (request.sourceId ?? detail?.id));
  const day = [...briefing.meetings, ...briefing.requests, ...briefing.priorities].find(item => item.id === (request.sourceId ?? detail?.id));
  const label = card?.label ?? request.context;
  const subject = /verification/i.test(label) ? "financial aid verification"
    : /orientation/i.test(label) ? "orientation registration"
    : /deposit/i.test(label) ? "deposits" : label;
  return {
    context: {
      surface: "morning_brew", sourceId: card?.id ?? day?.id ?? request.context,
      topic: card?.topic ?? day?.topic ?? "briefing", label,
      dataOrigin: "demo", displayedAsOf: briefing.updatedAt,
      ...(card ? { cohort: card.cohort } : {}),
    },
    greeting: `Hi! What would you like to know about ${subject}?`,
    ...(request.question?.trim() ? {question: request.question} : {}),
  };
}
