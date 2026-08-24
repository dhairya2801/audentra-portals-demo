"use client";

import type { StudentClub } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import EdwardAsk from "../design-system/patterns/EdwardAsk.jsx";
import { firstName, initialsOf } from "./campus-logic";

/**
 * One club in the list — the reference's `OrgRow`, read against the feed.
 *
 * The leading slot is the club's emblem: initials in the tinted tile, because
 * the feed publishes no glyph and the reference never puts a photograph of
 * people there. The contact control names the person and is the Edward door —
 * no direct line before him.
 */
export function CampusOrgRow({
  org,
  onOpen,
  onContact,
}: {
  org: StudentClub;
  onOpen: (org: StudentClub, node: HTMLElement) => void;
  onContact: (org: StudentClub) => void;
}) {
  return (
    <div className="campus-row org-row">
      <span className="org-tile" aria-hidden="true">
        {initialsOf(org.name)}
      </span>

      <span className="campus-row-copy">
        <span className="campus-row-title">
          <button
            type="button"
            className="row-title-button"
            onClick={(clickEvent) => onOpen(org, clickEvent.currentTarget)}
          >
            {org.name}
          </button>
          <span className="category-chip">{org.category}</span>
        </span>
        <span className="org-description">{org.description}</span>
        <span className="campus-row-meta">
          {org.meetingSchedule ? (
            <span>
              <Icon name="clock" size={13} /> {org.meetingSchedule}
            </span>
          ) : null}
          <span>
            <Icon name="profile" size={13} /> {org.contactName}, {org.contactRole}
          </span>
        </span>
        <span className={`org-update ${org.latestUpdate ? "" : "quiet"}`}>
          {org.latestUpdate ? org.latestUpdate : "No updates published yet"}
        </span>

        <span className="campus-row-actions">
          <EdwardAsk
            label={`Message ${firstName(org.contactName)}`}
            mark="E"
            onClick={() => onContact(org)}
          />
        </span>
      </span>
    </div>
  );
}
