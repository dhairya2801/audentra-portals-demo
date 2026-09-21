"use client";

import type { StudentAppointment } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import type { TenantConfig } from "../lib/tenant";
import {
  type ConversationType,
  calendarHref,
  clockTime,
  dateTile,
  stateOf,
  whoLabel,
  whoShort,
} from "./appointments-logic";

/**
 * One conversation, in the list — the reference's `AppointmentRow` on the campus row's grid:
 * date tile, the copy, and the task row's action column (the state badge, then what the student
 * can do about it). The title is the way into the detail sheet.
 */
export function AppointmentsRow({
  appointment,
  type,
  tenant,
  now,
  onOpen,
  onBookAgain,
}: {
  appointment: StudentAppointment;
  type: ConversationType;
  tenant: TenantConfig;
  now: number;
  onOpen: (appointment: StudentAppointment, node: HTMLElement | null) => void;
  onBookAgain: (appointment: StudentAppointment, node: HTMLElement | null) => void;
}) {
  const state = stateOf(appointment, now);
  const past = state.tone !== "confirmed";
  const tile = dateTile(appointment.startsAt, tenant);

  return (
    <article
      className={["appointment-row", state.tone, past && "past"].filter(Boolean).join(" ")}
      data-appointment={appointment.id}
    >
      <div className="appointment-row-body">
        <span className="date-tile" aria-hidden="true">
          <small>{tile.month}</small>
          <strong>{tile.day}</strong>
        </span>

        <div className="campus-row-copy">
          <span className="campus-row-when">
            {clockTime(appointment.startsAt, tenant)}
            <i aria-hidden="true">·</i>
            {whoLabel(appointment)}
          </span>

          <h3 className="campus-row-title">
            <button type="button" className="row-link" onClick={(event) => onOpen(appointment, event.currentTarget)}>
              {type.label} · {whoShort(appointment)}
            </button>
          </h3>

          <span className="campus-row-meta">
            <span className="appointment-subject">
              {appointment.notes ? `About: ${appointment.notes}` : "No subject was added"}
            </span>
          </span>
        </div>

        <div className="task-action">
          <span className={`appt-state ${state.tone}`}>{state.label}</span>

          {state.tone === "confirmed" && (
            <a className="secondary-button" href={calendarHref(appointment, type)} download="appointment.ics">
              <Icon name="calendar" size={16} /> Add to calendar
            </a>
          )}

          {state.tone === "cancelled" && (
            <Button kind="secondary" icon="arrow" onClick={(event: React.MouseEvent<HTMLButtonElement>) => onBookAgain(appointment, event.currentTarget)}>
              Book this again
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
