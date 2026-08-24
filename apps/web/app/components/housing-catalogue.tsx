"use client";

import type { StudentHousingResidence } from "@vv/contracts";
import { useState } from "react";
import Icon from "../design-system/Icon.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import PlaceTile from "../design-system/primitives/PlaceTile.jsx";
import {
  type Filters,
  NO_FILTERS,
  SHORTLIST_MAX,
  activeFilterCount,
  amenityOptions,
  countWith,
  filterCatalogue,
  initialsOf,
  ordinal,
  residenceImage,
} from "./housing-logic";
import { HousingResidenceRow } from "./housing-residence-row";

const REASON = "No residences match this with your other filters.";

type Open = (residence: StudentHousingResidence, node: HTMLElement | null) => void;

/**
 * The published catalogue — the reference `Catalogue`, with its two views. The
 * backend publishes no rate or walk, so there is nothing to sort by; the compare
 * view lays the attributes the cards do carry side by side, and its one filter
 * is the amenity.
 */
export function HousingCatalogue({
  catalogue,
  unavailable,
  office,
  shortlist,
  readOnly,
  saving,
  onAdd,
  onOpen,
  onSeeShortlist,
  onRetry,
}: {
  catalogue: readonly StudentHousingResidence[];
  unavailable: boolean;
  office: string;
  shortlist: readonly string[];
  readOnly: boolean;
  saving: boolean;
  onAdd: (value: string) => void;
  onOpen: Open;
  onSeeShortlist: () => void;
  onRetry: () => void;
}) {
  const [view, setView] = useState<"list" | "compare">("list");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);

  const head = (
    <div className="status-heading">
      <span className="status-icon accent" aria-hidden="true">
        <Icon name="buildings" size={20} />
      </span>
      <div>
        <h2 id="catalogue-heading">Residences</h2>
        <p>Published by {office}</p>
      </div>
    </div>
  );

  if (unavailable) {
    return (
      <section className="section-card" aria-labelledby="catalogue-heading">
        {head}
        <StateCard
          variant="error"
          icon="alert"
          title="The residence hall catalog couldn’t be loaded"
          action={{ label: "Try again", icon: "refresh", onClick: onRetry }}
        >
          Your housing plan above loaded normally and is unaffected. Only the list of residence halls is
          missing. Nothing you have already answered or ranked has been lost.
        </StateCard>
      </section>
    );
  }

  if (catalogue.length === 0) {
    return (
      <section className="section-card" aria-labelledby="catalogue-heading">
        {head}
        <StateCard icon="home" title="No residence halls published yet">
          {office} publishes the residence halls open to your year here, each with what it offers. They
          appear on this page as soon as they are published. You don’t need to do anything, and your plan
          above is answerable either way.
        </StateCard>
      </section>
    );
  }

  const shown = view === "compare" ? filterCatalogue(catalogue, filters) : [...catalogue];
  const full = shortlist.length >= SHORTLIST_MAX;

  return (
    <section className="section-card" aria-labelledby="catalogue-heading">
      {head}

      <div className="catalogue-tools">
        <div className="sort-group" aria-label="How to read the residence halls">
          <button
            type="button"
            className={view === "list" ? "selected" : ""}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <Icon name="rows" size={15} /> List
          </button>
          <button
            type="button"
            className={view === "compare" ? "selected" : ""}
            aria-pressed={view === "compare"}
            onClick={() => setView("compare")}
          >
            <Icon name="columns" size={15} /> Compare
          </button>
        </div>
        {view === "compare" ? (
          <span className="view-count" aria-live="polite">
            {shown.length} of {catalogue.length} residence halls
          </span>
        ) : null}
      </div>

      {readOnly ? (
        <p className="panel-lede">
          You can read every residence hall here while you decide. Ranking opens once you answer that you
          are living on campus.
        </p>
      ) : null}

      {view === "compare" ? (
        <>
          <CatalogueFilters catalogue={catalogue} filters={filters} onChange={setFilters} />
          <CompareTable
            residences={shown}
            shortlist={shortlist}
            canAdd={!full}
            readOnly={readOnly}
            saving={saving}
            onAdd={onAdd}
            onOpen={onOpen}
            onSeeShortlist={onSeeShortlist}
          />
        </>
      ) : (
        <div className="card-rows residence-list">
          {shown.map((residence) => (
            <HousingResidenceRow
              key={residence.id}
              residence={residence}
              rankIndex={shortlist.indexOf(residence.value)}
              canAdd={!full}
              readOnly={readOnly}
              saving={saving}
              onAdd={onAdd}
              onOpen={onOpen}
              onSeeShortlist={onSeeShortlist}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** The filters — G10. No filter produces an empty list. */
function CatalogueFilters({
  catalogue,
  filters,
  onChange,
}: {
  catalogue: readonly StudentHousingResidence[];
  filters: Filters;
  onChange: (next: Filters) => void;
}) {
  const options = amenityOptions(catalogue);
  const dead = options.filter(
    (value) => filters.amenity !== value && countWith(catalogue, filters, "amenity", value) === 0,
  );

  if (options.length === 0) return null;

  return (
    <div className="catalogue-filters" aria-label="Filter the residence halls">
      <div className="catalogue-filter">
        <span>Amenities</span>
        <div className="sort-group">
          {options.map((value) => {
            const active = filters.amenity === value;
            const count = countWith(catalogue, filters, "amenity", value);
            const disabled = !active && count === 0;
            return (
              <button
                key={value}
                type="button"
                className={active ? "selected" : ""}
                aria-pressed={active}
                disabled={disabled}
                title={disabled ? REASON : undefined}
                onClick={() => onChange({ ...filters, amenity: active ? null : value })}
              >
                {value}
                {!active && !disabled ? <small>{count}</small> : null}
              </button>
            );
          })}
        </div>
      </div>

      {dead.length > 0 || activeFilterCount(filters) > 0 ? (
        <div className="catalogue-filters-foot">
          {dead.length > 0 ? (
            <p className="filter-reason">
              <Icon name="info" size={13} /> No residences match {listOf(dead)} with your other filters.
            </p>
          ) : null}
          {activeFilterCount(filters) > 0 ? (
            <button type="button" className="text-button" onClick={() => onChange(NO_FILTERS)}>
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function listOf(items: string[]) {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

/** The compare view — the same residences as columns of the attributes the cards carry. */
function CompareTable({
  residences,
  shortlist,
  canAdd,
  readOnly,
  saving,
  onAdd,
  onOpen,
  onSeeShortlist,
}: {
  residences: readonly StudentHousingResidence[];
  shortlist: readonly string[];
  canAdd: boolean;
  readOnly: boolean;
  saving: boolean;
  onAdd: (value: string) => void;
  onOpen: Open;
  onSeeShortlist: () => void;
}) {
  return (
    <div className="compare-wrap">
      <table className="compare-table">
        <caption className="sr-only">Residence halls side by side</caption>
        <thead>
          <tr>
            <th scope="col">Residence</th>
            <th scope="col">About</th>
            <th scope="col">What it offers</th>
            {!readOnly ? (
              <th scope="col">
                <span className="sr-only">Shortlist</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {residences.map((residence) => {
            const rankIndex = shortlist.indexOf(residence.value);
            const ranked = rankIndex >= 0;
            return (
              <tr key={residence.id} className={ranked ? "ranked" : ""}>
                <td>
                  <span className="compare-name">
                    <PlaceTile image={residenceImage(residence)} initials={initialsOf(residence.name)} size="sm" />
                    <span>
                      <button type="button" onClick={(event) => onOpen(residence, event.currentTarget)}>
                        {residence.name}
                      </button>
                    </span>
                  </span>
                </td>
                <td>{residence.description}</td>
                <td>
                  <ul className="compare-rooms">
                    {residence.amenities.map((amenity) => (
                      <li key={amenity}>{amenity}</li>
                    ))}
                  </ul>
                </td>
                {!readOnly ? (
                  <td className="compare-action">
                    {ranked ? (
                      <span className="ranked-mark">
                        <Icon name="check" size={14} /> {ordinal(rankIndex)}
                      </span>
                    ) : canAdd ? (
                      <button className="secondary-button" type="button" disabled={saving} onClick={() => onAdd(residence.value)}>
                        <Icon name="arrow" size={14} /> Add
                      </button>
                    ) : (
                      <button type="button" className="text-button" onClick={onSeeShortlist}>
                        See your shortlist
                      </button>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
