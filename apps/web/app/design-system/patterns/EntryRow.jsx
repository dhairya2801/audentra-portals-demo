import Icon from '../Icon.jsx';

/**
 * A door: one thing this page can open, as a row.
 *
 * ## What it replaces, and why that thing was wrong
 *
 * `EntryCard`, for one afternoon. It was a `Card` with a `CardHead` and a
 * `CardFoot` and **nothing between them**, so what it drew was two bands with a
 * strip of the card's own padding showing between — a card with nothing in the
 * room. That is precisely the shape the Jam of 2026-08-21 removed from My
 * Enrollment and that `Notice.jsx` is written against: *a band on the canvas is
 * a card with nothing in it, and it is what you get when a thing is given a
 * place of its own instead of a place in something.* We took that rule, wrote
 * it down twice, and then built a component that broke it.
 *
 * It was wrong in weight as well as in construction. On Health it stood at the
 * same size as the immunization record — the one obligation that blocks
 * registration — for an optional question that must never read as one. A door
 * is not a peer of the room it leads to.
 *
 * ## The shape
 *
 * Profile already had this row and had it right: `.elsewhere-row`, three of
 * them in one card, an icon tile, the name, one line, and where the click goes.
 * It was a local shape in `features/profile.css`, which is the audit's finding
 * in miniature — a shape with no name that a second page cannot find. So it is
 * here now, it is on the styleguide, and Profile and Health draw the same row.
 *
 * Doors go in a list, and a list goes in a card. One door is a card holding one
 * row and no head, because the row already says what a head would.
 *
 * ## Two kinds, and the trailing cell is what tells them apart
 *
 * `href` is a route and renders an `<a>`; `onOpen` is a panel on this page and
 * renders a `<button>`. `where` says which — the name of the section for a
 * route, `Open` for a panel — because a student is owed the difference between
 * *this takes you somewhere* and *this opens here* before she clicks, and that
 * is the only place the two rows differ.
 *
 * `count` is what stands behind the door today. It is optional and it is never
 * invented: a door with nothing outstanding shows no chip at all, because a
 * zero in a pill is an obligation drawn where there is none.
 *
 * `status` is the state of what stands behind the door, on the face of the row
 * — a `StatusPill` and, after it, the consequence in words, in that order and
 * in the same place the record card says its own (the Health changes of
 * 2026-08-21, H3/H8). It is a line under the note, not a chip in the trailing
 * cell, so the pill and its sentence are read together. A door with no state to
 * say passes nothing and the line is not drawn.
 */
export default function EntryRow({ icon, title, note, status, count = 0, where, href, onOpen }) {
  const inside = (
    <>
      <span className="entry-icon" aria-hidden="true">
        <Icon name={icon} size={17} />
      </span>
      <span className="entry-copy">
        <strong>{title}</strong>
        <small>{note}</small>
        {status ? <span className="entry-status">{status}</span> : null}
      </span>
      <span className="entry-where">
        {count > 0 ? <span className="status-count">{count}</span> : null}
        {where}
        <Icon name="arrow" size={15} />
      </span>
    </>
  );

  if (href) {
    return (
      <a className="entry-row" href={href}>
        {inside}
      </a>
    );
  }

  return (
    <button className="entry-row" type="button" onClick={onOpen}>
      {inside}
    </button>
  );
}
