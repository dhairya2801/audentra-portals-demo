"use client";

import { useEffect, useRef, useState } from "react";
import { BREW_TIMEFRAMES } from "./catalog";
import { formatBrewNumber } from "./data";
import type { BrewKpi, BrewNumberFormat, BrewTimeframeId } from "./types";

/** How long each timeframe holds the board before the carousel advances. */
const ROTATE_MS = 4600;
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
function useTicker(target: number, format: BrewNumberFormat) {
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

  return formatBrewNumber(display, format);
}

function Sparkline({ points, favorable }: { points: number[]; favorable: boolean }) {
  const width = 168;
  const height = 40;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, Number.EPSILON);
  const coordinates = points.map((point, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * width;
    const y = height - 4 - ((point - min) / range) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      className={favorable ? "brew-spark" : "brew-spark brew-spark--watch"}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polygon points={`0,${height} ${coordinates.join(" ")} ${width},${height}`} className="brew-spark__area" />
      <polyline points={coordinates.join(" ")} />
    </svg>
  );
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
  const frame = kpi.frames[timeframe];
  const value = useTicker(frame.numeric, kpi.format);

  return (
    <button className="brew-kpi" type="button" onClick={onOpen}>
      <span className="brew-kpi__head">
        <i aria-hidden="true">{kpi.icon}</i>
        {kpi.label}
      </span>
      <strong className="brew-kpi__value">{value}</strong>
      <span className="brew-kpi__movement">
        <i
          className={frame.favorable ? "brew-kpi__delta" : "brew-kpi__delta brew-kpi__delta--watch"}
          key={`${kpi.id}-${timeframe}`}
        >
          {frame.direction === "up" ? "▲" : frame.direction === "down" ? "▼" : "■"} {frame.delta}
        </i>
        <small>{frame.comparison}</small>
      </span>
      <span className="brew-kpi__window">{frame.window}</span>
      <span className="brew-kpi__spark" key={`${kpi.id}-spark-${timeframe}`}>
        <Sparkline points={frame.points} favorable={frame.favorable} />
      </span>
      <span className="brew-kpi__target">
        <small>{frame.target}</small>
        <b>{frame.targetProgress}%</b>
      </span>
      <span className="brew-kpi__bar" aria-hidden="true">
        <i style={{ width: `${frame.targetProgress}%` }} />
      </span>
    </button>
  );
}

export function EnrollmentPulse({
  kpis,
  onOpenKpi,
  onAskEdward,
  onOpenDashboard,
  refreshedAt,
}: {
  kpis: BrewKpi[];
  onOpenKpi: (id: string, timeframe: BrewTimeframeId) => void;
  onAskEdward: () => void;
  onOpenDashboard: () => void;
  refreshedAt: string;
}) {
  const [mode, setMode] = useState<PulseMode>("auto");
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (mode !== "auto" || prefersReducedMotion()) return;
    const timer = window.setInterval(() => {
      setRotation((current) => (current + 1) % BREW_TIMEFRAMES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [mode]);

  const timeframe: BrewTimeframeId = mode === "auto" ? BREW_TIMEFRAMES[rotation].id : mode;
  const active = BREW_TIMEFRAMES.find((entry) => entry.id === timeframe) ?? BREW_TIMEFRAMES[0];

  if (!kpis.length) return null;

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
          <p>Performance vs targets and previous periods</p>
        </div>
        <div className="brew-panel-head__actions">
          <button className="brew-edward-chip" type="button" onClick={onAskEdward}>
            <span aria-hidden="true">E</span> Ask for insights
          </button>
          <button className="brew-link" type="button" onClick={onOpenDashboard}>
            View full dashboard <span aria-hidden="true">→</span>
          </button>
        </div>
      </header>

      <div className="brew-pulse__controls">
        <div className="brew-timeframes" role="group" aria-label="Comparison period">
          <button
            className={mode === "auto" ? "brew-timeframe brew-timeframe--auto is-active" : "brew-timeframe brew-timeframe--auto"}
            type="button"
            aria-pressed={mode === "auto"}
            onClick={() => setMode("auto")}
          >
            <i className="brew-live-dot" aria-hidden="true" />
            Live
          </button>
          {BREW_TIMEFRAMES.map((entry) => (
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

      {mode === "auto" ? (
        <div className="brew-pulse__progress" aria-hidden="true">
          <i key={rotation} style={{ animationDuration: `${ROTATE_MS}ms` }} />
        </div>
      ) : null}

      <div className="brew-kpi-grid">
        {kpis.map((kpi) => (
          <PulseCard kpi={kpi} timeframe={timeframe} onOpen={() => onOpenKpi(kpi.id, timeframe)} key={kpi.id} />
        ))}
      </div>

      <footer className="brew-pulse__foot">
        <span>All goals for Fall 2026</span>
        <span>
          Data refreshed {refreshedAt} <i aria-hidden="true">↻</i>
        </span>
      </footer>
    </section>
  );
}
