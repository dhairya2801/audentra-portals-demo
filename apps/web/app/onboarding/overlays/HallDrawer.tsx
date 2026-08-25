"use client";
import type { StudentHousingResidence } from "@vv/contracts";
import Drawer from "../../design-system/primitives/Drawer.jsx";
import Button from "../../design-system/primitives/Button.jsx";
import Icon from "../../design-system/Icon.jsx";
import { RANK_NAMES } from "../flow";

/**
 * A residence hall, opened to be read. A drawer, not a modal: there is no
 * decision in here that is lost on close. The action changes state once
 * ranked, so reopening it says what she already decided.
 */
export function HallDrawer({
  hall,
  rank,
  canAdd,
  onRank,
  onDrop,
  onClose,
}: {
  hall: StudentHousingResidence;
  rank: number;
  canAdd: boolean;
  onRank: (value: string) => void;
  onDrop: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Drawer
      label={["Residence hall", hall.name]}
      titleId="hall-title"
      closeLabel={`Close ${hall.name}`}
      onClose={onClose}
    >
      <figure className="hall-figure">
        <img src={hall.imageUrl} alt={hall.imageAlt} />
        {hall.attribution ? (
          <figcaption>
            {hall.sourceUrl ? (
              <a href={hall.sourceUrl} target="_blank" rel="noreferrer">
                {hall.attribution}
              </a>
            ) : (
              hall.attribution
            )}
          </figcaption>
        ) : null}
      </figure>

      <h2 id="hall-title">{hall.name}</h2>
      <p className="drawer-description">{hall.description}</p>

      {hall.amenities.length ? (
        <>
          <h3 className="drawer-subhead">In the building</h3>
          <ul className="hall-includes">
            {hall.amenities.map((item) => (
              <li key={item}>
                <Icon name="circle" size={14} /> {item}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="drawer-actions">
        {rank ? (
          <>
            <Button kind="secondary" full leadingIcon="check" onClick={() => onDrop(hall.value)}>
              Your {RANK_NAMES[rank - 1]}. Remove it
            </Button>
            <p className="drawer-foot">
              Residential Life reads your order as a preference. It does not hold a room.
            </p>
          </>
        ) : (
          <>
            <Button kind="primary" full icon="plus" disabled={!canAdd} onClick={() => onRank(hall.value)}>
              {canAdd ? "Rank this hall" : "Three halls already ranked"}
            </Button>
            <p className="drawer-foot">
              {canAdd
                ? "Adding it tells Residential Life what you would like. It does not hold a room."
                : "Remove one from your list to rank this instead."}
            </p>
          </>
        )}
      </div>
    </Drawer>
  );
}
