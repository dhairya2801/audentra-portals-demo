"use client";

import { useCallback, useMemo, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import { ErrorState, LoadingState } from "../components/portal-ui";
import { useActivityTracking } from "../hooks/use-activity-tracking";
import { useApiResource } from "../hooks/use-api-resource";
import { getCampusLife } from "../lib/api-client";

function eventDate(value: string) {
  return {
    month: new Intl.DateTimeFormat("en-US", {
      month: "short",
      timeZone: "UTC",
    }).format(new Date(value)),
    day: new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(value)),
    time: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(new Date(value)),
  };
}

export default function CampusLifePage() {
  const load = useCallback((signal: AbortSignal) => getCampusLife(signal), []);
  const campus = useApiResource(load);
  const { track } = useActivityTracking();
  const [eventIndex, setEventIndex] = useState(0);
  const [clubQuery, setClubQuery] = useState("");
  const [expandedClub, setExpandedClub] = useState<string | null>(null);

  const filteredClubs = useMemo(() => {
    if (!campus.data) return [];
    const query = clubQuery.trim().toLowerCase();
    if (!query) return campus.data.clubs;
    return campus.data.clubs.filter((club) =>
      `${club.name} ${club.category} ${club.description}`
        .toLowerCase()
        .includes(query),
    );
  }, [campus.data, clubQuery]);

  if (campus.status === "loading") {
    return (
      <PortalShell
        active="campus_life"
        eyebrow="My campus life"
        title="Find your people"
        description="Events, clubs, and the communities that make Aster feel like home."
      >
        <LoadingState label="Loading campus life" />
      </PortalShell>
    );
  }

  if (campus.status === "error") {
    return (
      <PortalShell
        active="campus_life"
        eyebrow="My campus life"
        title="Find your people"
        description="Events, clubs, and the communities that make Aster feel like home."
      >
        <ErrorState message={campus.error} onRetry={campus.reload} />
      </PortalShell>
    );
  }

  const events = campus.data.events;
  const activeEvent = events[eventIndex] ?? events[0];
  const date = activeEvent ? eventDate(activeEvent.startsAt) : null;

  const showEvent = (index: number) => {
    const normalized = (index + events.length) % events.length;
    setEventIndex(normalized);
    const event = events[normalized];
    if (event) {
      track("ui.campus_event_viewed.v1", {
        event_id: event.id,
        surface: "featured_carousel",
      });
    }
  };

  return (
    <PortalShell
      active="campus_life"
      eyebrow="My campus life"
      title="Find your people"
      description="Events, clubs, and the communities that make Aster feel like home."
    >
      {activeEvent && date ? (
        <section
          className={`campus-carousel campus-carousel--${activeEvent.accent}`}
          aria-roledescription="carousel"
          aria-label="Featured campus events"
        >
          <div className="campus-carousel__art" aria-hidden="true">
            <span>{activeEvent.category}</span>
            <b>{date.day}</b>
            <strong>{date.month}</strong>
          </div>
          <div className="campus-carousel__content">
            <p className="eyebrow">Featured this month · {activeEvent.category}</p>
            <h2>{activeEvent.title}</h2>
            <p>{activeEvent.description}</p>
            <div>
              <span>◷ {date.time}</span>
              <span>⌖ {activeEvent.location}</span>
            </div>
          </div>
          <div className="campus-carousel__controls">
            <button
              type="button"
              aria-label="Previous featured event"
              onClick={() => showEvent(eventIndex - 1)}
            >
              ←
            </button>
            <span>{eventIndex + 1} / {events.length}</span>
            <button
              type="button"
              aria-label="Next featured event"
              onClick={() => showEvent(eventIndex + 1)}
            >
              →
            </button>
          </div>
          <div className="campus-carousel__dots" aria-label="Choose featured event">
            {events.map((event, index) => (
              <button
                className={index === eventIndex ? "is-active" : undefined}
                type="button"
                aria-label={`Show ${event.title}`}
                aria-current={index === eventIndex ? "true" : undefined}
                onClick={() => showEvent(index)}
                key={event.id}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="aster-section campus-clubs">
        <div className="aster-section__heading">
          <div>
            <p className="eyebrow">Student organizations</p>
            <h2>Clubs at Aster</h2>
          </div>
          <p>Open a club to see its contact and next activity.</p>
        </div>
        <label className="club-search">
          <span>Search clubs</span>
          <input
            value={clubQuery}
            placeholder="Technology, business, outdoors…"
            onChange={(event) => setClubQuery(event.target.value)}
          />
        </label>
        <div className="club-grid">
          {filteredClubs.map((club, index) => {
            const expanded = expandedClub === club.id;
            return (
              <article key={club.id}>
                <div className={`club-monogram club-monogram--${index % 4}`}>
                  {club.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join("")}
                </div>
                <small>{club.category}</small>
                <h3>{club.name}</h3>
                <p>{club.description}</p>
                <div className="club-update">
                  <span>Latest</span>
                  <p>{club.latestUpdate}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedClub(expanded ? null : club.id);
                    track("ui.club_viewed.v1", {
                      club_id: club.id,
                      surface: "club_directory",
                    });
                  }}
                >
                  {expanded ? "Hide details" : "Contact & activities"}{" "}
                  <span aria-hidden="true">{expanded ? "↑" : "→"}</span>
                </button>
                {expanded ? (
                  <div className="club-details">
                    <strong>{club.contactName}</strong>
                    <span>{club.contactRole}</span>
                    <a href={`mailto:${club.contactChannel}`}>{club.contactChannel}</a>
                    {club.nextActivity ? <p>{club.nextActivity}</p> : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </PortalShell>
  );
}
