"use client";

import { useEffect, useState } from "react";
import { formatBrewNumber } from "./data";
import type { BrewKpi, BrewKpiComparison } from "./types";

/** How long one comparison holds the card before the cluster advances. */
const ROTATE_MS = 3400;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const arrowFor = (direction: BrewKpiComparison["direction"]) =>
  direction === "up" ? "▲" : direction === "down" ? "▼" : "■";

/**
 * One comparison, in the two sizes the card uses.
 *
 * The tone follows `favorable`, not `direction`: a falling verification queue
 * is good news and a rising one is not, and a card that painted every downward
 * arrow red would tell the reader the opposite of what happened.
 */
function Movement({
  comparison,
  primary,
}: {
  comparison: BrewKpiComparison;
  primary?: boolean;
}) {
  return (
    <span className={primary ? "brew-move brew-move--primary" : "brew-move"}>
      <b className={comparison.favorable ? "is-good" : "is-watch"}>
        <i aria-hidden="true">{arrowFor(comparison.direction)}</i>{" "}
        {primary ? comparison.delta : (comparison.percent ?? comparison.delta)}
      </b>
      <small>{comparison.label}</small>
    </span>
  );
}

/**
 * A KPI card: one figure, and the distances it can be read from.
 *
 * The headline number never moves. What rotates is the comparison cluster
 * beneath it — each window takes a turn as the large reading beside the figure
 * while the next two sit below it, so the card always shows three distinct
 * distances and never the same one twice. Pointing at the card stops the
 * rotation, because a number that changes while you are reading it is a number
 * you cannot read.
 */
function PulseCard({ kpi, onOpen }: { kpi: BrewKpi; onOpen: () => void }) {
  const [offset, setOffset] = useState(0);
  const [held, setHeld] = useState(false);
  const rotates = kpi.comparisons.length > 1;

  useEffect(() => {
    if (!rotates || held || prefersReducedMotion()) return;
    const timer = window.setInterval(
      () => setOffset((current) => (current + 1) % kpi.comparisons.length),
      ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, [rotates, held, kpi.comparisons.length]);

  const at = (index: number) => kpi.comparisons[(offset + index) % kpi.comparisons.length];
  const primary = kpi.comparisons.length ? at(0) : null;
  const secondary = kpi.comparisons.length > 2 ? [at(1), at(2)] : [];

  return (
    <button
      className={kpi.unavailable ? "brew-kpi brew-kpi--muted" : "brew-kpi"}
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <span className="brew-kpi__head">
        <i aria-hidden="true">{kpi.icon}</i>
        {kpi.label}
      </span>

      <span className="brew-kpi__figure">
        <strong className="brew-kpi__value">
          {formatBrewNumber(kpi.value)}
          {kpi.format === "percent" ? <em>%</em> : null}
        </strong>
        {primary ? (
          // Keyed on the window so each turn of the cluster re-runs the fade.
          <span className="brew-kpi__primary" key={primary.id}>
            <Movement comparison={primary} primary />
          </span>
        ) : (
          <small className="brew-kpi__nodelta">No change tracked</small>
        )}
      </span>

      {secondary.length ? (
        <span className="brew-kpi__movements">
          {secondary.map((comparison) => (
            <Movement comparison={comparison} key={`${comparison.id}-${offset}`} />
          ))}
        </span>
      ) : null}

      {kpi.basisPercent !== null && kpi.basisLabel ? (
        <>
          <span className="brew-kpi__target">
            <small>{kpi.basisLabel}</small>
            <b>{kpi.basisPercent}%</b>
          </span>
          <span className="brew-kpi__bar" aria-hidden="true">
            <i style={{ width: `${Math.min(100, kpi.basisPercent)}%` }} />
          </span>
        </>
      ) : (
        <span className="brew-kpi__target brew-kpi__target--plain">
          <small>{kpi.window}</small>
        </span>
      )}
    </button>
  );
}

export function InstitutionalPulse({
  kpis,
  onOpenKpi,
  onAskEdward,
  onOpenDashboard,
  refreshedAt,
  students,
}: {
  kpis: BrewKpi[];
  onOpenKpi: (id: string) => void;
  onAskEdward: () => void;
  onOpenDashboard: () => void;
  refreshedAt: string;
  students: number;
}) {
  if (!kpis.length) return null;

  return (
    <section className="brew-pulse" aria-labelledby="brew-pulse-title">
      <header className="brew-panel-head">
        <div>
          <p className="brew-eyebrow" id="brew-pulse-title">
            <span aria-hidden="true">⌁</span> Institutional Pulse
          </p>
          <p>Where the {formatBrewNumber(students)}-student institution stands this morning.</p>
        </div>
        <div className="brew-panel-head__actions">
          <button className="brew-edward-chip" type="button" onClick={onAskEdward}>
            <span aria-hidden="true">E</span> Ask for the students
          </button>
          <button className="brew-link" type="button" onClick={onOpenDashboard}>
            View full dashboard <span aria-hidden="true">→</span>
          </button>
        </div>
      </header>

      <div className="brew-kpi-grid">
        {kpis.map((kpi) => (
          <PulseCard kpi={kpi} onOpen={() => onOpenKpi(kpi.id)} key={kpi.id} />
        ))}
      </div>

      <footer className="brew-pulse__foot">
        <span>Comparisons cycle every few seconds — point at a card to hold it still.</span>
        <span>
          Read at {refreshedAt} <i aria-hidden="true">↻</i>
        </span>
      </footer>
    </section>
  );
}
