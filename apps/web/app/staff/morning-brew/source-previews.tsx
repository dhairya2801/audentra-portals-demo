"use client";

import {
  CalendarRow,
  EmailRow,
  NewsCard,
  PriorityRow,
} from "./cards";
import { InstitutionalInsightCard } from "./insight-card";
import { PulseCard } from "./pulse";
import type { BrewBriefing, BrewDetailLevelId, BrewSourceId } from "./types";

/** The same content and components as the final briefing, with a bounded sample.
 * Inert prevents nested controls inside the setup option's radio button. */
export function SourcePreview({
  sourceId,
  level,
  briefing,
}: {
  sourceId: BrewSourceId;
  level: BrewDetailLevelId;
  briefing: BrewBriefing;
}) {
  const kpi = briefing.kpis[0];
  return (
    <div
      className={`brew-sample brew-sample--${sourceId}`}
      inert
      aria-hidden="true"
    >
      {sourceId === "pulse" && kpi ? (
        <>
          <PulseCard
            kpi={kpi}
            level={level}
            readerFirstName={briefing.reader.firstName}
          />
        </>
      ) : null}
      {sourceId === "intelligence" && briefing.insights[0] ? (
        <InstitutionalInsightCard
          insight={briefing.insights[0]}
          level={level}
        />
      ) : null}
      {sourceId === "email" ? (
        <ul className="brew-list brew-list--emails">
          {briefing.requests.slice(0, 1).map((request) => (
            <EmailRow
              key={request.id}
              request={request}
              level={level}
              referenceDate={briefing.updatedAt}
            />
          ))}
        </ul>
      ) : null}
      {sourceId === "calendar" ? (
        <ul className="brew-list brew-list--meetings">
          {briefing.meetings.slice(0, 1).map((meeting) => (
            <CalendarRow key={meeting.id} meeting={meeting} level={level} />
          ))}
        </ul>
      ) : null}
      {sourceId === "actions" ? (
        <ul className="brew-list brew-list--priorities">
          {briefing.priorities.slice(0, 1).map((priority) => (
            <PriorityRow key={priority.id} priority={priority} level={level} />
          ))}
        </ul>
      ) : null}
      {sourceId === "news" ? (
        <ol className="brew-sample__news">
          {briefing.news.slice(0, 1).map((item) => (
            <NewsCard key={item.id} item={item} level={level} />
          ))}
        </ol>
      ) : null}
    </div>
  );
}
