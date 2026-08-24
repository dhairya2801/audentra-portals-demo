"use client";

import type { StudentHousingResidence } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import PlaceTile from "../design-system/primitives/PlaceTile.jsx";
import { initialsOf, ordinal, residenceImage } from "./housing-logic";

/**
 * One residence in the catalogue — the reference `ResidenceRow`. The backend
 * publishes a picture, a description and amenities; rates and walks it does not,
 * so the trailing rate cell is not drawn.
 */
export function HousingResidenceRow({
  residence,
  rankIndex,
  canAdd,
  readOnly,
  saving,
  onAdd,
  onOpen,
  onSeeShortlist,
}: {
  residence: StudentHousingResidence;
  rankIndex: number;
  canAdd: boolean;
  readOnly: boolean;
  saving: boolean;
  onAdd: (value: string) => void;
  onOpen: (residence: StudentHousingResidence, node: HTMLElement | null) => void;
  onSeeShortlist: () => void;
}) {
  const ranked = rankIndex >= 0;

  return (
    <div className={`residence-row ${ranked ? "ranked" : ""}`}>
      <button className="residence-main" type="button" onClick={(event) => onOpen(residence, event.currentTarget)}>
        <PlaceTile image={residenceImage(residence)} initials={initialsOf(residence.name)} size="md" />

        <span className="residence-copy">
          <span className="residence-title">
            {residence.name}
            {ranked ? <span className="rank-chip">{ordinal(rankIndex)}</span> : null}
          </span>
          <span className="residence-summary">{residence.description}</span>
          <span className="residence-meta">
            {residence.amenities.map((amenity) => (
              <span key={amenity}>
                <Icon name="check" size={13} /> {amenity}
              </span>
            ))}
          </span>
        </span>
      </button>

      {!readOnly ? (
        <div className="residence-action">
          {ranked ? (
            <span className="ranked-mark">
              <Icon name="check" size={15} /> On your shortlist
            </span>
          ) : canAdd ? (
            <button className="secondary-button" type="button" disabled={saving} onClick={() => onAdd(residence.value)}>
              <Icon name="arrow" size={15} /> Add to shortlist
            </button>
          ) : (
            <button type="button" className="text-button shortlist-full" onClick={onSeeShortlist}>
              <Icon name="info" size={14} /> Your shortlist is full. See your shortlist to swap one.
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
