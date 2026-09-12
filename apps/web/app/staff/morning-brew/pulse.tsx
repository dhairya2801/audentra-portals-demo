"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { topicById } from "./catalog";
import { EdwardButton } from "./cards";
import { movementLabel, movementTone, targetStatus } from "./presentation";
import { edwardKpiGreeting } from "./data";
import { Glyph } from "./glyphs";
import type { BrewDetailLevelId, BrewKpi, BrewKpiComparison } from "./types";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const arrowFor = (direction: BrewKpiComparison["direction"]) =>
  direction === "up" ? "▲" : direction === "down" ? "▼" : "■";

/**
 * One comparison, in the one size the card uses.
 *
 * The tone follows `favorable`, not `direction`: a falling verification queue
 * is good news and a rising one is not, and a card that painted every downward
 * arrow red would tell the reader the opposite of what happened.
 */
export function Movement({ comparison }: { comparison: BrewKpiComparison }) {
  return (
    <span className="brew-move">
      <b className={movementTone(comparison)}>
        <i aria-hidden="true">{arrowFor(comparison.direction)}</i> {comparison.delta}
        {comparison.percent ? <em>{comparison.percent}</em> : null}
      </b>
      <small>{movementLabel(comparison.label)}</small>
    </span>
  );
}

/**
 * The line is coloured by the comparison that covers the same thirty days it
 * draws, not by whichever window happens to be showing. A queue that is falling
 * and one that is rising are different news, and a line that changed colour
 * every few seconds while its shape stayed put would be saying so at random.
 */
const spanFavorable = (kpi: BrewKpi) =>
  (kpi.comparisons.find((comparison) => comparison.label.includes("30 days")) ??
    kpi.comparisons.at(-1))?.favorable ?? true;

/* -------------------------------------------------------------------- chart */

const CHART_W = 300;
const CHART_H = 92;
const CHART_PAD = 6;

/**
 * Thirty days of the figure: where it has been, and where this pace puts it.
 *
 * Three lines, and each is a different kind of claim, so each is drawn
 * differently:
 *
 *  - **last year** is history and is known all the way across, so it runs the
 *    full axis in a muted solid;
 *  - **this year** is measured, so it is solid and carries the card's colour;
 *  - **the forecast** is arithmetic on the current pace and nothing more, so it
 *    is dotted, it starts on today's point rather than beside it, and it stops
 *    where the axis stops.
 *
 * The dotted run-out is the one place this surface draws a number nobody
 * counted, which is why it is drawn as a different kind of line rather than as
 * more of the same one.
 */
export function TrendChart({ kpi, favorable }: { kpi: BrewKpi; favorable: boolean }) {
  const clipId = useId();
  const actual = kpi.series;
  const forecast = kpi.forecast;
  const previous = kpi.previousYear;
  if (actual.length < 2) return null;

  // The axis runs from the oldest reading to the last forecast day. The
  // forecast's first point is today, so the two lines share it rather than
  // double-counting a day.
  const total = actual.length + Math.max(0, forecast.length - 1);
  const values = [...actual, ...forecast, ...previous];
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;

  const x = (fraction: number) => CHART_PAD + fraction * (CHART_W - CHART_PAD * 2);
  const y = (value: number) =>
    CHART_H - CHART_PAD - ((value - low) / span) * (CHART_H - CHART_PAD * 2);

  const path = (points: number[], from: number, to: number) =>
    points
      .map((value, index) => {
        const fraction =
          points.length === 1 ? from : from + ((to - from) * index) / (points.length - 1);
        return `${index ? "L" : "M"}${x(fraction).toFixed(1)} ${y(value).toFixed(1)}`;
      })
      .join(" ");

  const todayFraction = (actual.length - 1) / (total - 1);
  const stroke = favorable ? "#0f9174" : "#d0453a";

  return (
    <div className="brew-kpi__chart">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${kpi.label} over thirty days, against the same window last year, with the current pace continued`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={CHART_W} height={CHART_H} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <path
            className="brew-trend brew-trend--previous"
            d={path(previous, 0, 1)}
            vectorEffect="non-scaling-stroke"
          />
          <line
            className="brew-trend__today"
            x1={x(todayFraction)}
            x2={x(todayFraction)}
            y1={CHART_PAD / 2}
            y2={CHART_H - CHART_PAD / 2}
            vectorEffect="non-scaling-stroke"
          />
          {forecast.length > 1 ? (
            <path
              className="brew-trend brew-trend--forecast"
              d={path(forecast, todayFraction, 1)}
              stroke={stroke}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          <path
            className="brew-trend brew-trend--actual"
            d={path(actual, 0, todayFraction)}
            stroke={stroke}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
    </div>
  );
}

/**
 * What the three lines are, said once for the band rather than once per card.
 *
 * Six copies of the same key under six charts is six times the ink for one
 * fact, and at a sixth of the band's width it wrapped onto two lines anyway.
 * The convention is identical on every card, so it belongs to the section.
 */
export function TrendKey() {
  return (
    <span className="brew-trend-key">
      <span className="is-previous">Last year</span>
      <span className="is-actual">This year</span>
      <span className="is-forecast">Forecast (current pace)</span>
    </span>
  );
}

/* --------------------------------------------------------------------- card */

/** Rotating comparisons, shared across setup previews and the briefing. */
export function PulseCard({
  kpi,
  level,
  readerFirstName,
  onOpen,
  onAskEdward,
}: {
  kpi: BrewKpi;
  level: BrewDetailLevelId;
  readerFirstName: string;
  onOpen?: () => void;
  onAskEdward?: () => void;
}) {
  const [comparisonIndex, setComparisonIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || kpi.comparisons.length < 2) return;
    const timer = window.setInterval(() => {
      if (!prefersReducedMotion()) {
        setComparisonIndex((index) => (index + 1) % kpi.comparisons.length);
      }
    }, 3400);
    return () => window.clearInterval(timer);
  }, [paused, kpi.comparisons.length]);
  const current = kpi.comparisons[comparisonIndex % kpi.comparisons.length] ?? null;
  const showTarget = level !== "glance";
  const showChart = level === "deep";

  return (
    <div
      data-topic={kpi.topic}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      className={kpi.unavailable ? "brew-kpi brew-kpi--muted" : "brew-kpi"}
    >
      <span className="brew-kpi__head">
        <i aria-hidden="true">
          <Glyph name={topicById(kpi.topic)?.icon ?? "students"} size={15} />
        </i>
        {/* Stretched over the whole card, so the figure and everything under
            it opens the drill-down while the Edward chip stays its own
            target. */}
        <button className="brew-stretch" type="button" onClick={onOpen}>
          {kpi.label}
        </button>
        <EdwardButton label={edwardKpiGreeting(readerFirstName, kpi.label)} onClick={onAskEdward} />
      </span>

      <span className="brew-kpi__figure">
        <strong className="brew-kpi__value">
          {kpi.display}

        </strong>
        {current ? (
          <span className="brew-kpi__primary" key={current.id}>
            <Movement comparison={current} />
          </span>
        ) : (
          <small className="brew-kpi__nodelta">No change tracked</small>
        )}
      </span>

      {kpi.comparisons.length > 1 ? (
        <span className="brew-kpi__ticks" role="group" aria-label={`${kpi.label} comparison period`}>
          {kpi.comparisons.map((comparison, index) => (
            <button
              type="button"
              key={comparison.id}
              aria-label={movementLabel(comparison.label)}
              title={movementLabel(comparison.label)}
              aria-pressed={index === comparisonIndex}
              onClick={() => setComparisonIndex(index)}
            ><i className={index === comparisonIndex ? "is-on" : ""} /></button>
          ))}
        </span>
      ) : null}

      {/* The whole cluster, spoken once, for anyone who cannot watch it turn. */}
      <span className="sr-only">
        {kpi.comparisons
          .map((comparison) => `${comparison.delta} ${movementLabel(comparison.label)}`)
          .join(". ")}
      </span>

      {showChart ? <TrendChart kpi={kpi} favorable={spanFavorable(kpi)} /> : null}

      {showTarget ? <KpiGoal kpi={kpi} /> : null}
      {showChart && !kpi.projection ? <p className="brew-kpi__note">{kpi.trendNote}</p> : null}

    </div>
  );
}

/** Shared goal readout. Status comes from the supplied projection; movement
 * comes from the metric's own favorable flag, never the arrow direction. */
export function KpiGoal({ kpi }: { kpi: BrewKpi }) {
  const hasTarget = kpi.target !== null && kpi.progressPercent !== null;
  return <div className={`brew-goal ${kpi.projection ? `is-${kpi.projection.status}` : ""}`}>
    {hasTarget ? <>
      <div className="brew-goal__target"><span>Goal <b>{kpi.targetDisplay}</b></span><small>{kpi.dueLabel}</small></div>
      <span className="brew-kpi__bar" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, kpi.progressPercent ?? 0))}%` }} /></span>
      <span className="sr-only">{kpi.progressPercent}% of target</span>
    </> : <small>{kpi.window}</small>}
    {kpi.projection ? <div className="brew-goal__outlook"><b>{targetStatus[kpi.projection.status]}</b><p>Projected to reach {kpi.projection.display} {kpi.projection.byLabel}</p></div> : null}
  </div>;
}

/* ------------------------------------------------------------------ section */

/**
 * The Pulse row scrolls rather than wraps.
 *
 * A leader reads this band across, not down: the funnel is a sequence, and a
 * card that wrapped onto a second line would put "yield" underneath
 * "applications" as though it came first. So the row is one row at every width,
 * showing as many whole cards as fit, and the rest arrive through the next
 * control. Scrolling by exactly one viewport keeps whole cards in view.
 */
function useReel() {
  const track = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState({ atStart: true, atEnd: true });

  const measure = useCallback(() => {
    const node = track.current;
    if (!node) return;
    const max = node.scrollWidth - node.clientWidth;
    setState({ atStart: node.scrollLeft <= 2, atEnd: node.scrollLeft >= max - 2 });
  }, []);

  useEffect(() => {
    const node = track.current;
    if (!node) return;
    measure();
    node.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure]);

  const page = (direction: 1 | -1) => {
    const node = track.current;
    if (!node) return;
    node.scrollBy({
      left: direction * node.clientWidth,
      // A JS `behavior` wins over the stylesheet's `scroll-behavior`, so the
      // reduced-motion answer has to be given here rather than in CSS.
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  // A tuple rather than one object: the ref and the two booleans are read in
  // different places, and bundling them makes every read of `atStart` look
  // like a ref access to a linter that cannot tell them apart.
  return [track, { atStart: state.atStart, atEnd: state.atEnd, page }] as const;
}

export function InstitutionalPulse({
  kpis,
  level,
  readerFirstName,
  onOpenKpi,
  onAskEdwardFor,
  refreshedAt,
}: {
  kpis: BrewKpi[];
  level: BrewDetailLevelId;
  readerFirstName: string;
  onOpenKpi: (id: string) => void;
  /** Edward, opened on one figure rather than on the funnel. */
  onAskEdwardFor: (kpi: BrewKpi) => void;
  refreshedAt: string;
}) {
  const [reelTrack, reel] = useReel();
  if (!kpis.length) return null;

  const paging = !reel.atStart || !reel.atEnd;
  // Keep each domain together, preserving the first-seen group and metric order.
  const topicOrder = [...new Set(kpis.map((kpi) => kpi.topic))];
  const groupedKpis = topicOrder.flatMap((topic) => kpis.filter((kpi) => kpi.topic === topic));

  return (
    <section className={`brew-pulse brew-pulse--${level}`} aria-labelledby="brew-pulse-title">
      <header className="brew-section-head">
        <h2 id="brew-pulse-title">
          <i className="brew-section-head__mark brew-section-head__mark--blue" aria-hidden="true">
            <Glyph name="pulse" size={20} />
          </i>
          Institutional Pulse
          <small>Your goals, progress and outlook</small>
        </h2>
        <div className="brew-section-head__actions">
          {paging ? (
            <span className="brew-reel__controls">
              <button
                type="button"
                onClick={() => reel.page(-1)}
                disabled={reel.atStart}
                aria-label="Previous metrics"
              >
                <Glyph name="prev" size={14} />
              </button>
              <button
                type="button"
                onClick={() => reel.page(1)}
                disabled={reel.atEnd}
                aria-label="Next metrics"
              >
                <Glyph name="next" size={14} />
              </button>
            </span>
          ) : null}

        </div>
      </header>

      <div className="brew-kpi-reel" ref={reelTrack} tabIndex={0} aria-label="Institutional metrics">
        {groupedKpis.map((kpi) => (
          <PulseCard
            kpi={kpi}
            level={level}
            readerFirstName={readerFirstName}
            onOpen={() => onOpenKpi(kpi.id)}
            onAskEdward={() => onAskEdwardFor(kpi)}
            key={kpi.id}
          />
        ))}
      </div>

      <footer className="brew-pulse__foot">
        {level === "deep" ? <TrendKey /> : null}
        <span>
          Updated {refreshedAt}
        </span>
      </footer>
    </section>
  );
}
