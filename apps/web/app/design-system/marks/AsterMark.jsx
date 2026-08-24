/**
 * Aster University's crest.
 *
 * A heater shield, parted per chevron inverted: in chief, on paper, an open
 * book; in base, on the field, an aster — the flower the institution is named
 * for, eight petals on a disc. That is the grammar American universities
 * actually use for a mark — a shield, a book, a chevron, and one charge that
 * is the school's own — drawn with few enough parts to hold at 40px in the
 * brand row and at 16px in the browser tab. Before 2026-08-21 the mark was the
 * letter A in a purple square, which is a placeholder that says so; for an
 * afternoon it was the flower alone on a disc, which read as an icon, not an
 * institution (Marco, the same day). It is deliberately not a glyph from the
 * icon set: a crest that is also the icon for something else is a crest that
 * can be mistaken for a button.
 *
 * `tile` draws it in colour — the purple field, the paper chief, and a hairline
 * of paper around the shield so it still reads on a purple tile (the
 * destination tile for Aster's own payment portal). Without it the crest is
 * drawn in `currentColor`, for paper or for ink. The drawing is 32 wide by 36
 * tall; `size` is the height.
 */
const PETALS = [0, 45, 90, 135, 180, 225, 270, 315];

const SHIELD = 'M4 3h24v14.6c0 8.3-5.8 13.2-12 15.4C9.8 30.8 4 25.9 4 17.6Z';
const CHIEF = 'M4 3h24v7.4L16 15 4 10.4Z';
const CHEVRON = 'M4 10.4 16 15l12-4.6';
const BOOK_LEFT = 'M10 7c2.2-.8 4.2-.6 5.6.6v4.8c-1.4-1.1-3.4-1.3-5.6-.6Z';
const BOOK_RIGHT = 'M22 7c-2.2-.8-4.2-.6-5.6.6v4.8c1.4-1.1 3.4-1.3 5.6-.6Z';
const ASTER_Y = 23.5;

export default function AsterMark({ size = 24, tile = false, className, title }) {
  const petals = PETALS.map((angle) => (
    <ellipse
      key={angle}
      cx="16"
      cy={ASTER_Y - 4.1}
      rx="1.25"
      ry="2.7"
      transform={`rotate(${angle} 16 ${ASTER_Y})`}
    />
  ));

  return (
    <svg
      className={className}
      width={Math.round((size * 32) / 36)}
      height={size}
      viewBox="0 0 32 36"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      {tile ? (
        <>
          <path
            d={SHIELD}
            fill="var(--purple)"
            stroke="var(--on-ink)"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <path d={CHIEF} fill="var(--on-ink)" />
          <g fill="var(--purple)">
            <path d={BOOK_LEFT} />
            <path d={BOOK_RIGHT} />
          </g>
          <g fill="var(--on-ink)" fillOpacity=".92">
            {petals}
          </g>
          <circle cx="16" cy={ASTER_Y} r="1.3" fill="var(--on-ink)" />
        </>
      ) : (
        <>
          <path
            d={SHIELD}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d={CHEVRON}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <g fill="currentColor">
            <path d={BOOK_LEFT} />
            <path d={BOOK_RIGHT} />
          </g>
          <g fill="currentColor" fillOpacity=".85">
            {petals}
          </g>
          <circle cx="16" cy={ASTER_Y} r="1.3" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
