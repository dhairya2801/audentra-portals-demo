"use client";

import type { CampusEvent } from "@vv/contracts";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import { StudentPortalIcon } from "../components/student-portal-icon";
import { TenantLink as Link } from "../components/tenant-link";
import { ErrorState, LoadingState } from "../components/portal-ui";
import { useActivityTracking } from "../hooks/use-activity-tracking";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import { getCampusLife, registerCampusEvent } from "../lib/api-client";
import { useTenant } from "../components/tenant-provider";

function dateParts(value: string) {
  return { month: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(value)), day: new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "UTC" }).format(new Date(value)), time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(value)) };
}

export default function CampusLifePage() {
  const { tenant } = useTenant();
  const params = useSearchParams();
  const clubsView = params.get("view") === "clubs";
  const campus = useApiResource(useCallback((signal: AbortSignal) => getCampusLife(signal), []));
  const registration = useApiAction(registerCampusEvent);
  const { track } = useActivityTracking();
  const [registrationEventId, setRegistrationEventId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(() => campus.data ? Array.from(new Set(campus.data.clubs.map((club) => club.category))).sort() : [], [campus.data]);
  const clubs = useMemo(() => campus.data ? campus.data.clubs.filter((club) => (category === "all" || club.category === category) && (!query.trim() || `${club.name} ${club.category} ${club.description}`.toLowerCase().includes(query.trim().toLowerCase()))) : [], [campus.data, category, query]);

  const register = async (event: CampusEvent) => {
    if (event.registrationStatus === "registered") return;
    setRegistrationEventId(event.id);
    try {
      await registration.run(event.id, { expectedVersion: event.version }, crypto.randomUUID());
      campus.refresh();
    } catch {
      // Keep the API's canonical conflict or stale-event message visible.
    }
  };

  return (
    <PortalShell active="campus_life" eyebrow="My Campus Life · Published by Aster Student Life" title="Find your people" description={`Events, clubs, and the people who run them, published for ${tenant.shortName} students.`}>
      {campus.status === "loading" ? <LoadingState label="Loading campus life" /> : campus.status === "error" ? <ErrorState message={campus.error} onRetry={campus.reload} /> : (
        <>
          <div className="page-notice"><div className="notice quiet"><span className="notice-mark"><StudentPortalIcon name="campus" size={14} /></span><span className="notice-copy"><strong>{campus.data.events.length} events and {campus.data.clubs.length} clubs are currently published.</strong> Optional campus life never changes your enrollment progress.</span></div></div>
          <nav className="group-tabs" aria-label="My Campus Life sections"><Link className={!clubsView ? "active" : undefined} href="/campus-life" aria-current={!clubsView ? "page" : undefined}><StudentPortalIcon name="ticket" size={16} /> Events</Link><Link className={clubsView ? "active" : undefined} href="/campus-life?view=clubs" aria-current={clubsView ? "page" : undefined}><StudentPortalIcon name="users" size={16} /> Clubs</Link></nav>
          <div className="page-body"><div className="page-main">
            {!clubsView ? <section className="section-card" aria-labelledby="events-heading"><div className="status-heading"><span className="status-icon accent"><StudentPortalIcon name="ticket" size={20} /></span><div><h2 id="events-heading">Events</h2><p>What’s happening</p></div><div className="sort-group"><button className="selected" aria-pressed="true"><StudentPortalIcon name="spark" size={15} /> For you</button><button aria-pressed="false">Everything</button><button aria-pressed="false">Past</button></div></div>{campus.data.events.length ? <div className="card-rows campus-list">{campus.data.events.map((event) => { const date = dateParts(event.startsAt); const pending = registration.status === "loading" && registrationEventId === event.id; return <article className="campus-row" key={event.id}><span className="date-tile" aria-hidden="true"><small>{date.month}</small><strong>{date.day}</strong></span><span className="campus-row-copy"><span className="campus-row-when">{date.time}<i>·</i>{event.location}</span><span className="campus-row-title"><button type="button" className="row-title-button" onClick={() => track("ui.campus_event_viewed.v1", { event_id: event.id, surface: "event_list" })}>{event.title}</button><span className="category-chip">{event.category}</span></span><span className="campus-row-meta"><span>{event.description}</span></span></span><span className="campus-row-actions"><button className="secondary-button" type="button" disabled={pending || event.registrationStatus === "registered"} onClick={() => void register(event)}>{event.registrationStatus === "registered" ? "Registered" : pending ? "Registering…" : "Register"}</button><button className="text-button follow" type="button"><StudentPortalIcon name="spark" size={14} /> Follow</button></span>{registration.status === "error" && registrationEventId === event.id ? <p className="action-feedback" role="alert">{registration.message} <button type="button" onClick={() => campus.refresh()}>Refresh current events</button></p> : null}</article>; })}</div> : <div className="state-card empty"><h3>No events published yet</h3><p>Student Life’s first published event appears here automatically.</p></div>}</section> :
            <section className="section-card" aria-labelledby="clubs-heading"><div className="status-heading"><span className="status-icon accent"><StudentPortalIcon name="users" size={20} /></span><div><h2 id="clubs-heading">Clubs</h2><p>Who you could join</p></div><span className="result-count">{clubs.length} clubs</span></div><div className="filter-row"><label className="club-search"><span className="sr-only">Search clubs</span><input value={query} placeholder="Technology, business, outdoors…" onChange={(event) => setQuery(event.target.value)} /></label><div className="filter-chips" role="group" aria-label="Filter clubs by category"><button className={category === "all" ? "selected" : ""} aria-pressed={category === "all"} onClick={() => setCategory("all")}>All</button>{categories.map((value) => <button className={category === value ? "selected" : ""} aria-pressed={category === value} onClick={() => setCategory(value)} key={value}>{value}</button>)}</div></div>{clubs.length ? <div className="card-rows campus-list">{clubs.map((club) => <article className="org-row campus-row" key={club.id}><span className="org-tile"><img src={club.imageUrl} alt="" /></span><span className="campus-row-copy"><span className="campus-row-title"><Link href={`/campus-life/clubs/${club.id}`} onClick={() => track("ui.club_viewed.v1", { club_id: club.id, surface: "club_directory" })}>{club.name}</Link><span className="category-chip">{club.category}</span></span><span className="campus-row-meta">{club.description}</span><span className="campus-row-when">Latest · {club.latestUpdate}</span></span><span className="campus-row-actions"><Link className="secondary-button" href={`/campus-life/clubs/${club.id}`}>Open club <StudentPortalIcon name="chevron" size={14} /></Link><Link className="edward-ask" href={`/edward?club=${encodeURIComponent(club.id)}`}><span className="edward-ask-mark">E</span> Ask Edward</Link></span></article>)}</div> : <div className="state-card empty"><h3>No clubs match this view</h3><p>Clear the filters or try another interest.</p></div>}</section>}
          </div><aside className="page-rail"><div className="anchor-card interests-card"><div className="interests-header"><span className="points-icon large"><StudentPortalIcon name="spark" size={20} /></span><div><span>Your interests</span><strong>Technology · Community · Wellness</strong></div></div><div className="interest-chips"><span>Technology</span><span>Community</span><span>Wellness</span></div><p>These are presentational until the platform exposes student interest preferences. They do not change progress or points.</p><Link className="learn-link" href="/profile">Change them in your profile <StudentPortalIcon name="chevron" size={14} /></Link></div><div className="provenance-card"><span className="panel-label">Where this comes from</span><p><strong>Student Life</strong> publishes every event and club shown here. Cancelled or retired content disappears on the next canonical read.</p><Link className="edward-ask" href="/edward"><span className="edward-ask-mark">E</span> Ask Student Life</Link></div></aside></div>
        </>
      )}
    </PortalShell>
  );
}
