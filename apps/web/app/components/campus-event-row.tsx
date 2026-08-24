"use client";

import type { CampusEvent } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import { categoryLabel, dateTile, rowRegistration, timeRange } from "./campus-logic";
import { useTenant } from "./tenant-provider";

/**
 * One event in the list — the reference's `EventRow`, read against the feed.
 *
 * The title is the way into the drawer, and the trailing edge carries what the
 * RSVP line used to only describe: the registration control where there is
 * something to do, a label where there is not. The feed publishes no host, so the
 * meta line carries the event's own summary instead.
 */
export function CampusEventRow({
  event,
  past,
  pending,
  onOpen,
  onRegister,
}: {
  event: CampusEvent;
  past: boolean;
  pending: boolean;
  onOpen: (event: CampusEvent, node: HTMLElement) => void;
  onRegister: (event: CampusEvent) => void;
}) {
  const { tenant } = useTenant();
  const tile = dateTile(event.startsAt, tenant);
  const registration = rowRegistration(event, past);

  return (
    <div className={`campus-row ${past ? "past" : ""}`}>
      <span className="date-tile" aria-hidden="true">
        <small>{tile.month}</small>
        <strong>{tile.day}</strong>
      </span>

      <span className="campus-row-copy">
        <span className="campus-row-when">
          {timeRange(event.startsAt, event.endsAt, tenant)}
          <i aria-hidden="true">·</i>
          {event.location || "Location to be announced"}
        </span>
        <span className="campus-row-title">
          <button
            type="button"
            className="row-title-button"
            onClick={(clickEvent) => onOpen(event, clickEvent.currentTarget)}
          >
            {event.title}
          </button>
          <span className="category-chip">{categoryLabel(event.category)}</span>
        </span>
        <span className="campus-row-meta">
          <span>{event.description}</span>
        </span>
      </span>

      <span className="campus-row-actions">
        {registration.control ? (
          <Button
            kind="secondary"
            icon={registration.control.icon}
            pending={pending}
            onClick={() => onRegister(event)}
          >
            {pending ? "Registering…" : registration.control.label}
          </Button>
        ) : (
          <span className="campus-row-action">
            {registration.label === "Registered" ? <Icon name="check" size={13} /> : null}{" "}
            {registration.label}
          </span>
        )}
      </span>
    </div>
  );
}
