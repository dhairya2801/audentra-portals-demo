import { ICON_PATHS } from './icon-paths.js';

/**
 * The product's icons — Phosphor, vendored, in four weights with one job each.
 *
 * Until the Jam of 2026-08-21 the glyphs were hand-drawn here, 24×24 at a
 * 1.9 stroke. They were ours, which was the point, and they were also forty-
 * seven separate drawings by several hands over several days, which showed:
 * the calendar's corners and the file's corners did not agree, a 14px clock
 * and an 18px clock were the same stroke, and there was no such thing as a
 * filled or a two-tone version of anything, so a nav row could not say "you
 * are here" with its glyph and a tile could not be told apart from a button.
 *
 * The glyphs are now Phosphor's (https://phosphoricons.com, MIT). The *data*
 * is still ours: `scripts/icons/manifest.mjs` maps our names to Phosphor's,
 * `npm run icons` writes the path data into `icon-paths.js`, and that file is
 * committed. No package, no request at runtime, and a name a component asks
 * for — `alert`, `spark`, `chevron` — does not change when the drawing does.
 *
 * ## Four weights, and the rule for each
 *
 *   regular   the default. Every glyph of 16px or more, inline with text, in
 *             a button, in a fact. What the product is mostly made of.
 *   bold      the small glyph. Below 16px a regular stroke is a hair; `Icon`
 *             switches to bold on its own, so a chip, a pill and a meta fact
 *             never have to ask. Authors do not pass it.
 *   fill      the *on* state of a stateful control, and nothing else: the nav
 *             row you are on, the sort you chose, the bell with unread. Never a
 *             static glyph — a filled icon that cannot be switched off is a
 *             control that looks pressed.
 *   duotone   the mark in a tinted tile, and nothing else: a status head, a
 *             task-type tile, a state card, a drawer's header tile, the band's
 *             orbit core. One per tile. Never inline with text.
 *
 * Light and thin are not vendored. Two tile weights would be two tile styles.
 *
 * The rule is mostly not the author's to remember: `CardHead`, `StateCard`,
 * `Spot` and the task-type tile pass `duotone` themselves, `NavRow` passes
 * `fill` when active, and `Icon` picks bold by size. A page that writes
 * `weight=` by hand is usually doing a primitive's job.
 */
export const ICON_NAMES = Object.keys(ICON_PATHS);

/**
 * Glyphs that are a line and nothing else — a check, an arrow, a caret, an x,
 * three bars, a spinner. Phosphor's duotone and fill versions of these invent
 * a box or a disc to put the line in, and a check that has grown a square
 * behind it is a checkbox, not a check. In a tile they stay outline; a tile
 * that asks for duotone on one of these gets regular back.
 */
const LINE_GLYPHS = new Set([
  'check',
  'arrow',
  'back',
  'chevron',
  'close',
  'menu',
  'refresh',
  'spinner',
  'progress',
]);

export default function Icon({ name, size = 18, weight, className }) {
  const entry = ICON_PATHS[name];
  if (!entry) {
    if (process.env.NODE_ENV !== 'production') console.warn(`Icon: no glyph named "${name}"`);
    return null;
  }
  const asked = weight === 'duotone' && LINE_GLYPHS.has(name) ? undefined : weight;
  const chosen = asked ?? (size < 16 ? 'bold' : 'regular');
  const paths = entry[chosen] ?? entry.regular;
  const duo = chosen === 'duotone' && paths.length === 2;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden
      data-weight={chosen}
    >
      {duo ? (
        <>
          <path d={paths[0]} opacity=".2" />
          <path d={paths[1]} />
        </>
      ) : (
        paths.map((d) => <path key={d.slice(0, 24)} d={d} />)
      )}
    </svg>
  );
}
