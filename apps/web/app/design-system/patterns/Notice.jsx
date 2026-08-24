import Icon from '../Icon.jsx';

/**
 * One line the page has to say, drawn as a zone of the thing it is about.
 *
 * ## What it replaces
 *
 * Ten of these were hand-built, one per section: `.gate-notice` on My
 * Enrollment, `.alert-strip` on My Financials, My Documents and Help,
 * `.advisory-banner` in the academic drawer, `.required-strip` on My Campus
 * Life, a `StateCard` pressed into service on My Housing, and `.record-note`,
 * `.step-notice` and `.edward-notice` besides. Same job, nine anatomies, nine
 * palettes — the audit's ten rails rewriting the same anchor card, again.
 *
 * ## The rule it exists to enforce: a notice has no shape of its own
 *
 * The Jam of 2026-08-21 pointed at the amber band on My Enrollment: a rounded
 * card, 1180px wide and 62px tall, plus an 18px gap under it, spent on one
 * sentence of sixty characters — seventy per cent of it empty. A band on the
 * canvas is a card with nothing in it, and it is what you get when a notice is
 * given a place of its own instead of a place *in* something.
 *
 * So this component paints no border, no radius, no shadow and no margin. It is
 * an anatomy — a mark, the sentence, and at most one way to act on it — and it
 * takes its shape from the zone it is docked into. A card already has the three
 * zones a notice can occupy, and they are the ones already in the styleguide:
 *
 *   panel foot     `PageShell`'s `notice` slot, when the section has a summary
 *                  panel. The figure says 33%; this says why it is not 100%. A
 *                  footnote to a number cannot be scrolled past without it.
 *   card head      `<Notice>` as the first child of a `.section-card`, under
 *                  its heading. It qualifies that list and nothing else.
 *   card foot      inside `.card-foot`. Provenance, and anything that is read
 *                  after the content rather than before it.
 *
 * A page never chooses between them by feel, which is what produced My
 * Documents' worst state: `sent back — send a new copy` in the quiet slot on
 * the panel, and `we are still checking` in the loud one above it. The scope of
 * the sentence picks the zone. Whole section, one list, or one row — and a row
 * is not this component, it is a chip on the row.
 *
 * ## Tones
 *
 * `urgent` and `soon` are `escalation()`'s two levels, so a deadline reaches
 * this component already carrying its tone. `working` is Aster holding
 * something, and `quiet` is everything that is true but not hers to act on —
 * neither gets a colour that asks her to do something, because she cannot.
 *
 * ## The action
 *
 * One, or none. It is a `link-button` in the notice's own ink rather than a
 * filled button: the notice is a sentence, and the way to act on it is the end
 * of that sentence. `AlertStrip`'s `secondary-button` was the second thing in
 * the row competing for the same click as the row it pointed at.
 */
export default function Notice({ tone = 'quiet', icon, title, action, children }) {
  return (
    <div className={`notice ${tone}`}>
      {icon ? (
        <span className="notice-mark" aria-hidden="true">
          <Icon name={icon} size={16} />
        </span>
      ) : null}

      {/* The lead clause is its own element rather than "the first `strong`":
          My Profile's legend puts `<strong>Yours to change</strong>` in the
          middle of its sentence, and a rule keyed on `strong` would have
          punctuated it as a title. */}
      <p className="notice-copy">
        {title ? <strong className="notice-title">{title}</strong> : null}
        {children}
      </p>

      {/* A route is an `<a>` and a panel on this page is a `<button>` — the
          same line `EntryRow` draws. `href` makes it a link a middle click and
          a screen reader both recognise; `onClick` may still ride along, for a
          popover that has to close before the page moves. */}
      {action?.href ? (
        <a className="notice-action link-button" href={action.href} onClick={action.onClick}>
          {action.label} <Icon name={action.icon ?? 'arrow'} size={14} />
        </a>
      ) : action ? (
        <button className="notice-action link-button" onClick={action.onClick}>
          {action.label} <Icon name={action.icon ?? 'arrow'} size={14} />
        </button>
      ) : null}
    </div>
  );
}
