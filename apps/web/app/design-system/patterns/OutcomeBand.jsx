import Icon from '../Icon.jsx';

/**
 * How it ended — stated at the foot of the record, and never in the status.
 *
 * The glossary already draws this line and the workspace has to hold it: a
 * staff task is *"closed with an **outcome** that is recorded apart from its
 * status"*. They are two different facts and collapsing them loses the one that
 * matters. **Done** says the work stopped. **The package was accepted** says
 * what happened to the student — and a task can be Done because the student
 * enrolled elsewhere, or Done because nobody could reach her, and a workspace
 * that renders both as a green chip has thrown away its own history.
 *
 * The Mobbin sweep of 2026-08-24 found the same separation drawn well in
 * Airwallex's resubmission flow, where the status chip and the quoted outcome
 * sit as two distinct things on one screen.
 *
 * ## Why it is pinned, and why it is a band
 *
 * Pinned to the overlay's foot, outside the scroll, because how a case ended is
 * not something a colleague should have to scroll to find — and because a task
 * still open needs the same slot to say so, with the thing that would close it.
 * A band rather than a card for the reason `Notice` gives: a band on the canvas
 * is a card with nothing in it. This one is the foot of the record it belongs
 * to, docked into it, never floating above the content as a strip of its own.
 *
 * `tone` is `StatusDot`'s vocabulary. An open task is `quiet` — an outcome that
 * has not happened yet is not a warning, it is an absence, and it says so in
 * words rather than in colour.
 */
export default function OutcomeBand({
  tone = 'quiet',
  label = 'Outcome',
  value,
  note,
  icon,
  action,
}) {
  return (
    <div className={['outcome-band', tone].filter(Boolean).join(' ')}>
      <div className="outcome-copy">
        <p className="outcome-label">{label}</p>
        <p className="outcome-value">
          {icon ? <Icon name={icon} size={15} /> : null}
          {value}
        </p>
        {note ? <p className="outcome-note">{note}</p> : null}
      </div>
      {action ? (
        <button type="button" className="outcome-action" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
