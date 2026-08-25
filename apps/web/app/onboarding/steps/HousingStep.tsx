"use client";
import type { HousingPreference, StudentHousingResidence } from "@vv/contracts";
import Card, { CardHead } from "../../design-system/primitives/Card.jsx";
import ChoiceList from "../../design-system/patterns/ChoiceList.jsx";
import FieldGroup from "../../design-system/patterns/FieldGroup.jsx";
import Button from "../../design-system/primitives/Button.jsx";
import Icon from "../../design-system/Icon.jsx";
import { RANK_NAMES } from "../flow";

export const PLAN_OPTIONS: Array<[HousingPreference, string, string]> = [
  [
    "on_campus",
    "Living on campus",
    "Rank the residence halls you would like. Residential Life assigns your room.",
  ],
  ["off_campus", "Off campus", "You will rent near campus yourself. Nothing further is needed."],
  ["commuting", "Commuting", "You will live at home and travel in. No residence hall to rank."],
  ["family", "Living with family", "You will live with family near campus. Nothing further is needed."],
  [
    "undecided",
    "I need help deciding",
    "Residential Life will help you decide. Your plan stays open.",
  ],
];

export function planLabel(value: HousingPreference | undefined | null) {
  return PLAN_OPTIONS.find(([id]) => id === value)?.[1] ?? null;
}

function HallRow({
  hall,
  rank,
  canAdd,
  onOpen,
  onAdd,
  onMove,
  onDrop,
}: {
  hall: StudentHousingResidence;
  rank: number;
  canAdd?: boolean;
  onOpen: (hall: StudentHousingResidence) => void;
  onAdd?: (value: string) => void;
  onMove?: (value: string, by: number) => void;
  onDrop?: (value: string) => void;
}) {
  return (
    <div className={rank ? "hall-row ranked" : "hall-row"}>
      <img className="hall-image" src={hall.imageUrl} alt={hall.imageAlt} loading="lazy" />

      <div className="hall-body">
        <div className="hall-title">
          <strong>{hall.name}</strong>
          {rank ? <span className="hall-rank">{RANK_NAMES[rank - 1]}</span> : null}
        </div>
        <p className="hall-summary">{hall.description}</p>
        {hall.amenities.length ? (
          <p className="hall-facts">
            {hall.amenities.slice(0, 4).map((amenity) => (
              <span key={amenity}>
                <Icon name="circle" size={13} /> {amenity}
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="hall-actions">
        <Button kind="text" onClick={() => onOpen(hall)}>
          Look inside
        </Button>

        {rank ? (
          <div className="rank-controls">
            <button
              type="button"
              className="rank-move"
              aria-label={`Move ${hall.name} up`}
              disabled={rank === 1}
              onClick={() => onMove?.(hall.value, -1)}
            >
              <Icon name="rise" size={14} />
            </button>
            <button
              type="button"
              className="rank-move"
              aria-label={`Move ${hall.name} down`}
              onClick={() => onMove?.(hall.value, 1)}
            >
              <Icon name="fall" size={14} />
            </button>
            <Button kind="text" onClick={() => onDrop?.(hall.value)}>
              Remove
            </Button>
          </div>
        ) : (
          <Button kind="secondary" disabled={!canAdd} onClick={() => onAdd?.(hall.value)}>
            {canAdd ? "Rank this hall" : "Three already ranked"}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Step 4. Only living on campus opens anything. The hall list is the
 * platform's own inventory, ranked in the order the array holds, at most
 * three; the positions have names, so they are named.
 */
export function HousingStep({
  plan,
  shortlist,
  residences,
  onChange,
  onOpenHall,
  onRank,
  onMove,
  onDrop,
}: {
  plan: HousingPreference | undefined;
  shortlist: string[];
  residences: StudentHousingResidence[];
  onChange: (plan: HousingPreference) => void;
  onOpenHall: (hall: StudentHousingResidence) => void;
  onRank: (value: string) => void;
  onMove: (value: string, by: number) => void;
  onDrop: (value: string) => void;
}) {
  const onCampus = plan === "on_campus";
  const byValue = new Map(residences.map((hall) => [hall.value, hall]));

  return (
    <>
      <FieldGroup>
        <ChoiceList name="plan" options={PLAN_OPTIONS} value={plan ?? null} onChange={onChange} />
      </FieldGroup>

      {onCampus ? (
        <Card className="asking">
          <CardHead
            kind="status"
            icon="buildings"
            tone="ask"
            title="Residence halls"
            note="Rank up to three. Adding one tells Residential Life what you would like, it does not hold a room."
          />
          <div className="card-body">
            {residences.length === 0 ? (
              <p className="field-foot">
                <Icon name="info" size={14} /> No residence halls are published yet. Your plan is
                still recorded, and the list appears in Housing once it is.
              </p>
            ) : null}
            <div className="hall-list">
              {shortlist.map((value, index) => {
                const hall = byValue.get(value);
                return hall ? (
                  <HallRow
                    key={value}
                    hall={hall}
                    rank={index + 1}
                    onOpen={onOpenHall}
                    onMove={onMove}
                    onDrop={onDrop}
                  />
                ) : null;
              })}
              {residences
                .filter((hall) => !shortlist.includes(hall.value))
                .map((hall) => (
                  <HallRow
                    key={hall.value}
                    hall={hall}
                    rank={0}
                    canAdd={shortlist.length < 3}
                    onOpen={onOpenHall}
                    onAdd={onRank}
                  />
                ))}
            </div>
          </div>
        </Card>
      ) : null}
    </>
  );
}
