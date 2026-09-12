/**
 * The marks the daily briefing draws.
 *
 * The workspace's vendored Phosphor set (`design-system/Icon.jsx`) covers most
 * of the product, but the briefing needs a handful it does not carry — a
 * percent-in-a-circle, a bank, a target, a broadcast wave, the Outlook square —
 * and it wants them at one weight, on one 24-unit grid, so a row of six KPI
 * heads reads as one row rather than six drawings. They live here rather than
 * in the shared set because they are this surface's vocabulary: nothing else in
 * the product asks for a mailbox provider's logo.
 *
 * Every glyph is stroked with `currentColor` at 1.7 and inherits its size from
 * the caller, except `flag` and `outlook`, which are solid by design — a flag
 * on an action row is a status, and a provider mark is a provider mark.
 */

import type { CSSProperties } from "react";

type GlyphName =
  | "applications"
  | "admits"
  | "deposit"
  | "rate"
  | "tuition"
  | "yield"
  | "verification"
  | "aid"
  | "housing"
  | "events"
  | "students"
  | "calendar"
  | "mail"
  | "actions"
  | "sparkle"
  | "pulse"
  | "broadcast"
  | "links"
  | "clock"
  | "flag"
  | "outlook"
  | "chevron"
  | "arrow"
  | "refresh"
  | "prev"
  | "next";

/**
 * Stroked paths, on a 24×24 grid. Kept as data rather than as components so a
 * caller can only ever ask for a name, and the whole set stays one weight.
 */
const STROKE: Record<string, string[]> = {
  applications: ["M12 12.4a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4Z", "M4.6 19.6a7.6 7.6 0 0 1 14.8 0"],
  admits: ["M3.4 6.6h17.2v10.8H3.4z", "M3.9 7.1 12 13l8.1-5.9"],
  deposit: [
    "M12 21.2a9.2 9.2 0 1 0 0-18.4 9.2 9.2 0 0 0 0 18.4Z",
    "M12 6.6v10.8",
    "M14.7 9.2a2.9 2.9 0 0 0-2.7-1.5h-.6a2.3 2.3 0 0 0-.4 4.5l2.2.4a2.3 2.3 0 0 1-.4 4.6H12a2.9 2.9 0 0 1-2.7-1.6",
  ],
  rate: [
    "M12 21.2a9.2 9.2 0 1 0 0-18.4 9.2 9.2 0 0 0 0 18.4Z",
    "M15.2 8.8 8.8 15.2",
    "M9.4 10.3a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
    "M14.6 15.7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  ],
  tuition: ["M2.8 9.4 12 4.2l9.2 5.2", "M4.9 9.9v8.2", "M9.6 9.9v8.2", "M14.4 9.9v8.2", "M19.1 9.9v8.2", "M2.8 19.8h18.4"],
  yield: [
    "M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2Z",
    "M12 16.6a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2Z",
    "M12 13.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z",
  ],
  verification: [
    "M13.4 2.9H6.4a1.5 1.5 0 0 0-1.5 1.5v15.2a1.5 1.5 0 0 0 1.5 1.5h11.2a1.5 1.5 0 0 0 1.5-1.5V8.5Z",
    "M13.4 2.9v5.6h5.7",
    "M8.6 15.4l2.1 2.1 4.2-4.2",
  ],
  aid: [
    "M3.4 7.6a1.6 1.6 0 0 1 1.6-1.6h14a1.6 1.6 0 0 1 1.6 1.6v8.8a1.6 1.6 0 0 1-1.6 1.6H5a1.6 1.6 0 0 1-1.6-1.6z",
    "M16.4 13.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Z",
    "M3.4 10.2h17.2",
  ],
  housing: ["M3.4 11.4 12 4.4l8.6 7", "M5.4 10.6v8.8h13.2v-8.8", "M9.6 19.4v-5.2h4.8v5.2"],
  events: [
    "M4.2 8.2h15.6v3a2 2 0 0 0 0 4v2.6H4.2v-2.6a2 2 0 0 0 0-4z",
    "M9.8 8.2v9.6",
  ],
  students: [
    "M12 3.6 21.4 8 12 12.4 2.6 8Z",
    "M6.4 10v5.2c0 1.6 2.5 2.9 5.6 2.9s5.6-1.3 5.6-2.9V10",
  ],
  calendar: [
    "M4.4 5.6h15.2a1.4 1.4 0 0 1 1.4 1.4v11.6a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 18.6V7a1.4 1.4 0 0 1 1.4-1.4Z",
    "M3 9.8h18",
    "M7.8 3.6v3.4",
    "M16.2 3.6v3.4",
  ],
  reply: ["M9 5 3 11l6 6", "M3 11h10a7 7 0 0 1 7 7"],
  mail: ["M3.6 6.4h16.8v11.2H3.6z", "M4 6.8 12 12.6l8-5.8"],
  actions: [
    "M4.4 4.4h15.2a1.4 1.4 0 0 1 1.4 1.4v12.4a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 18.2V5.8a1.4 1.4 0 0 1 1.4-1.4Z",
    "M7.8 10h8.4",
    "M7.8 14h5.6",
  ],
  pulse: ["M2.6 12.4h4L9 6.2l3.4 11.6 2.4-5.4h6.6"],
  broadcast: [
    "M5 14.6a4.6 4.6 0 0 1 4.6 4.6",
    "M5 9a10.2 10.2 0 0 1 10.2 10.2",
    "M5 3.6A15.6 15.6 0 0 1 20.6 19.2",
  ],
  links: [
    "M20.4 12A8.4 8.4 0 1 0 12 20.4",
    "M20.4 12h-3.6",
    "M12 7.4v5",
  ],
  clock: ["M12 20.8a8.8 8.8 0 1 0 0-17.6 8.8 8.8 0 0 0 0 17.6Z", "M12 7.4V12l3.2 2"],
  chevron: ["m9.4 5.6 6.4 6.4-6.4 6.4"],
  arrow: ["M4.4 12h14.4", "m13 6.2 5.8 5.8-5.8 5.8"],
  refresh: [
    "M20.2 12a8.2 8.2 0 1 1-2.6-6",
    "M20.6 4.2v4.4h-4.4",
  ],
  prev: ["m14.6 5.6-6.4 6.4 6.4 6.4"],
  next: ["m9.4 5.6 6.4 6.4-6.4 6.4"],
};

/** Solid marks. A flag is a status and a provider logo is a logo. */
const SOLID: Record<string, string[]> = {
  flag: ["M5.6 3.2a1 1 0 0 1 1 1v15.6a1 1 0 0 1-2 0V4.2a1 1 0 0 1 1-1Z", "M7.6 4.4h11.2l-2.9 4.2 2.9 4.2H7.6z"],
  sparkle: ["M12 2.2c.5 3.8 2.2 6.4 5.4 7.6l1.4.5-1.4.5c-3.2 1.2-4.9 3.8-5.4 7.6l-.3 2.2-.3-2.2c-.5-3.8-2.2-6.4-5.4-7.6L4.6 10.3l1.4-.5c3.2-1.2 4.9-3.8 5.4-7.6l.3-2.2z"],
};

export interface GlyphProps {
  name: string;
  /** Rendered square, in pixels. Inherits colour from the caller. */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Set only where the glyph is the sole label of a control. */
  title?: string;
}

export function Glyph({ name, size = 16, className, style, title }: GlyphProps) {
  const solid = SOLID[name];
  const stroke = STROKE[name];
  if (!solid && !stroke) return null;

  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {solid
        ? solid.map((d) => <path d={d} fill="currentColor" key={d} />)
        : stroke.map((d) => (
            <path
              d={d}
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              key={d}
            />
          ))}
    </svg>
  );
}

/**
 * The Outlook square, as the briefing's mailbox card and its setup row draw it.
 *
 * Kept apart from `Glyph` because it is the one mark here that is somebody
 * else's: it carries its own two colours rather than `currentColor`, so it can
 * never be tinted into looking like part of our own icon set.
 */
export function OutlookMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1.6" y="1.6" width="20.8" height="20.8" rx="4.6" fill="#0F6CBD" />
      <path
        d="M8.5 7.2c-2.35 0-3.85 1.9-3.85 4.8s1.5 4.8 3.85 4.8 3.85-1.9 3.85-4.8S10.85 7.2 8.5 7.2Zm0 7.5c-1.1 0-1.8-1.05-1.8-2.7s.7-2.7 1.8-2.7 1.8 1.05 1.8 2.7-.7 2.7-1.8 2.7Z"
        fill="#fff"
      />
      <rect x="13.5" y="9.4" width="5.6" height="5.2" rx="0.5" fill="#fff" />
      <path
        d="m13.9 10.1 2.4 1.9 2.4-1.9"
        stroke="#0F6CBD"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export type { GlyphName };
