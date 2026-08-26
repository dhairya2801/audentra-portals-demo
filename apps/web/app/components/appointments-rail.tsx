"use client";

import Icon from "../design-system/Icon.jsx";
import AnchorCard from "../design-system/primitives/AnchorCard.jsx";

/**
 * The rail — the reference's `AppointmentsRail`: the permanent card says how booking works and
 * ends in the link that opens the longer version. The provenance line names what stands behind
 * the list: the student's live appointment record, not a published calendar.
 */
export function AppointmentsRail({ institution, onOpenHow }: { institution: string; onOpenHow: () => void }) {
  return (
    <AnchorCard variant="booking" label="How this works">
      <p>
        What it’s about decides who gets it — your own adviser or counsellor when you have one. You pick one of their open times, and it is booked straight away. Where
        you are not sure who to ask, Edward can point you to the right team, and their reply arrives here.
      </p>
      <div className="booking-provenance">
        <span>
          <Icon name="calendar" size={13} /> Live student appointments
        </span>
        <span aria-hidden="true">·</span>
        <span>
          <Icon name="shield" size={13} /> {institution} record
        </span>
      </div>
      <button type="button" className="learn-link" onClick={onOpenHow}>
        How this works <Icon name="arrow" size={14} />
      </button>
    </AnchorCard>
  );
}
