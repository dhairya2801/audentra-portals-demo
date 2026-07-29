"use client";

import type { StudentClubEvent } from "@vv/contracts";
import { useParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { PortalShell } from "../../../components/portal-shell";
import { TenantLink as Link } from "../../../components/tenant-link";
import { ErrorState, LoadingState } from "../../../components/portal-ui";
import { useApiResource } from "../../../hooks/use-api-resource";
import { getCampusLife } from "../../../lib/api-client";
import { useTenant } from "../../../components/tenant-provider";

function eventParts(event: StudentClubEvent) {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  return {
    month: new Intl.DateTimeFormat("en-US", {
      month: "short",
      timeZone: "UTC",
    }).format(start),
    day: new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      timeZone: "UTC",
    }).format(start),
    weekday: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "UTC",
    }).format(start),
    time: `${new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(start)}–${new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(end)}`,
  };
}

export default function ClubDetailPage() {
  const { tenant } = useTenant();
  const params = useParams<{ clubId: string }>();
  const load = useCallback((signal: AbortSignal) => getCampusLife(signal), []);
  const campus = useApiResource(load);
  const club = useMemo(
    () => campus.data?.clubs.find((item) => item.id === params.clubId) ?? null,
    [campus.data, params.clubId],
  );

  if (campus.status === "loading") {
    return (
      <PortalShell
        active="campus_life"
        eyebrow="Student organization"
        title="Opening the club"
        description={`Loading the latest ${tenant.shortName} club calendar.`}
      >
        <LoadingState label="Loading club details" />
      </PortalShell>
    );
  }

  if (campus.status === "error") {
    return (
      <PortalShell
        active="campus_life"
        eyebrow="Student organization"
        title="Club details"
        description={`Student organizations published for ${tenant.shortName}.`}
      >
        <ErrorState message={campus.error} onRetry={campus.reload} />
      </PortalShell>
    );
  }

  if (!club) {
    return (
      <PortalShell
        active="campus_life"
        eyebrow="Student organization"
        title="Club not found"
        description="This club may have been unpublished or moved by campus-life staff."
      >
        <div className="club-detail-missing">
          <span aria-hidden="true">?</span>
          <h2>We could not find that club</h2>
          <p>Return to the directory to explore current student organizations.</p>
          <Link className="button button--primary" href="/campus-life">
            Back to campus life
          </Link>
        </div>
      </PortalShell>
    );
  }

  const events = [...(club.events ?? [])].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt),
  );

  return (
    <PortalShell
      active="campus_life"
      eyebrow="Student organization"
      title={club.name}
      description={club.description}
      actions={
        <Link className="button button--secondary" href="/campus-life">
          ← All clubs
        </Link>
      }
    >
      <section className="club-detail-hero">
        <img src={club.imageUrl} alt={club.imageAlt} />
        <div className="club-detail-hero__wash" aria-hidden="true" />
        <div className="club-detail-hero__content">
          <span>{club.category}</span>
          <h2>{club.name}</h2>
          <p>{club.longDescription ?? club.description}</p>
          <div>
            <a className="button button--accent" href={`mailto:${club.contactChannel}`}>
              Join or ask a question
            </a>
            {club.socialLinks?.map((social) => (
              <a
                className="club-detail-social"
                href={social.url}
                target="_blank"
                rel="noreferrer"
                key={social.url}
              >
                {social.label} ↗
              </a>
            ))}
          </div>
        </div>
        <div className="club-detail-hero__status">
          <i aria-hidden="true" />
          {club.membershipOpen === false ? "Membership paused" : "Welcoming new members"}
        </div>
      </section>

      <section className="club-detail-layout">
        <div>
          <div className="club-detail-section-heading">
            <div>
              <p className="eyebrow">Club calendar</p>
              <h2>Upcoming events</h2>
            </div>
            <span>{events.length} scheduled</span>
          </div>
          <div className="club-event-list">
            {events.length ? (
              events.map((event) => {
                const date = eventParts(event);
                return (
                  <article className="club-event-card" key={event.id}>
                    <time dateTime={event.startsAt}>
                      <span>{date.month}</span>
                      <strong>{date.day}</strong>
                    </time>
                    <div>
                      <span className={`club-event-type club-event-type--${event.category}`}>
                        {event.category}
                      </span>
                      <h3>{event.title}</h3>
                      <p>{event.description}</p>
                      <div className="club-event-card__meta">
                        <span>◷ {date.weekday} · {date.time}</span>
                        <span>⌖ {event.location}</span>
                      </div>
                    </div>
                    {event.registrationUrl ? (
                      <a
                        href={event.registrationUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Register ↗
                      </a>
                    ) : (
                      <a href={`mailto:${club.contactChannel}?subject=${encodeURIComponent(event.title)}`}>
                        Ask about it →
                      </a>
                    )}
                  </article>
                );
              })
            ) : (
              <div className="club-calendar-empty">
                <span aria-hidden="true">◷</span>
                <h3>Events are being planned</h3>
                <p>Contact the student leaders to hear what is coming next.</p>
              </div>
            )}
          </div>
        </div>

        <aside className="club-detail-aside">
          <section>
            <span className="club-detail-aside__icon" aria-hidden="true">◷</span>
            <p className="eyebrow">Regular rhythm</p>
            <h2>Meeting schedule</h2>
            <strong>{club.meetingSchedule ?? "Published by the club"}</strong>
            {club.nextActivity ? <p>Next up: {club.nextActivity}</p> : null}
          </section>
          <section>
            <span className="club-detail-aside__icon" aria-hidden="true">✦</span>
            <p className="eyebrow">Your club contact</p>
            <h2>{club.contactName}</h2>
            <p>{club.contactRole}</p>
            <a href={`mailto:${club.contactChannel}`}>{club.contactChannel}</a>
          </section>
          <section className="club-detail-aside__latest">
            <span>Latest from the team</span>
            <p>{club.latestUpdate}</p>
          </section>
          {club.source ? (
            <a
              className="club-detail-source"
              href={club.source.url}
              target="_blank"
              rel="noreferrer"
            >
              Content source · {club.source.label} ↗
            </a>
          ) : null}
        </aside>
      </section>
    </PortalShell>
  );
}
