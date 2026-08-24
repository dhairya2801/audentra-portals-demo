import Icon from '../Icon.jsx';

/**
 * When a thing is due, told by two clocks.
 *
 * A queue cell that says only `Aug 27` makes every reader do subtraction, and
 * one that says only `in 3 days` makes them ask *from when*. Every dense queue
 * in the Mobbin sweep of 2026-08-24 shows both: the date as the fact, and the
 * distance under it as the pressure. Zoho's workqueue is the clearest case —
 * plain dates all the way down a column, and a single red `Late by 3 days` on
 * the one row that has slipped.
 *
 * That single red is the contract this component carries:
 *
 *   **The date is never coloured. Only lateness is.**
 *
 * Not "due soon", not "due today" — those are still facts, and a fact that has
 * not gone wrong is written in ink. Crimson here means the institution has
 * missed something, which is the same thing crimson means to a student (a
 * deadline or a failure), so the two products keep one meaning for one hue.
 *
 * The relative line is the caller's sentence, not a computed one. A workspace
 * counts in business days, an SLA counts in hours, and a term deadline counts
 * in weeks; the component that draws the cell is the wrong place to know which.
 */
export default function Deadline({ date, relative, late = false, className }) {
  return (
    <span className={['deadline', late ? 'late' : null, className].filter(Boolean).join(' ')}>
      <span className="deadline-date">{date}</span>
      {relative ? (
        <span className="deadline-relative">
          {late ? <Icon name="alert" size={12} /> : null}
          {relative}
        </span>
      ) : null}
    </span>
  );
}
