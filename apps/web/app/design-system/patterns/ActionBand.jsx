import Icon from '../Icon.jsx';

/**
 * The band that points at the one thing to do next.
 *
 * My Enrollment has had it since the first build — the purple ribbon under
 * the head of *Your next steps*, *Start here* on the left and what doing it
 * unlocks on the right — and it was markup inside `TaskCard` with a class
 * named after that one use (`.recommended-banner`). The My Degree brief of
 * 2026-08-21 asked for "the guide's band component" on a second screen, and a
 * shape two sections share is a pattern, whatever it was called first.
 *
 * The anatomy is the reference's: a short label with a glyph, and one thing
 * on the right. What the right side *is* differs by screen and is the only
 * choice the author makes:
 *
 *   aside    a consequence, in words — "Unlocks 3 more steps". The row under
 *            the band carries the action, so the band does not.
 *   action   a button — "See what's waiting". When the band points at
 *            something elsewhere on the page, the band is the way to get there.
 *
 * One or the other, never both. The rule that decides *what the band says* is
 * each screen's own — on My Enrollment it is always the first step of the
 * list; on My Degree it is a match waiting, else a requirement with open
 * courses, else nothing. The component renders only what it is given and
 * never a placeholder: a band with nothing to point at is not rendered.
 *
 * It sits directly under a card's head, above the first row, and bleeds to
 * the card's edges the way the head does — `patterns.css` gives it that when
 * it is a child of `.section-card`, and `.card-rows` gives it the same inside
 * a row.
 */
export default function ActionBand({ icon = 'spark', label, aside, action }) {
  return (
    <div className="action-band">
      <span className="action-band-label">
        {icon ? <Icon name={icon} size={14} /> : null} {label}
      </span>
      {action ? (
        <button type="button" className="action-band-action" onClick={action.onClick}>
          {action.label} <Icon name={action.icon ?? 'arrow'} size={14} />
        </button>
      ) : aside ? (
        <span className="action-band-aside">{aside}</span>
      ) : null}
    </div>
  );
}
