import Icon from '../Icon.jsx';

/**
 * A fact, stated: the label small and muted above, the value carrying the
 * weight. The pair to `Field` — the same record read at the moment nobody is
 * typing into it.
 *
 * It came from `features/onboarding/`, where it was the flow's private idea of
 * a read-only value and the step panel then needed the same shape for a value
 * the student had just typed. Two things about it are decisions:
 *
 *   - **With `office`, it is a fact Aster holds.** The value sits in a dashed,
 *     sunk box with a lock before it, and the line under it names whose desk
 *     the change happens on — "The Registrar changes this". A read-only input
 *     would be a control that refuses, and this product keeps deciding not to
 *     ship one; what it ships instead has to say who *can*. The box is the
 *     approved prototype's, and the lock says "held", not "disabled".
 *   - **Without it, it is a plain fact** — a label over a value, the way a
 *     panel mirrors what a step already holds. `quiet` is for a value that is
 *     not there yet ("Not chosen yet"): the second voice, so the eye running
 *     down the column of values skips it.
 *
 * `note` is one line under either, and it is optional either way.
 */
export default function StatedField({ label, value, office, note, quiet = false, className }) {
  const classes = ['stated-field', office && 'locked', quiet && 'quiet', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <span className="field-label">{label}</span>
      <strong className="stated-value">
        {office ? <Icon name="lock" size={14} /> : null}
        <span>{value}</span>
      </strong>
      {office || note ? (
        <small className="stated-note">
          {office ? `${office} changes this, not you.` : note}
        </small>
      ) : null}
    </div>
  );
}
