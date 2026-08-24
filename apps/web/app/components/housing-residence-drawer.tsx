"use client";

import type { StudentHousingResidence } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import Drawer from "../design-system/primitives/Drawer.jsx";
import PlaceTile from "../design-system/primitives/PlaceTile.jsx";
import { SHORTLIST_MAX, initialsOf, ordinal, residenceImage } from "./housing-logic";

/**
 * One residence, in full — the reference `ResidenceDrawer`, with what the
 * backend publishes: the picture with its credit, the description, and what
 * is in the building. Rates are not published, so no rate table is drawn.
 */
export function HousingResidenceDrawer({
  residence,
  office,
  rankIndex,
  canAdd,
  readOnly,
  saving,
  onAdd,
  onRemove,
  onSeeShortlist,
  onClose,
}: {
  residence: StudentHousingResidence;
  office: string;
  rankIndex: number;
  canAdd: boolean;
  readOnly: boolean;
  saving: boolean;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  onSeeShortlist: () => void;
  onClose: () => void;
}) {
  const ranked = rankIndex >= 0;
  const image = residenceImage(residence);

  return (
    <Drawer
      variant="residence"
      label={[office, "Residence hall"]}
      titleId="residence-drawer-title"
      closeLabel="Close residence hall"
      onClose={onClose}
    >
      {image ? (
        <PlaceTile image={image} initials={initialsOf(residence.name)} size="full" />
      ) : (
        <div className="drawer-icon housing">
          <PlaceTile image={null} initials={initialsOf(residence.name)} size="lg" />
        </div>
      )}
      <h2 id="residence-drawer-title">{residence.name}</h2>
      <p className="drawer-description">{residence.description}</p>

      {ranked ? (
        <p className="ranked-banner">
          <Icon name="check" size={16} /> This is your {ordinal(rankIndex)}.
        </p>
      ) : null}

      <h3 className="drawer-subheading">What is in the building</h3>
      <ul className="feature-list">
        {residence.amenities.map((feature) => (
          <li key={feature}>
            <Icon name="check" size={14} /> {feature}
          </li>
        ))}
      </ul>

      {!readOnly ? (
        <div className="drawer-actions">
          {ranked ? (
            <button className="secondary-button full" type="button" disabled={saving} onClick={() => onRemove(residence.value)}>
              <Icon name="close" size={16} /> Remove from my shortlist
            </button>
          ) : canAdd ? (
            <button className="primary-button full" type="button" disabled={saving} onClick={() => onAdd(residence.value)}>
              Add to my shortlist <Icon name="arrow" size={17} />
            </button>
          ) : (
            <p className="action-reason block">
              <Icon name="info" size={15} />
              <span>
                Your shortlist already names {SHORTLIST_MAX} residences.{" "}
                <button type="button" className="text-button inline" onClick={onSeeShortlist}>
                  See your shortlist to swap one.
                </button>
              </span>
            </p>
          )}
          <p className="drawer-foot">
            Adding a residence hall tells {office} what you would like. It does not hold a room.
          </p>
        </div>
      ) : null}
    </Drawer>
  );
}
