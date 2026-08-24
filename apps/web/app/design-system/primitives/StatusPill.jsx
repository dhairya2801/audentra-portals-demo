/**
 * The state of a thing, as a pill — **one pill for the whole product**.
 *
 * Three pills existed before the evening of 2026-08-21, none of them on the
 * styleguide: `.status-pill` in `enrollment.css` (amber only, the *In review*
 * on a reviewing step), `.status-chip` in `health.css` (five tones, the record's
 * head) and `.requirement-status` in `classrooms.css` (three standings of a
 * degree requirement). Same job, three anatomies — the audit's finding again.
 * The Health changes of 2026-08-21 (H8) asked for a state vocabulary with one
 * pill for the state and one line for the consequence, always in that order;
 * a vocabulary needs one shape to be said in, so this is it.
 *
 * Uppercase, because a state is a word and not a sentence, and because that is
 * how the product already wrote the ones it had (SATISFIED, NOT STARTED). The
 * tone is the colour contract's: `act` — someone still has to act (amber);
 * `wait` — Aster holds it (amber, the reviewing pulse when `pulse`); `progress`
 * — the machine is checking (amber); `done` — covered, accepted, answered
 * (green); `stop` — it came back (crimson); `quiet` — a fact with no colour,
 * which is the one tone the accommodation question's *not answered* is allowed
 * to wear (ADR-0001: an open question is not an obligation).
 *
 * It is a mark, never a control. It carries no glyph — the pulse is the one
 * thing allowed inside it, and only on a wait.
 */
export default function StatusPill({ tone = 'quiet', pulse = false, className, children }) {
  return (
    <span className={['status-pill', tone, className].filter(Boolean).join(' ')}>
      {pulse ? <i className="pulse" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
