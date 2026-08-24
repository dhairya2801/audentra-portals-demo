import Icon from '../Icon.jsx';
import Spot from './Spot.jsx';

/**
 * What a section shows when it has nothing, cannot see, or broke.
 *
 * Four variants, and each one is a sentence about the world, not a decoration
 * of it: `empty` — there is nothing here yet, and this is what produces it;
 * `partial` — there is something, and we cannot see it just now; `error` — it
 * did not load, and this is what was not lost; `done` — there was something,
 * and it is finished. The mark is a `Spot` in the variant's tone, which is the
 * only illustration the product draws.
 *
 * `size="compact"` is the card inside a narrow column — the sidebar, when its
 * list did not load: left-aligned, a row's radius, a smaller spot, the same
 * crimson. `size="page"` is the same card standing in for a whole page — what
 * `PageError` renders under the band. Before the Jam of 2026-08-21 that was a
 * second component with a second shape, left-aligned and amber, against a
 * contract that says crimson is the colour of a panel that failed; Laura asked
 * for red and for the middle of the screen, and both were already the rule.
 */
const SPOT_ICON = { empty: 'file', partial: 'clock', error: 'alert', done: 'check' };
const SPOT_TONE = { empty: 'quiet', partial: 'working', error: 'error', done: 'done' };

export default function StateCard({
  variant = 'empty',
  icon,
  title,
  children,
  action,
  size,
  className,
}) {
  const classes = ['state-card', variant, size && `size-${size}`, className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} role={variant === 'error' ? 'alert' : undefined}>
      <Spot
        icon={icon ?? SPOT_ICON[variant]}
        tone={SPOT_TONE[variant] ?? 'quiet'}
        size={size === 'page' ? 104 : size === 'compact' ? 48 : 84}
      />
      <h3>{title}</h3>
      <p>{children}</p>
      {action && (
        <button className="secondary-button" onClick={action.onClick}>
          {action.icon && <Icon name={action.icon} size={16} />} {action.label}
        </button>
      )}
    </div>
  );
}
