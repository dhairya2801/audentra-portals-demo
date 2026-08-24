"use client";

import type { StudentHousingResidence } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import ActionBand from "../design-system/patterns/ActionBand.jsx";
import { IconButton } from "../design-system/primitives/Button.jsx";
import PlaceTile from "../design-system/primitives/PlaceTile.jsx";
import {
  type Band,
  type Deadline,
  SHORTLIST_MAX,
  initialsOf,
  ordinal,
  residenceById,
  residenceImage,
  shortlistState,
} from "./housing-logic";

/**
 * The second question — the reference `ShortlistPanel`. Reordering is explicit
 * and every change saves on its own, to the plan's `residencePreferences`.
 */
export function HousingShortlistPanel({
  shortlist,
  catalogue,
  office,
  deadline,
  saving,
  band,
  onBand,
  onMove,
  onRemove,
  onOpen,
}: {
  shortlist: readonly string[];
  catalogue: readonly StudentHousingResidence[];
  office: string;
  deadline: Deadline;
  saving: boolean;
  band: Band;
  onBand: () => void;
  onMove: (index: number, direction: 1 | -1) => void;
  onRemove: (value: string) => void;
  onOpen: (residence: StudentHousingResidence, node: HTMLElement | null) => void;
}) {
  const state = shortlistState(shortlist);
  const rows = shortlist
    .map((value) => residenceById(catalogue, value))
    .filter((item): item is StudentHousingResidence => Boolean(item));

  return (
    <section className="section-card shortlist-card" aria-labelledby="shortlist-heading">
      <div className="status-heading">
        <span className="status-icon accent" aria-hidden="true">
          <Icon name="buildings" size={20} />
        </span>
        <div>
          <h2 id="shortlist-heading">Rank the residence halls you would like</h2>
          <p>Second question</p>
        </div>
        <span className="result-count" aria-live="polite">
          {rows.length} of {SHORTLIST_MAX} ranked
        </span>
      </div>

      {band ? (
        <ActionBand icon={band.icon} label={band.label} action={{ ...band.action, onClick: onBand }} />
      ) : null}

      <div className="influence-note">
        <span>
          <Icon name="info" size={17} />
        </span>
        <div>
          <strong>A preference is not an assignment.</strong>
          <p>
            {office} assigns every room{deadline ? ` after ${deadline.full}` : ""}, and they may
            assign one you did not name. What your order is worth: they work down your list in the
            order you set it, so first is read as first.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="shortlist-empty">
          Nothing ranked yet. Add up to {SHORTLIST_MAX} from the catalog below, in the order you would
          like them.
        </p>
      ) : (
        <ol className="shortlist">
          {rows.map((residence, index) => (
            <li key={residence.id} className="shortlist-row">
              <span className="rank-label">{ordinal(index)}</span>

              <button
                className="shortlist-main"
                type="button"
                onClick={(event) => onOpen(residence, event.currentTarget)}
              >
                <PlaceTile image={residenceImage(residence)} initials={initialsOf(residence.name)} size="sm" />
                <span className="shortlist-copy">
                  <strong>{residence.name}</strong>
                  <small>{residence.description}</small>
                </span>
              </button>

              <span className="rank-controls">
                <IconButton
                  className="up"
                  name="chevron"
                  size={16}
                  label={`Move ${residence.name} up`}
                  tip="Move up"
                  disabled={saving || index === 0}
                  onClick={() => onMove(index, -1)}
                />
                <IconButton
                  name="chevron"
                  size={16}
                  label={`Move ${residence.name} down`}
                  tip="Move down"
                  disabled={saving || index === rows.length - 1}
                  onClick={() => onMove(index, 1)}
                />
                <IconButton
                  name="close"
                  size={16}
                  label={`Remove ${residence.name} from your shortlist`}
                  tip="Remove"
                  disabled={saving}
                  onClick={() => onRemove(residence.value)}
                />
              </span>
            </li>
          ))}
        </ol>
      )}

      {state === "partial" ? (
        <p className="shortlist-foot partial">
          <Icon name="clock" size={15} />
          Saved, and incomplete. {SHORTLIST_MAX - rows.length} more to name
          {deadline ? ` before ${deadline.label}` : ""}. Until then housing stays open on your checklist.
        </p>
      ) : null}

      {state === "complete" ? (
        <p className="shortlist-foot">
          <Icon name="check" size={15} />
          Saved. Change the order any time{deadline ? ` before ${deadline.label}` : ""}. Every change
          saves on its own.
        </p>
      ) : null}
    </section>
  );
}
