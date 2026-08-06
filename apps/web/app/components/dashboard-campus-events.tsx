"use client";

import type { CampusEvent } from "@vv/contracts";
import { useMemo, useRef } from "react";
import { safePortalDestination } from "../lib/safe-destination";
import { TenantLink as Link } from "./tenant-link";
import styles from "./dashboard-widgets.module.css";

function eventDate(value: string) {
  const date = new Date(value);
  return {
    month: new Intl.DateTimeFormat("en-US", {
      month: "short",
      timeZone: "UTC",
    }).format(date),
    day: new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      timeZone: "UTC",
    }).format(date),
    detail: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(date),
  };
}

export function DashboardCampusEvents({
  events,
  asOf,
}: {
  events: readonly CampusEvent[];
  asOf: string;
}) {
  const rail = useRef<HTMLUListElement>(null);
  const upcoming = useMemo(
    () =>
      [...events]
        .filter(
          (event) =>
            Date.parse(event.endsAt || event.startsAt) >= Date.parse(asOf),
        )
        .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
        .slice(0, 8),
    [asOf, events],
  );

  const scroll = (direction: -1 | 1) => {
    rail.current?.scrollBy({
      left: direction * Math.max(280, rail.current.clientWidth * 0.76),
      behavior: "smooth",
    });
  };

  return (
    <section className={styles.events} aria-labelledby="dashboard-events-title">
      <header className={styles.widgetHeader}>
        <div>
          <p>Beyond the checklist</p>
          <h2 id="dashboard-events-title">Upcoming campus events</h2>
        </div>
        <div className={styles.eventControls}>
          <button
            type="button"
            aria-label="Scroll campus events backward"
            onClick={() => scroll(-1)}
            disabled={upcoming.length === 0}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Scroll campus events forward"
            onClick={() => scroll(1)}
            disabled={upcoming.length === 0}
          >
            →
          </button>
          <Link href="/campus-life">All campus life</Link>
        </div>
      </header>

      {upcoming.length ? (
        <ul
          ref={rail}
          className={styles.eventRail}
          aria-label="Upcoming campus events"
          aria-roledescription="carousel"
        >
          {upcoming.map((event) => {
            const date = eventDate(event.startsAt);
            const registration = safePortalDestination(
              event.registrationUrl,
              "/campus-life",
            );
            const hasRegistrationDestination =
              Boolean(event.registrationUrl) &&
              registration.href !== "/campus-life";
            return (
              <li className={styles.eventCard} key={event.id}>
                {event.imageUrl ? (
                  <img src={event.imageUrl} alt={event.imageAlt ?? ""} />
                ) : (
                  <span className={styles.eventArt} aria-hidden="true">
                    {event.category.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className={styles.eventDate} aria-hidden="true">
                  <span>{date.month}</span>
                  <strong>{date.day}</strong>
                </div>
                <div className={styles.eventBody}>
                  <small>{event.category}</small>
                  <h3>{event.title}</h3>
                  <p>{event.description}</p>
                  <div>
                    <time
                      dateTime={event.startsAt}
                      aria-label={`${date.month} ${date.day}, ${date.detail}`}
                    >
                      {date.detail}
                    </time>
                    <span>{event.location}</span>
                  </div>
                  {hasRegistrationDestination && registration.external ? (
                    <a href={registration.href} target="_blank" rel="noreferrer">
                      Registration details <span aria-hidden="true">↗</span>
                    </a>
                  ) : hasRegistrationDestination ? (
                    <Link href={registration.href}>
                      Registration details <span aria-hidden="true">→</span>
                    </Link>
                  ) : (
                    <Link href="/campus-life">
                      Event details <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={styles.eventEmpty}>
          <span aria-hidden="true">◇</span>
          <div>
            <strong>Campus plans are taking shape</strong>
            <p>New events will appear here as soon as they are published.</p>
          </div>
        </div>
      )}
    </section>
  );
}
