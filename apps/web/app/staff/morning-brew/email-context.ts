import type { BrewBriefing, BrewMeeting, BrewRequest } from "./types";
export function detectsMeetingRequest(request: BrewRequest) {
  return /\b(meeting|meet with|schedule|availability|appointment|1:1|agenda|calendar invite)\b/i.test(
    `${request.subject} ${request.summary}`,
  );
}
export function meetingStart(meeting: BrewMeeting, reference: string) {
  const date = new Date(reference),
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
  const minute =
    Number(parts.find((x) => x.type === "hour")?.value) * 60 +
    Number(parts.find((x) => x.type === "minute")?.value);
  return new Date(date.getTime() + (meeting.startsAtMinutes - minute) * 60000);
}
export function relatedMeetings(request: BrewRequest, briefing: BrewBriefing) {
  const words = request.subject
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 4);
  return briefing.meetings
    .filter((m) => m.topic === request.topic)
    .sort((a, b) => {
      const score = (m: BrewMeeting) =>
        words.filter((w) => m.title.toLowerCase().includes(w)).length;
      return score(b) - score(a) || a.startsAtMinutes - b.startsAtMinutes;
    });
}
export function proposalDraft(draft: string, time: string) {
  const body = draft.replace(/\n\nProposed time:[\s\S]*$/, "");
  return `${body}\n\nProposed time: Would ${new Date(time).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })} (${Intl.DateTimeFormat().resolvedOptions().timeZone}) work for you? Please confirm; availability has not been checked and no invitation has been sent.`;
}
