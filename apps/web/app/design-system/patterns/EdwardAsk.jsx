/**
 * The inline ask — C5 of the walkthrough of 2026-08-20, built 2026-08-22.
 *
 * A quiet control on a row that offers the assistant where the thing is: the
 * mark and one short label, a text button, never a primary one (Workable's
 * "✦ AI" pill and Remote's "Revise with AI" — ENR-181's references). It is
 * presentational and knows no feature: the row that hosts it writes the
 * question in the student's voice from its own data and wires the click to
 * `openEdward` from `features/edward/door.js`, which opens Edward with the
 * question written and unsent. The `mark` is passed in for the same reason.
 */
export default function EdwardAsk({ label = 'Ask Edward', mark, onClick, className }) {
  return (
    <button
      type="button"
      className={['text-button', 'edward-ask', className].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      <span className="edward-ask-mark" aria-hidden="true">
        {mark}
      </span>
      {label}
    </button>
  );
}
