import { useId } from 'react';
import Icon from '../Icon.jsx';

/**
 * One field, and the only way this product says a field is wrong.
 *
 * It came from `features/onboarding/`, where it was one section's private idea
 * of what a field is, next to `features/profile/FieldRow` which was another
 * section's. Eighteen raw `<input>` across fifteen files, two components that
 * both called their label `.field-label` and meant different things by it, and
 * `aria-invalid` written **once in the whole repository** — on this component,
 * by the one author who happened to think of it.
 *
 * So `error` is a string, not a boolean, and it is the only way in:
 *
 *   - it paints the edge crimson and turns the label with it, so the field is
 *     findable when the message has scrolled off;
 *   - it prints the message under the field, led by a glyph, because crimson
 *     alone is not a signal on a screen that is not being read in colour;
 *   - it wires `aria-invalid` and `aria-describedby` itself.
 *
 * A boolean `invalid` would let a caller ship a field that is red to the eye
 * and silent to a screen reader, which is exactly the state this repo was in.
 * There is no such prop. If there is nothing to say, the field is not wrong.
 *
 * **When it runs is the caller's half of the contract**, and the rule is:
 * never while typing; on blur once the field has been touched; on submit for
 * everything; and once a field is *showing* an error, on every change, so it
 * clears the moment it is fixed rather than at the next blur.
 */
export default function Field({
  label,
  hint,
  error,
  value,
  type = 'text',
  autoComplete,
  onChange,
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  // The message first: a screen reader should hear what is wrong before it
  // hears the advice that was already there when the field was still fine.
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <label className={error ? 'field invalid' : 'field'} htmlFor={id}>
      <span className="field-label">{label}</span>

      <span className="field-control">
        <input
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        {error ? <Icon name="alert" size={15} /> : null}
      </span>

      {error ? (
        <small className="field-error" id={errorId}>
          <Icon name="alert" size={13} />
          {error}
        </small>
      ) : null}

      {hint ? (
        <small className="field-hint" id={hintId}>
          {hint}
        </small>
      ) : null}
    </label>
  );
}
