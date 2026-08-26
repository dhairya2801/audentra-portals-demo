import { useId } from 'react';

/**
 * A list of choices with no card around any of them — 2026-08-24.
 *
 * The audit that produced this: radio options wrapped in bordered cards with
 * padding and a highlight state, a checklist of seven becoming seven cards, and
 * screens that scrolled for no reason. The cost is not decoration, it is
 * comparison — **the descriptions are the thing being compared, and the borders
 * are what stop you comparing them.** Options pushed apart by a border and a
 * generous padding are options read one at a time.
 *
 * So: the control, the label, and where it earns it a secondary line at caption
 * size underneath. No fill, no container, no chosen-state tint. What marks the
 * chosen one is the control itself, which is what a radio is for.
 *
 * **And no rule between the rows either** — ENR-216, after the review of
 * 2026-08-24. The first build kept a hairline, on the reasoning that a border
 * around each option is the problem and a line between them is not. It is the
 * same problem one degree quieter: a line pushes the options apart, and options
 * pushed apart are options read one at a time, which is the exact thing the
 * descriptions exist to prevent. Spacing alone.
 *
 * `multiple` makes them checkboxes and `value` an array. Same shape either way,
 * because a student comparing seven things she may share does not want a
 * different visual language from a student comparing four places to live.
 *
 * `disabledIds` keeps an unavailable option **in the list, greyed, with its
 * reason inline** rather than removing it. An option that vanishes is an option
 * she cannot ask about.
 */
export default function ChoiceList({
  name,
  options,
  value,
  onChange,
  multiple = false,
  disabledIds = [],
  labelledBy,
  className,
}) {
  const id = useId();
  const group = name ?? id;
  const chosen = multiple ? (value ?? []) : value;

  function toggle(optionId) {
    if (!multiple) return onChange(optionId);
    const set = new Set(chosen);
    if (set.has(optionId)) set.delete(optionId);
    else set.add(optionId);
    return onChange([...set]);
  }

  return (
    <div
      className={['choice-list', className].filter(Boolean).join(' ')}
      role={multiple ? 'group' : 'radiogroup'}
      aria-labelledby={labelledBy}
    >
      {options.map(([optionId, label, line]) => {
        const off = disabledIds.includes(optionId);
        const on = multiple ? chosen.includes(optionId) : chosen === optionId;
        return (
          <label key={optionId} className={off ? 'choice off' : 'choice'}>
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={group}
              value={optionId}
              checked={on}
              disabled={off}
              onChange={() => toggle(optionId)}
            />
            <span className="choice-text">
              <span className="choice-label">{label}</span>
              {line ? <small className="choice-line">{line}</small> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
