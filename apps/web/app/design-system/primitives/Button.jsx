import { useCallback } from 'react';
import Icon from '../Icon.jsx';
import { useTip } from './Tooltip.jsx';

/**
 * The product's four buttons, and the rule for picking one.
 *
 *   primary     the one thing this card is asking for. At most one per card.
 *   secondary   a real action that is not the one being asked for.
 *   text        an action that reads as a sentence — "Remove", "Undo".
 *   link        a route dressed as a link, when the target is a page.
 *
 * `full` makes it span its container, which is what a drawer's action does and
 * a card's rarely should.
 *
 * The trailing icon is a prop rather than a child because it is the same in
 * every instance — an arrow when the button leaves the page, a verb's own icon
 * when it does not — and because a caller that passes it as a child is a caller
 * who can put it on the wrong side.
 *
 * `pending` is the first rung of the feedback ladder, and the reason the other
 * two get smaller. Before it, every asynchronous action in this product spoke
 * only *after* it finished — which is why so much of what it had to say ended
 * up in a toast: a control that cannot say "working" has to be followed by
 * something that says "done".
 *
 * It holds the button's exact footprint. The label is not removed and not
 * replaced; the button goes `color: transparent` and the spinner is laid over
 * it, so nothing measures anything and no card reflows. It sets `aria-busy`
 * and `disabled` together, which closes the double-submit hole every one of
 * these call sites had, and the styling deliberately does **not** let the
 * disabled state fade it: a control that greys out while it works reads as a
 * control that refused.
 */
export default function Button({
  kind = 'secondary',
  icon,
  iconSize,
  leadingIcon,
  full = false,
  pending = false,
  disabled = false,
  className,
  children,
  ...rest
}) {
  const classes = [`${kind}-button`, full && 'full', pending && 'pending', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      {...rest}
    >
      {leadingIcon ? <Icon name={leadingIcon} size={iconSize ?? 16} /> : null}
      {children}
      {icon ? <Icon name={icon} size={iconSize ?? 17} /> : null}
      {pending ? (
        <span className="button-spinner">
          <Icon name="spinner" size={iconSize ?? 17} />
        </span>
      ) : null}
    </button>
  );
}

/**
 * A control whose whole label is its icon — a close, a collapse, a menu. It
 * takes `label` rather than `aria-label` so it is not possible to render one
 * without a name: a bare icon button with no label is unusable with a screen
 * reader, and this is the repo's one recurring accessibility slip.
 *
 * That name is also the button's tooltip, by default and without being asked
 * for. A label only a screen reader can hear is half a label — fourteen icon
 * buttons in this product were written as raw `<button className="icon-button">`
 * and every one of them was silent to everybody else. Showing it is not an
 * author's decision to remember, so it is not an author's decision to forget:
 * pass `tip={null}` to suppress it, or a shorter string to say it in fewer
 * words. It may never say something the label does not — that would be an
 * `InfoTip`, because hover reaches neither a phone nor a keyboard.
 */
export function IconButton({
  name,
  label,
  tip = label,
  placement = 'bottom',
  size,
  variant,
  className,
  ref,
  ...rest
}) {
  const { anchorProps, bubble } = useTip(tip, placement);
  const { ref: tipRef, ...tipProps } = anchorProps;

  // The tip needs the button's box, and callers need their own ref — the
  // topbar's menu button holds one so the nav can hand focus back to it.
  const setRef = useCallback(
    (node) => {
      tipRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref, tipRef],
  );

  return (
    <button
      className={['icon-button', variant, className].filter(Boolean).join(' ')}
      aria-label={label}
      {...rest}
      {...tipProps}
      ref={setRef}
    >
      <Icon name={name} size={size} />
      {bubble}
    </button>
  );
}
