"use client";

import { useEffect, useRef, useState } from "react";
import { formatBrewNumber } from "./data";
import type { BrewKpi, BrewTimeframeId } from "./types";

/** How long each timeframe holds the board before the carousel advances. */
const ROTATE_MS = 5200;
const TICKER_MS = 760;

export type PulseMode = "auto" | BrewTimeframeId;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Counts the displayed value toward its new target so a timeframe change reads
 * like a ticker rather than a hard swap. Interrupting mid-flight resumes from
 * wherever the number currently sits.
 */
function useTicker(target: number) {
  const [display, setDisplay] = useState(target);
  const currentRef = useRef(target);
  const frameRef = useRef(0);

  useEffect(() => {
    const from = currentRef.current;
    if (from === target || prefersReducedMotion()) {
      currentRef.current = target;
      setDisplay(target);
      return;
    }
    const started = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / TICKER_MS);
      const eased = 1 - (1 - progress) ** 3;
      const value = from + (target - from) * eased;
      currentRef.current = value;
      setDisplay(value);
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target]);

  return formatBrewNumber(display);
}

function PulseCard({
  kpi,
  timeframe,
  onOpen,
}: {
  kpi: BrewKpi;
  timeframe: BrewTimeframeId;
  onOpen: () => void;
}) {
  const frame = kpi.frames[timeframe] ?? kpi.frames.now;
  const value = useTicker(frame.numeric);

  return (
    <button
      className={frame.unavailable ? "brew-kpi brew-kpi--muted" : "brew-kpi"}
      type="button"
      onClick={onOpen}
    >
      <span className="brew-kpi__head">
        <i aria-hidden="true">{kpi.icon}</i>
        {kpi.label}
      </span>
      <strong className="brew-kpi__value">{value}</strong>
      <span className="brew-kpi__movement">
        {frame.delta ? (
          <>
            <i
              className={frame.favorable ? "brew-kpi__delta" : "brew-kpi__delta brew-kpi__delta--watch"}
              key={`${kpi.id}-${timeframe}`}
            >
              {frame.direction === "up" ? "▲" : frame.direction === "down" ? "▼" : "■"} {frame.delta}
            </i>
            <small>{frame.comparison}</small>
          </>
        ) : (
          // No timestamp proves a change for this metric, so the slot says so
          // rather than borrowing a number from somewhere else.
          <small className="brew-kpi__nodelta">No change tracked</small>
        )}
      </span>
      <span className="brew-kpi__window">{frame.window}</span>
      {frame.basisPercent !== null && frame.basisLabel ? (
        <>
          <span className="brew-kpi__target">
            <small>{frame.basisLabel}</small>
            <b>{frame.basisPercent}%</b>
          </span>
          <span className="brew-kpi__bar" aria-hidden="true">
            <i style={{ width: `${Math.min(100, frame.basisPercent)}%` }} />
          </span>
        </>
      ) : (
        <span className="brew-kpi__target brew-kpi__target--plain">
          <small>{kpi.cohort.clauses.join(" · ") || "Whole roster"}</small>
        </span>
      )}
    </button>
  );
}

export function EnrollmentPulse({
  kpis,
  timeframes,
  onOpenKpi,
  onAskEdward,
  onOpenDashboard,
  refreshedAt,
  students,
}: {
  kpis: BrewKpi[];
  /** Windows the API declared it can reconstruct. Never a fixed list. */
  timeframes: { id: BrewTimeframeId; label: string; short: string }[];
  onOpenKpi: (id: string, timeframe: BrewTimeframeId) => void;
  onAskEdward: () => void;
  onOpenDashboard: () => void;
  refreshedAt: string;
  students: number;
}) {
  const [mode, setMode] = useState<PulseMode>("auto");
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (mode !== "auto" || prefersReducedMotion() || timeframes.length < 2) return;
    const timer = window.setInterval(() => {
      setRotation((current) => (current + 1) % timeframes.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [mode, timeframes.length]);

  if (!kpis.length || !timeframes.length) return null;

  const fallback = timeframes[0];
  const timeframe: BrewTimeframeId =
    mode === "auto" ? (timeframes[rotation] ?? fallback).id : mode;
  const active = timeframes.find((entry) => entry.id === timeframe) ?? fallback;

  return (
    <section className="brew-pulse" aria-labelledby="brew-pulse-title">
      <header className="brew-panel-head">
        <div>
          <h2 id="brew-pulse-title">
            <span className="brew-panel-head__glyph" aria-hidden="true">
              ⌁
            </span>
            Enrollment Pulse
          </h2>
          <p>Where the {students}-student funnel stands, and what share of each stage converts</p>
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

      <div className="brew-pulse__controls">
        <div className="brew-timeframes" role="group" aria-label="Comparison period">
          {timeframes.length > 1 ? (
            <button
              className={
                mode === "auto"
                  ? "brew-timeframe brew-timeframe--auto is-active"
                  : "brew-timeframe brew-timeframe--auto"
              }
              type="button"
              aria-pressed={mode === "auto"}
              onClick={() => setMode("auto")}
            >
              <i className="brew-live-dot" aria-hidden="true" />
              Live
            </button>
          ) : null}
          {timeframes.map((entry) => (
            <button
              className={mode === entry.id ? "brew-timeframe is-active" : "brew-timeframe"}
              type="button"
              aria-pressed={mode === entry.id}
              onClick={() => setMode(entry.id)}
              key={entry.id}
            >
              <b>{entry.short}</b>
              {entry.label}
            </button>
          ))}
        </div>
        <p className="brew-pulse__status" aria-live="polite">
          {mode === "auto" ? (
            <>
              Cycling periods · now showing <strong>{active.label.toLowerCase()}</strong>
            </>
          ) : (
            <>
              Filtered to <strong>{active.label.toLowerCase()}</strong>
            </>
          )}
        </p>
      </div>

      {mode === "auto" && timeframes.length > 1 ? (
        <div className="brew-pulse__progress" aria-hidden="true">
          <i key={rotation} style={{ animationDuration: `${ROTATE_MS}ms` }} />
        </div>
      ) : null}

      <div className="brew-kpi-grid">
        {kpis.map((kpi) => (
          <PulseCard
            kpi={kpi}
            timeframe={timeframe}
            onOpen={() => onOpenKpi(kpi.id, timeframe)}
            key={kpi.id}
          />
        ))}
      </div>

      <footer className="brew-pulse__foot">
        <span>
          Counts, not targets — the platform holds no enrollment plan figures to compare against
        </span>
        <span>
          Read at {refreshedAt} <i aria-hidden="true">↻</i>
        </span>
      </footer>
    </section>
  );
}
