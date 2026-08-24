"use client";

import type { CampusEvent, StudentClub } from "@vv/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "../design-system/Icon.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import PageSkeleton from "../design-system/patterns/PageSkeleton.jsx";
import PageError from "../design-system/patterns/PageError.jsx";
import ToastStack from "../design-system/patterns/Toast.jsx";
import { useToasts } from "../design-lib/toast.js";
import { openEdward } from "../design-lib/door.js";
import { GROUPS, groupLeaves } from "../design-lib/navigation.js";
import { useActivityTracking } from "../hooks/use-activity-tracking";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import { getCampusLife, registerCampusEvent } from "../lib/api-client";
import { PortalShell } from "./portal-shell";
import { TenantLink as Link } from "./tenant-link";
import { useTenant } from "./tenant-provider";
import { CampusDrawer, type CampusDrawerItem } from "./campus-drawer";
import { CampusEventRow } from "./campus-event-row";
import { CampusOrgRow } from "./campus-org-row";
import { CampusRail } from "./campus-rail";
import {
  categoriesOf,
  categoryLabel,
  contactQuestion,
  groupEvents,
  isPast,
  relativeTime,
  splitByTime,
} from "./campus-logic";

/**
 * My Campus Life — the reference's `CampusPage`, fed by the campus-life feed.
 *
 * One screen, two destinations: `/campus-life` and `/campus-life?view=clubs`
 * share the hero, the rail and the tab row. The Events tab shows one list at a
 * time — *Everything* by week, *Past* by month — and the count names which list
 * it counts. Rows act: the title opens the drawer, the trailing edge registers
 * where there is something to do and says so where there is not.
 *
 * What the reference has and the platform does not: student interests (so no
 * *For you* view, no match chips, no interests card), a required flag (so no
 * required strip), and the local-only *Follow* / *I'm interested* signals — a
 * control that promises a reminder the backend cannot send is left out rather
 * than pretended.
 */

const EVENT_PAGE = 6;
const CLUB_PAGE = 4;

type EventView = "all" | "past";
type OpenRef =
  | { kind: "event"; id: string }
  | { kind: "organisation"; id: string };

type Leaf = { id: string; route: string; icon: string; label: string; tab?: string };

function CampusTabs({ active }: { active: "events" | "clubs" }) {
  const leaves = groupLeaves("campus") as Leaf[];
  return (
    <nav className="group-tabs" aria-label={`${GROUPS.campus} sections`}>
      {leaves.map((leaf) => {
        const current = leaf.id === active;
        return (
          <Link
            key={leaf.id}
            className={current ? "active" : undefined}
            href={leaf.route}
            aria-current={current ? "page" : undefined}
          >
            <Icon name={leaf.icon} size={16} />
            {leaf.tab ?? leaf.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function CampusLifeView({
  tab,
  openClubId = null,
  onClubClosed,
}: {
  tab: "events" | "clubs";
  /** A club opened by its own route — the drawer opens on it and the route stays. */
  openClubId?: string | null;
  onClubClosed?: () => void;
}) {
  const { tenant } = useTenant();
  const office = `${tenant.shortName} Student Life`;
  const campus = useApiResource(useCallback((signal: AbortSignal) => getCampusLife(signal), []));
  const registration = useApiAction(registerCampusEvent);
  const { track } = useActivityTracking();
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  const [today] = useState(() => new Date());
  const [view, setView] = useState<EventView>("all");
  const [eventCategory, setEventCategory] = useState("All");
  const [clubCategory, setClubCategory] = useState("All");
  const [eventLimit, setEventLimit] = useState(EVENT_PAGE);
  const [clubLimit, setClubLimit] = useState(CLUB_PAGE);
  const [open, setOpen] = useState<OpenRef | null>(
    openClubId ? { kind: "organisation", id: openClubId } : null,
  );
  const [registrationEventId, setRegistrationEventId] = useState<string | null>(null);

  const returnFocus = useRef<HTMLElement | null>(null);
  const eventList = useRef<HTMLDivElement | null>(null);
  const clubList = useRef<HTMLDivElement | null>(null);
  const reveal = useRef<{ list: typeof eventList; index: number } | null>(null);
  const trackedDeepLink = useRef<string | null>(null);

  useEffect(() => {
    if (!reveal.current) return;
    const { list, index } = reveal.current;
    reveal.current = null;
    const buttons = list.current?.querySelectorAll<HTMLElement>(".campus-row .row-title-button");
    buttons?.[index]?.focus();
  }, [eventLimit, clubLimit]);

  // A deep link to a club is a club viewed, once, when it is actually found.
  useEffect(() => {
    if (!openClubId || !campus.data || trackedDeepLink.current === openClubId) return;
    if (!campus.data.clubs.some((club) => club.id === openClubId)) return;
    trackedDeepLink.current = openClubId;
    track("ui.club_viewed.v1", { club_id: openClubId, surface: "club_detail" });
  }, [campus.data, openClubId, track]);

  const events = useMemo(() => campus.data?.events ?? [], [campus.data]);
  const clubs = useMemo(() => campus.data?.clubs ?? [], [campus.data]);
  const { upcoming, past } = useMemo(() => splitByTime(events, today), [events, today]);

  const pool = view === "past" ? past : upcoming;
  const eventCategories = categoriesOf(pool);
  const listed =
    eventCategory === "All" ? pool : pool.filter((item) => item.category === eventCategory);
  const shownEvents = listed.slice(0, eventLimit);
  const countLabel = `${listed.length} ${view === "past" ? "past " : ""}${
    listed.length === 1 ? "event" : "events"
  }`;

  const clubCategories = categoriesOf(clubs);
  const filteredClubs =
    clubCategory === "All" ? clubs : clubs.filter((item) => item.category === clubCategory);
  const shownClubs = filteredClubs.slice(0, clubLimit);

  const nothingPublished = campus.data ? events.length === 0 && clubs.length === 0 : false;

  // The band is the shell's. What stays here is the only part that cannot be
  // written in advance: the platform publishes no required flag, so nothing here
  // is required — and the lede says so instead of counting.
  const hero = {
    lede: nothingPublished
      ? `Events, clubs, and the people who run them are published here by ${office}. Nothing is up yet. This page fills itself in as they publish.`
      : `Events, clubs, and the people who run them, published by ${office}. Nothing here is required. It’s all yours to choose.`,
  };

  // The open item is read from the latest feed every render, so a refresh after
  // registering updates the drawer as well as the row.
  const openItem: CampusDrawerItem | null = useMemo(() => {
    if (!open) return null;
    if (open.kind === "event") {
      const item = events.find((event) => event.id === open.id);
      return item ? { kind: "event", item, past: isPast(item, today) } : null;
    }
    const item = clubs.find((club) => club.id === open.id);
    return item ? { kind: "organisation", item } : null;
  }, [open, events, clubs, today]);

  function openEvent(event: CampusEvent, node?: HTMLElement) {
    returnFocus.current = node ?? null;
    track("ui.campus_event_viewed.v1", { event_id: event.id, surface: "event_list" });
    setOpen({ kind: "event", id: event.id });
  }

  function openClub(club: StudentClub, node?: HTMLElement) {
    returnFocus.current = node ?? null;
    track("ui.club_viewed.v1", { club_id: club.id, surface: "club_directory" });
    setOpen({ kind: "organisation", id: club.id });
  }

  function closeItem() {
    const wasDeepLink = open?.kind === "organisation" && open.id === openClubId;
    setOpen(null);
    returnFocus.current?.focus();
    if (wasDeepLink) onClubClosed?.();
  }

  function changeView(next: EventView) {
    setView(next);
    setEventCategory("All");
    setEventLimit(EVENT_PAGE);
  }

  function pickEventCategory(category: string) {
    setEventCategory(category);
    setEventLimit(EVENT_PAGE);
  }

  function pickClubCategory(category: string) {
    setClubCategory(category);
    setClubLimit(CLUB_PAGE);
  }

  // Registration is the portal's own: one idempotent call with the version the
  // student saw. Already registered is a held place, not an error; a stale or
  // inactive event is the API's own message, kept where she can read it.
  async function register(event: CampusEvent) {
    if (event.registrationStatus === "registered") return;
    if (registration.status === "loading") return;
    setRegistrationEventId(event.id);
    try {
      await registration.run(event.id, { expectedVersion: event.version }, crypto.randomUUID());
      pushToast({
        tone: "success",
        title: `You’re registered for ${event.title}.`,
        body: "Your place is held. This doesn’t change your enrollment progress or your points.",
      });
      campus.refresh();
    } catch {
      // Keep the API's canonical conflict or stale-event message visible.
    }
  }

  // The contact control is the Edward door: the question written and unsent,
  // the club named, so his answer is about the right person and the right office.
  function contact(org: StudentClub) {
    openEdward({
      question: contactQuestion(org),
      context: {
        label: `My Campus Life · ${org.name}`,
        intent: "club",
        clubId: org.id,
        office: "student-life",
      },
    });
  }

  function rows(items: CampusEvent[]) {
    return items.map((item) => (
      <CampusEventRow
        key={item.id}
        event={item}
        past={view === "past"}
        pending={registration.status === "loading" && registrationEventId === item.id}
        onOpen={openEvent}
        onRegister={(event) => void register(event)}
      />
    ));
  }

  const updated = campus.data ? relativeTime(campus.data.generatedAt, today) : null;
  const registrationState = {
    pending:
      registration.status === "loading" &&
      openItem?.kind === "event" &&
      registrationEventId === openItem.item.id,
    error:
      registration.status === "error" &&
      openItem?.kind === "event" &&
      registrationEventId === openItem.item.id
        ? registration.message
        : null,
  };

  return (
    <PortalShell
      active={tab === "clubs" ? "clubs" : "campus_life"}
      hero={hero}
      tabs={<CampusTabs active={tab} />}
      rail={<CampusRail office={office} updated={updated} />}
    >
      {campus.status === "loading" ? (
        <PageSkeleton label="My Campus Life" />
      ) : campus.status === "error" ? (
        <PageError label="My Campus Life" onRetry={campus.reload} />
      ) : tab === "events" ? (
        <section className="section-card" aria-labelledby="events-heading">
          <div className="status-heading">
            <span className="status-icon accent" aria-hidden="true">
              <Icon name="ticket" size={20} />
            </span>
            <div>
              <h2 id="events-heading">Events</h2>
              <p>What’s happening</p>
            </div>
            {events.length > 0 && (
              <div className="sort-group" aria-label="Choose which events to see">
                <button
                  className={view === "all" ? "selected" : ""}
                  aria-pressed={view === "all"}
                  onClick={() => changeView("all")}
                >
                  Everything
                </button>
                <button
                  className={view === "past" ? "selected" : ""}
                  aria-pressed={view === "past"}
                  onClick={() => changeView("past")}
                >
                  Past
                </button>
              </div>
            )}
          </div>

          {events.length === 0 ? (
            <StateCard icon="calendar" title="No events published yet">
              {office} publishes talks, socials, volunteering shifts and orientation sessions
              here. The first one they publish appears on this page straight away. You don’t need
              to do anything.
            </StateCard>
          ) : (
            <>
              <div className="filter-row">
                <div className="filter-chips" role="group" aria-label="Filter events by category">
                  <button
                    className={eventCategory === "All" ? "selected" : ""}
                    aria-pressed={eventCategory === "All"}
                    onClick={() => pickEventCategory("All")}
                  >
                    All
                  </button>
                  {eventCategories.map((category) => (
                    <button
                      key={category}
                      className={eventCategory === category ? "selected" : ""}
                      aria-pressed={eventCategory === category}
                      onClick={() => pickEventCategory(category)}
                    >
                      {categoryLabel(category)}
                    </button>
                  ))}
                </div>
                <span className="result-count" aria-live="polite">
                  {countLabel}
                </span>
              </div>

              {listed.length === 0 ? (
                <StateCard
                  icon="calendar"
                  title={
                    view === "past"
                      ? "No past events yet"
                      : `No ${categoryLabel(eventCategory)} events in this view`
                  }
                  action={
                    eventCategory !== "All"
                      ? { label: "Clear filter", onClick: () => pickEventCategory("All") }
                      : undefined
                  }
                >
                  {view === "past"
                    ? "Events move here once their date has passed. Nothing is deleted."
                    : `${office} publishes new events through the year, so this is worth checking again.`}
                </StateCard>
              ) : (
                <div className="card-rows campus-list" ref={eventList}>
                  {groupEvents(shownEvents, today, tenant).map((group) => (
                    <div className="date-group" key={group.label}>
                      <p className="subgroup-heading">{group.label}</p>
                      {rows(group.items)}
                    </div>
                  ))}

                  {listed.length > shownEvents.length && (
                    <button
                      className="show-more"
                      onClick={() => {
                        reveal.current = { list: eventList, index: shownEvents.length };
                        setEventLimit((limit) => limit + EVENT_PAGE);
                      }}
                    >
                      Show more <span>{listed.length - shownEvents.length} left</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      ) : (
        <section className="section-card" aria-labelledby="clubs-heading">
          <div className="status-heading">
            <span className="status-icon accent" aria-hidden="true">
              <Icon name="users" size={20} />
            </span>
            <div>
              <h2 id="clubs-heading">Clubs</h2>
              <p>Who you could join</p>
            </div>
            {clubs.length > 0 && (
              <span className="result-count" aria-live="polite">
                {filteredClubs.length} {filteredClubs.length === 1 ? "club" : "clubs"}
              </span>
            )}
          </div>

          {clubs.length === 0 && (
            <StateCard icon="users" title="No clubs published yet">
              Clubs, societies and volunteering groups appear here once {office} publishes them,
              each with the person to contact and what they have been up to lately.
            </StateCard>
          )}

          {clubs.length > 0 && (
            <>
              <div className="filter-row">
                <div className="filter-chips" role="group" aria-label="Filter clubs by category">
                  <button
                    className={clubCategory === "All" ? "selected" : ""}
                    aria-pressed={clubCategory === "All"}
                    onClick={() => pickClubCategory("All")}
                  >
                    All
                  </button>
                  {clubCategories.map((category) => (
                    <button
                      key={category}
                      className={clubCategory === category ? "selected" : ""}
                      aria-pressed={clubCategory === category}
                      onClick={() => pickClubCategory(category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {filteredClubs.length === 0 ? (
                <StateCard
                  icon="users"
                  title={`No ${clubCategory} clubs in this view`}
                  action={{ label: "Clear filter", onClick: () => pickClubCategory("All") }}
                >
                  {office} adds organizations through the year.
                </StateCard>
              ) : (
                <div className="card-rows campus-list" ref={clubList}>
                  {shownClubs.map((item) => (
                    <CampusOrgRow
                      key={item.id}
                      org={item}
                      onOpen={openClub}
                      onContact={contact}
                    />
                  ))}
                  {filteredClubs.length > shownClubs.length && (
                    <button
                      className="show-more"
                      onClick={() => {
                        reveal.current = { list: clubList, index: shownClubs.length };
                        setClubLimit((limit) => limit + CLUB_PAGE);
                      }}
                    >
                      Show more <span>{filteredClubs.length - shownClubs.length} left</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {openClubId && campus.data && !clubs.some((club) => club.id === openClubId) && (
            <StateCard
              icon="users"
              title="We couldn’t find that club"
              action={{ label: "Back to clubs", onClick: () => onClubClosed?.() }}
            >
              It may have been unpublished or moved by {office}. The current list is above.
            </StateCard>
          )}
        </section>
      )}

      {openItem && (
        <CampusDrawer
          open={openItem}
          today={today}
          publisher={office}
          registration={registrationState}
          onRegister={(event) => void register(event)}
          onRefresh={() => campus.refresh()}
          onContact={(org) => {
            closeItem();
            contact(org);
          }}
          onClose={closeItem}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </PortalShell>
  );
}
