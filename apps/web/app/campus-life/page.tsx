"use client";

import { useCallback, useMemo, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import { ErrorState, LoadingState } from "../components/portal-ui";
import { useActivityTracking } from "../hooks/use-activity-tracking";
import { useApiResource } from "../hooks/use-api-resource";
import { getCampusLife } from "../lib/api-client";
import { safePortalDestination } from "../lib/safe-destination";
import { useTenant } from "../components/tenant-provider";
import { TenantLink as Link } from "../components/tenant-link";

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
  const { tenant } = useTenant();
  const load = useCallback((signal: AbortSignal) => getCampusLife(signal), []);
  const campus = useApiResource(load);
  const { track } = useActivityTracking();
  const [eventIndex, setEventIndex] = useState(0);
  const [clubQuery, setClubQuery] = useState("");
  const [clubCategory, setClubCategory] = useState("all");

  const clubCategories = useMemo(() => {
    if (!campus.data) return [];
    return Array.from(
      new Set(campus.data.clubs.map((club) => club.category)),
    ).sort((left, right) => left.localeCompare(right));
  }, [campus.data]);

  const filteredClubs = useMemo(() => {
    if (!campus.data) return [];
    const query = clubQuery.trim().toLowerCase();
    return campus.data.clubs.filter((club) => {
      const matchesCategory =
        clubCategory === "all" || club.category === clubCategory;
      const matchesQuery =
        !query ||
        `${club.name} ${club.category} ${club.description}`
          .toLowerCase()
          .includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [campus.data, clubCategory, clubQuery]);

  if (campus.status === "loading") {
    return (
      <PortalShell
        active="campus_life"
        eyebrow="My campus life"
        title="Find your people"
        description={`Events, clubs, and communities published for ${tenant.shortName} students.`}
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
        description={`Events, clubs, and communities published for ${tenant.shortName} students.`}
      >
        <ErrorState message={campus.error} onRetry={campus.reload} />
      </PortalShell>
    );
  }

  const events = campus.data.events;
  const activeEvent = events[eventIndex] ?? events[0];
  const date = activeEvent ? eventDate(activeEvent.startsAt) : null;
  const activeRegistration = safePortalDestination(
    activeEvent?.registrationUrl,
    "/campus-life",
  );
  const hasActiveRegistration =
    Boolean(activeEvent?.registrationUrl) &&
    activeRegistration.href !== "/campus-life";
  const activeSource = safePortalDestination(
    activeEvent?.source?.url,
    "/campus-life",
  );
  const activeImageSource = safePortalDestination(
    activeEvent?.imageSourceUrl,
    "/campus-life",
  );

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
      description={`Events, clubs, and communities published for ${tenant.shortName} students.`}
    >
      <section className="campus-overview" aria-label="Campus life overview">
        <article>
          <strong>{events.length}</strong>
          <span>Upcoming experiences</span>
          <small>Events published for this tenant</small>
        </article>
        <article>
          <strong>{campus.data.clubs.length}</strong>
          <span>Student organizations</span>
          <small>Search by interest or community</small>
        </article>
        <article>
          <strong>{new Set(campus.data.clubs.map((club) => club.category)).size}</strong>
          <span>Interest areas</span>
          <small>Technology, service, culture, and more</small>
        </article>
      </section>

      {activeEvent && date ? (
        <section
          className={`campus-carousel campus-carousel--${activeEvent.accent} campus-carousel--theme-${activeEvent.visualTheme ?? "community"}`}
          data-visual-theme={activeEvent.visualTheme ?? "community"}
          aria-roledescription="carousel"
          aria-label="Featured campus events"
        >
          <div className="campus-carousel__art" aria-hidden="true">
            <span>{activeEvent.category}</span>
            <b>{date.day}</b>
            <strong>{date.month}</strong>
          </div>
          <div className="campus-carousel__content">
            {activeEvent.imageUrl ? (
              <img
                className="campus-carousel__background"
                src={activeEvent.imageUrl}
                alt={activeEvent.imageAlt ?? ""}
              />
            ) : null}
            <span className="campus-carousel__backdrop" aria-hidden="true" />
            <span className="campus-carousel__live">
              <i aria-hidden="true" /> Live campus calendar
            </span>
            <p className="eyebrow">Featured this month · {activeEvent.category}</p>
            <h2>{activeEvent.title}</h2>
            <p>{activeEvent.description}</p>
            {activeEvent.source && activeSource.external ? (
              <a
                className="campus-source-link"
                href={activeSource.href}
                target="_blank"
                rel="noreferrer"
              >
                {activeEvent.source.dataStatus === "synthetic_preview"
                  ? "Preview inspired by"
                  : "Event source"}
                {" · "}
                {activeEvent.source.label}
                <span aria-hidden="true"> ↗</span>
              </a>
            ) : null}
            <div className="campus-carousel__meta">
              <span>◷ {date.time}</span>
              <span>⌖ {activeEvent.location}</span>
              {hasActiveRegistration && activeRegistration.external ? (
                <a
                  href={activeRegistration.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  Registration details ↗
                </a>
              ) : hasActiveRegistration ? (
                <Link href={activeRegistration.href}>Registration details →</Link>
              ) : null}
            </div>
            {activeEvent.imageAttribution ? (
              activeImageSource.external ? (
                <a
                  className="campus-carousel__credit"
                  href={activeImageSource.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {activeEvent.imageAttribution} <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <span className="campus-carousel__credit">
                  {activeEvent.imageAttribution}
                </span>
              )
            ) : null}
            <span className="campus-carousel__feature-number" aria-hidden="true">
              0{eventIndex + 1}
            </span>
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
            <h2>Clubs at {tenant.shortName}</h2>
          </div>
          <p>Open a club to see its contact and next activity.</p>
        </div>
        <div className="club-directory-tools">
          <label className="club-search">
            <span>Search clubs</span>
            <input
              value={clubQuery}
              placeholder="Technology, business, outdoors…"
              onChange={(event) => setClubQuery(event.target.value)}
            />
          </label>
          <div className="club-category-filters" aria-label="Filter clubs by category">
            <button
              className={clubCategory === "all" ? "is-active" : undefined}
              type="button"
              aria-pressed={clubCategory === "all"}
              onClick={() => setClubCategory("all")}
            >
              All clubs
              <span>{campus.data.clubs.length}</span>
            </button>
            {clubCategories.map((category) => {
              const count = campus.data.clubs.filter(
                (club) => club.category === category,
              ).length;
              return (
                <button
                  className={clubCategory === category ? "is-active" : undefined}
                  type="button"
                  aria-pressed={clubCategory === category}
                  onClick={() => setClubCategory(category)}
                  key={category}
                >
                  {category}
                  <span>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="club-grid">
          {filteredClubs.map((club, index) => (
              <Link
                className="club-directory-card"
                href={`/campus-life/clubs/${club.id}`}
                key={club.id}
                onClick={() => {
                  track("ui.club_viewed.v1", {
                    club_id: club.id,
                    surface: "club_directory",
                  });
                }}
              >
                <div className={`club-monogram club-monogram--${index % 4}`}>
                  <img src={club.imageUrl} alt={club.imageAlt} />
                </div>
                <small>{club.category}</small>
                <h3>{club.name}</h3>
                <p>{club.description}</p>
                <div className="club-update">
                  <span>Latest</span>
                  <p>{club.latestUpdate}</p>
                </div>
                <span className="club-directory-card__action">
                  Explore club, events & calendar <b aria-hidden="true">→</b>
                </span>
              </Link>
          ))}
        </div>
        {filteredClubs.length === 0 ? (
          <div className="campus-empty-state">
            <span aria-hidden="true">⌕</span>
            <div>
              <strong>No clubs match “{clubQuery}”</strong>
              <p>
                Try another interest, organization name, or category.
                {clubCategory !== "all" ? (
                  <button type="button" onClick={() => setClubCategory("all")}>
                    Show all clubs
                  </button>
                ) : null}
              </p>
            </div>
          </div>
        ) : null}
      </section>
    </PortalShell>
  );
}
