"use client";

import type { StudentAppointment } from "@vv/contracts";
import { useState } from "react";
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import Drawer from "../design-system/primitives/Drawer.jsx";
import { useApiAction } from "../hooks/use-api-resource";
import { ApiClientError, cancelStudentAppointment } from "../lib/api-client";
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
  whoLabel,
  whoShort,
} from "./appointments-logic";

/**
 * One conversation, in full — the reference's `AppointmentDrawer`. The state banner comes first
 * because it is the question the student came with. The record now names the person, the place
 * and the way of meeting, and a confirmed conversation can be moved or cancelled from here; the
 * platform releases the time on the person's calendar in the same step.
 */
export function AppointmentsDrawer({
  appointment,
  type,
  tenant,
  now,
  onClose,
  onBookAgain,
  onReschedule,
  onCancelled,
}: {
  appointment: StudentAppointment;
  type: ConversationType;
  tenant: TenantConfig;
  now: number;
  onClose: () => void;
  onBookAgain: (appointment: StudentAppointment) => void;
  onReschedule: (appointment: StudentAppointment) => void;
  onCancelled: (appointment: StudentAppointment) => void;
}) {
  const state = stateOf(appointment, now);
  const who = whoShort(appointment, type);
  const [confirming, setConfirming] = useState(false);
  const cancel = useApiAction(
    async () => cancelStudentAppointment(appointment.id, { reason: "Cancelled by the student" }),
    (error) => (error instanceof ApiClientError ? error.message : "The cancellation did not go through. Nothing changed."),
  );

  const away =
    appointment.staff?.employmentStatus === "departed"
      ? `${appointment.staff.name} is no longer at ${tenant.shortName}.`
      : appointment.staff?.employmentStatus === "on_leave"
        ? `${appointment.staff.name} is currently on leave.`
        : null;

  const banner = {
    confirmed: {
      tone: "ok",
      icon: "check",
      title: `Confirmed · ${relativeDay(appointment.startsAt, tenant, now)}`,
      body: `This is on your calendar and on ${appointment.staff ? `${appointment.staff.name}’s` : `${articled(type.team)}’s`}. They have what you wrote it is about.`,
    },
    cancelled: {
      tone: "quiet",
      icon: "close",
      title: appointment.status === "rescheduled" ? "Moved to another time" : "Cancelled",
      body:
        appointment.status === "rescheduled"
          ? "You moved this conversation; the new time is on your list."
          : `The time went back to ${who}’s calendar${appointment.cancelReason ? ` (“${appointment.cancelReason}”)` : ""}. Nothing about your enrollment changed because of it.`,
    },
    done: {
      tone: "quiet",
      icon: "clock",
      title:
        appointment.status === "no_show"
          ? `Missed · ${relativeDay(appointment.startsAt, tenant, now)}`
          : `This happened ${relativeDay(appointment.startsAt, tenant, now)}`,
      body:
        appointment.status === "no_show"
          ? `${who} recorded that this did not take place. You can book another time.`
          : "It stays here so you can see who you have already spoken to, and about what.",
    },
  }[state.tone];

  async function confirmCancel() {
    try {
      const cancelled = await cancel.run();
      onCancelled(cancelled);
    } catch {
      // The message shows; the conversation is unchanged.
    }
  }

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
        {type.label} · {who}
      </h2>
      <p className="drawer-description">{type.blurb}</p>

      <div className={`appt-note ${banner.tone}`}>
        <span aria-hidden="true">
          <Icon name={banner.icon} size={17} />
        </span>
        <div>
          <strong>{banner.title}</strong>
          <p>{banner.body}</p>
          {away && state.tone === "confirmed" ? <p>{away}</p> : null}
        </div>
      </div>

      <dl className="campus-facts">
        <div>
          <dt>
            <Icon name="clock" size={15} /> When
          </dt>
          <dd>
            {longDate(appointment.startsAt, tenant, now)}, {clockTime(appointment.startsAt, tenant)}
            {appointment.endsAt ? `–${clockTime(appointment.endsAt, tenant)}` : ""}
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="users" size={15} /> Who
          </dt>
          <dd>
            {whoLabel(appointment, type)}
            {appointment.staff?.component && appointment.staff.component !== type.team ? ` (${appointment.staff.component})` : ""}
          </dd>
        </div>
        {appointment.modality || appointment.location ? (
          <div>
            <dt>
              <Icon name="pin" size={15} /> Where
            </dt>
            <dd>
              {appointment.modality === "virtual" ? "Online" : appointment.modality === "in_person" ? "In person" : ""}
              {appointment.location ? `${appointment.modality ? " · " : ""}${appointment.location}` : ""}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="register-panel">
        <span className="panel-label">What you said it is about</span>
        <p>{appointment.notes ? <em>“{appointment.notes}”</em> : "You did not add a subject when you booked."}</p>
        <small className="prototype-note">
          {who} received this with the booking, so nobody has to be caught up on the day.
        </small>
      </div>

      {appointment.outcomeNote && state.tone === "done" ? (
        <div className="register-panel">
          <span className="panel-label">What {who} noted afterwards</span>
          <p>
            <em>“{appointment.outcomeNote}”</em>
          </p>
        </div>
      ) : null}

      {(state.tone === "cancelled" && appointment.status !== "rescheduled") || appointment.status === "no_show" ? (
        <div className="drawer-actions">
          <Button kind="primary" full icon="arrow" onClick={() => onBookAgain(appointment)}>
            Book this again
          </Button>
        </div>
      ) : null}

      {state.tone === "confirmed" && (
        <div className="drawer-actions">
          <a className="primary-button full" href={calendarHref(appointment, type)} download="appointment.ics">
            Add to calendar <Icon name="calendar" size={17} />
          </a>
          <Button kind="secondary" full icon="refresh" onClick={() => onReschedule(appointment)}>
            Move to another time
          </Button>
          {confirming ? (
            <div className="appt-cancel-confirm" role="group" aria-label="Confirm cancellation">
              <p className="form-help">
                Cancel this conversation? The time goes back to {who}’s calendar straight away.
              </p>
              <Button kind="primary" full icon="close" pending={cancel.status === "loading"} onClick={confirmCancel}>
                Yes, cancel it
              </Button>
              <Button kind="secondary" full onClick={() => setConfirming(false)}>
                Keep it
              </Button>
              {cancel.message ? (
                <p className="field-error" role="alert">
                  {cancel.message}
                </p>
              ) : null}
            </div>
          ) : (
            <Button kind="secondary" full onClick={() => setConfirming(true)}>
              Cancel this conversation
            </Button>
          )}
        </div>
      )}

      <p className="published-note">
        You booked this {shortDate(appointment.createdAt, tenant)}. {tenant.shortName}’s people own these
        conversations; the portal books one with them.
      </p>
    </Drawer>
  );
}
