"use client";

import type { StudentAppointment } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import Drawer from "../design-system/primitives/Drawer.jsx";
import type { TenantConfig } from "../lib/tenant";
import {
  type ConversationType,
  articled,
  calendarHref,
  clockTime,
  longDate,
  relativeDay,
  shortDate,
  stateOf,
} from "./appointments-logic";

/**
 * One conversation, in full — the reference's `AppointmentDrawer`. The state banner comes first
 * because it is the question the student came with. The backend records no place and no person,
 * and exposes no cancel or reschedule, so those zones and actions are not drawn.
 */
export function AppointmentsDrawer({
  appointment,
  type,
  tenant,
  now,
  onClose,
  onBookAgain,
}: {
  appointment: StudentAppointment;
  type: ConversationType;
  tenant: TenantConfig;
  now: number;
  onClose: () => void;
  onBookAgain: (appointment: StudentAppointment) => void;
}) {
  const state = stateOf(appointment, now);

  const banner = {
    confirmed: {
      tone: "ok",
      icon: "check",
      title: `Confirmed · ${relativeDay(appointment.startsAt, tenant, now)}`,
      body: `This is on your calendar and on ${articled(type.team)}’s. They have what you wrote it is about.`,
    },
    cancelled: {
      tone: "quiet",
      icon: "close",
      title: "Cancelled",
      body: `The time went back to ${articled(type.team)}’s calendar. Nothing about your enrollment changed because of it.`,
    },
    done: {
      tone: "quiet",
      icon: "clock",
      title: `This happened ${relativeDay(appointment.startsAt, tenant, now)}`,
      body: "It stays here so you can see who you have already spoken to, and about what.",
    },
  }[state.tone];

  return (
    <Drawer
      variant="appointment"
      label={[type.category, longDate(appointment.startsAt, tenant, now)]}
      titleId="appointment-drawer-title"
      closeLabel="Close"
      onClose={onClose}
    >
      <div className={`drawer-icon appointment ${state.tone}`} aria-hidden="true">
        <Icon weight="duotone" name="calendar" size={25} />
      </div>
      <h2 id="appointment-drawer-title">
        {type.label} · {type.team}
      </h2>
      <p className="drawer-description">{type.blurb}</p>

      <div className={`appt-note ${banner.tone}`}>
        <span aria-hidden="true">
          <Icon name={banner.icon} size={17} />
        </span>
        <div>
          <strong>{banner.title}</strong>
          <p>{banner.body}</p>
        </div>
      </div>

      <dl className="campus-facts">
        <div>
          <dt>
            <Icon name="clock" size={15} /> When
          </dt>
          <dd>
            {longDate(appointment.startsAt, tenant, now)}, {clockTime(appointment.startsAt, tenant)}
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="users" size={15} /> Who
          </dt>
          <dd>{type.team}</dd>
        </div>
      </dl>

      <div className="register-panel">
        <span className="panel-label">What you said it is about</span>
        <p>{appointment.notes ? <em>“{appointment.notes}”</em> : "You did not add a subject when you booked."}</p>
        <small className="prototype-note">
          {articled(type.team, true)} received this with the booking, so nobody has to be caught up on the day.
        </small>
      </div>

      {state.tone === "cancelled" && (
        <div className="drawer-actions">
          <Button kind="primary" full icon="arrow" onClick={() => onBookAgain(appointment)}>
            Book this again
          </Button>
        </div>
      )}

      {state.tone === "confirmed" && (
        <div className="drawer-actions">
          <a className="primary-button full" href={calendarHref(appointment, type)} download="appointment.ics">
            Add to calendar <Icon name="calendar" size={17} />
          </a>
        </div>
      )}

      <p className="published-note">
        You booked this {shortDate(appointment.createdAt, tenant)}. {tenant.shortName}’s teams own these
        conversations; the portal books one with them.
      </p>
    </Drawer>
  );
}
