"use client";

import type { CampusEvent, StudentClub } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import Drawer from "../design-system/primitives/Drawer.jsx";
import EdwardAsk from "../design-system/patterns/EdwardAsk.jsx";
import {
  categoryLabel,
  firstName,
  longDate,
  registrationHeading,
  rowRegistration,
  shortDate,
  timeRange,
} from "./campus-logic";
import { useTenant } from "./tenant-provider";

export type CampusDrawerItem =
  | { kind: "event"; item: CampusEvent; past: boolean }
  | { kind: "organisation"; item: StudentClub; past?: false };

/**
 * The depth behind a row — the reference's `CampusDrawer`, read against the
 * feed. For an event the register panel holds the portal's own registration:
 * one call, one place held, the same idempotent call the row makes. For a club
 * the way to the person is the Edward door.
 */
export function CampusDrawer({
  open,
  today,
  publisher,
  registration,
  onRegister,
  onRefresh,
  onContact,
  onClose,
}: {
  open: CampusDrawerItem;
  today: Date;
  publisher: string;
  registration: { pending: boolean; error: string | null };
  onRegister: (event: CampusEvent) => void;
  onRefresh: () => void;
  onContact: (org: StudentClub) => void;
  onClose: () => void;
}) {
  const { tenant } = useTenant();
  const isEvent = open.kind === "event";
  const label = isEvent
    ? [categoryLabel(open.item.category), longDate(open.item.startsAt, today, tenant)]
    : [open.item.category, open.item.meetingSchedule ?? "Meets as published by the club"];

  return (
    <Drawer
      variant="campus"
      label={label}
      titleId="campus-drawer-title"
      closeLabel={isEvent ? "Close event" : "Close organization"}
      onClose={onClose}
    >
      <div className="drawer-icon campus">
        <Icon weight="duotone" name={isEvent ? "calendar" : "users"} size={25} />
      </div>
      <h2 id="campus-drawer-title">{isEvent ? open.item.title : open.item.name}</h2>
      <p className="drawer-description">{open.item.description}</p>

      {open.kind === "event" && open.past && (
        <div className="past-note">
          <Icon name="clock" size={16} /> This event has passed. It stays here so you can see
          what the year looks like.
        </div>
      )}

      {open.kind === "event" ? (
        <EventBody
          event={open.item}
          past={open.past}
          today={today}
          publisher={publisher}
          registration={registration}
          onRegister={onRegister}
          onRefresh={onRefresh}
        />
      ) : (
        <OrgBody org={open.item} onContact={onContact} />
      )}

      <p className="published-note">
        Published by {publisher} staff. Nothing on this page changes your enrollment progress or
        your points.
      </p>
    </Drawer>
  );
}

function EventBody({
  event,
  past,
  today,
  publisher,
  registration,
  onRegister,
  onRefresh,
}: {
  event: CampusEvent;
  past: boolean;
  today: Date;
  publisher: string;
  registration: { pending: boolean; error: string | null };
  onRegister: (event: CampusEvent) => void;
  onRefresh: () => void;
}) {
  const { tenant } = useTenant();
  const row = rowRegistration(event, past);
  const registered = event.registrationStatus === "registered";

  return (
    <>
      <dl className="campus-facts">
        <div>
          <dt>
            <Icon name="calendar" size={15} /> When
          </dt>
          <dd>
            {longDate(event.startsAt, today, tenant)}, {timeRange(event.startsAt, event.endsAt, tenant)}
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="pin" size={15} /> Where
          </dt>
          <dd>{event.location || "Location to be announced"}</dd>
        </div>
      </dl>

      <div className="register-panel">
        <span className="panel-label">{past ? "How it worked" : registrationHeading(event)}</span>
        <p>
          {past
            ? "Registration closed when the event ended."
            : registered
              ? `Your place at ${event.title} is held. There is nothing more to do.`
              : event.registrationStatus === "cancelled_by_event"
                ? `${publisher} cancelled this event. Nothing you did caused it.`
                : `Register here and ${publisher} holds your place. One tap, and the event appears as registered on your list.`}
        </p>
        {row.control && (
          <Button
            kind="primary"
            full
            icon={row.control.icon}
            pending={registration.pending}
            onClick={() => onRegister(event)}
          >
            {registration.pending ? "Registering…" : row.control.label}
          </Button>
        )}
        {registration.error && (
          <p className="register-feedback" role="alert">
            <Icon name="alert" size={14} /> {registration.error}{" "}
            <button type="button" className="text-button" onClick={onRefresh}>
              Refresh current events
            </button>
          </p>
        )}
        <small className="prototype-note">
          {publisher} handles the event. Registering never changes your enrollment progress or
          your points.
        </small>
      </div>
    </>
  );
}

function OrgBody({
  org,
  onContact,
}: {
  org: StudentClub;
  onContact: (org: StudentClub) => void;
}) {
  const { tenant } = useTenant();
  const first = firstName(org.contactName);
  const events = [...(org.events ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const about =
    org.longDescription && org.longDescription !== org.description ? org.longDescription : null;

  return (
    <>
      <dl className="campus-facts">
        <div>
          <dt>
            <Icon name="clock" size={15} /> Meets
          </dt>
          <dd>{org.meetingSchedule ?? "Meeting times are published by the club."}</dd>
        </div>
        <div>
          <dt>
            <Icon name="profile" size={15} /> Contact
          </dt>
          <dd>
            {org.contactName}, {org.contactRole}
          </dd>
        </div>
        {org.nextActivity && (
          <div>
            <dt>
              <Icon name="calendar" size={15} /> Next up
            </dt>
            <dd>{org.nextActivity}</dd>
          </div>
        )}
        <div>
          <dt>
            <Icon name="spark" size={15} /> Latest update
          </dt>
          <dd>{org.latestUpdate || "No updates published yet."}</dd>
        </div>
      </dl>

      <div className="register-panel">
        <span className="panel-label">How to get in touch</span>
        <p>
          {org.contactName} runs {org.name} and is the person to ask about joining, coming along
          once, or what a first session is like. Ask Edward and he’ll get you to them.
        </p>
        <div className="drawer-actions">
          <EdwardAsk label={`Message ${first}`} mark="E" onClick={() => onContact(org)} />
        </div>
        <small className="prototype-note">
          Membership is handled by the organization, not by this portal.
        </small>
      </div>

      {events.length > 0 && (
        <div className="about-panel">
          <h3>Coming up with {org.name}</h3>
          <dl className="campus-facts">
            {events.map((event) => (
              <div key={event.id}>
                <dt>
                  <Icon name="calendar" size={15} /> {shortDate(event.startsAt, tenant)}
                </dt>
                <dd>
                  {event.title}
                  <span className="campus-fact-meta">
                    {timeRange(event.startsAt, event.endsAt, tenant)} · {event.location}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {about && (
        <div className="about-panel">
          <h3>About {org.name}</h3>
          <p>{about}</p>
        </div>
      )}
    </>
  );
}
