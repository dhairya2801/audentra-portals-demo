import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import Icon from '../Icon.jsx';

/**
 * The product's two tooltips, and the one bubble they share.
 *
 * The portal had two of these and no system. `TermTip` was a real tooltip —
 * hover, focus, tap, `role="tooltip"`, `aria-describedby` — available to
 * exactly one section, because it lived in a feature folder. The other was
 * `.advisor-action::after { content: attr(data-tip) }`: no keyboard, no touch,
 * and the reason `.summary-alert` had to take the panel's bottom corners, since
 * a bubble drawn as a child of a control cannot leave the box that clips it.
 *
 * Two shapes, because there are two questions:
 *
 *   Tooltip   "what is this control?" — the hint. One to three words. It may
 *             only ever repeat the control's own accessible name, so a student
 *             who cannot hover has lost nothing.
 *   InfoTip   "what does this word mean?" — the explainer. Its own info button
 *             inline with the word, a title and a sentence, opening on tap and
 *             on the keyboard as well, because it carries something that is
 *             printed nowhere else.
 *
 * That line is the whole standard. The moment a hint carries information the
 * student has no other way to reach, it is an explainer — hover does not exist
 * on a phone and does not exist on a keyboard.
 *
 * Both draw the same `.tip-bubble`, into `document.body`, positioned against
 * the window rather than against a parent. Three things follow, and all three
 * are the point: a tooltip cannot be clipped by a card, a drawer or a rail; a
 * tooltip is never underneath the thing it points at (`--z-tooltip` sits above
 * every layer but the toast, because you are pointing at whatever is on top);
 * and `Esc` reaches the tooltip before it reaches the drawer the tooltip is
 * inside, because this listens on `window` in capture and `useOverlay` listens
 * on `document`.
 */

/* One tooltip at a time, and a short warm window after one closes so that
   running along a row of icon buttons does not stutter through three delays. */
let closeOpen = null;
let warmUntil = 0;
const WARM = 400;

function claim(close) {
  if (closeOpen && closeOpen !== close) closeOpen();
  closeOpen = close;
}

function release(close) {
  if (closeOpen === close) closeOpen = null;
  warmUntil = Date.now() + WARM;
}

/* The three measurements and the delay are decided in `tokens.css`; this reads
   them off the cascade rather than re-typing them, which is the same rule the
   breakpoints in `lib/overlay.js` follow. */
const read = {};
function metric(name, fallback) {
  if (read[name] === undefined) {
    const value = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(name),
    );
    read[name] = Number.isFinite(value) ? value : fallback;
  }
  return read[name];
}

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

/* How close the arrow may come to the bubble's own corner. */
const ARROW_INSET = 13;

/**
 * Where the bubble goes: on the preferred side if it fits, flipped if it does
 * not, and pulled in from the window's edge when the control is near one. The
 * arrow is then placed against the control's centre rather than the bubble's,
 * so a bubble that had to be pulled in still points at what it belongs to.
 */
function place(trigger, bubble, preferred) {
  const gap = metric('--tip-gap', 8);
  const edge = metric('--tip-edge', 12);
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;

  const roomBelow = vh - edge - (trigger.bottom + gap) >= bubble.height;
  const roomAbove = trigger.top - gap - edge >= bubble.height;
  const side =
    preferred === 'top'
      ? roomAbove || !roomBelow
        ? 'top'
        : 'bottom'
      : roomBelow || !roomAbove
        ? 'bottom'
        : 'top';

  const top = side === 'bottom' ? trigger.bottom + gap : trigger.top - gap - bubble.height;
  const centre = trigger.left + trigger.width / 2;
  const left = clamp(centre - bubble.width / 2, edge, Math.max(edge, vw - edge - bubble.width));
  const arrow = clamp(centre - left, ARROW_INSET, Math.max(ARROW_INSET, bubble.width - ARROW_INSET));

  return { side, top, left, arrow };
}

function TipBubble({
  anchor,
  placement,
  variant,
  id,
  role,
  hidden,
  onPointerEnter,
  onPointerLeave,
  children,
}) {
  const bubble = useRef(null);
  const [at, setAt] = useState(null);

  useLayoutEffect(() => {
    function update() {
      if (!anchor.current || !bubble.current) return;
      setAt(
        place(
          anchor.current.getBoundingClientRect(),
          bubble.current.getBoundingClientRect(),
          placement,
        ),
      );
    }
    update();
    // Capture, so a scroll inside a drawer or a rail moves the bubble too.
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchor, placement]);

  return createPortal(
    <span
      ref={bubble}
      id={id}
      role={role}
      aria-hidden={hidden || undefined}
      className={`tip-bubble ${variant}`}
      data-side={at?.side ?? placement}
      data-placed={at ? '' : undefined}
      style={{
        top: `${at?.top ?? 0}px`,
        left: `${at?.left ?? 0}px`,
        '--tip-arrow': `${at?.arrow ?? 0}px`,
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      // A portal still bubbles its events through the React tree, so without
      // this a click inside an explainer would reach the row the explainer
      // happens to sit in.
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </span>,
    document.body,
  );
}

/**
 * The hint's behaviour without its markup — for a control that would rather put
 * the handlers on itself than be wrapped in one more element. `IconButton` uses
 * this, which is why every icon-only button in the product now names itself
 * without its author having to remember to.
 */
export function useTip(tip, placement = 'bottom') {
  const anchor = useRef(null);
  const timer = useRef(0);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
    // eslint-disable-next-line react-hooks/immutability -- self-reference through a stable callback (vendored)
    release(close);
  }, []);

  const show = useCallback(() => {
    claim(close);
    setOpen(true);
  }, [close]);

  useEffect(() => close, [close]);

  useEffect(() => {
    if (!open) return undefined;
    // `Esc` dismisses the hint but does not stop there: a hint is not a layer,
    // so whatever else `Esc` was going to do still happens.
    function onKeyDown(event) {
      if (event.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, close]);

  const anchorProps = {
    ref: anchor,
    onPointerEnter: (event) => {
      // Touch has no hover, and a tap is about to do the thing anyway.
      if ((event.pointerType || 'mouse') !== 'mouse') return;
      window.clearTimeout(timer.current);
      const wait = Date.now() < warmUntil ? 0 : metric('--delay-tip', 0.3) * 1000;
      if (wait <= 0) show();
      else timer.current = window.setTimeout(show, wait);
    },
    onPointerLeave: close,
    onPointerDown: close,
    onFocus: (event) => {
      // Only the keyboard. Clicking a button must not leave its own label
      // hanging over the page afterwards.
      if (event.target.matches?.(':focus-visible')) show();
    },
    onBlur: close,
  };

  return {
    anchorProps,
    bubble:
      open && tip ? (
        <TipBubble anchor={anchor} placement={placement} variant="hint" hidden>
          {tip}
        </TipBubble>
      ) : null,
  };
}

/**
 * The child's own handlers first, then the tip's. A trigger that already
 * listens for a pointer keeps listening.
 */
function merge(own, added, ref) {
  const next = {};
  for (const [key, fn] of Object.entries(added)) {
    const mine = own[key];
    next[key] = mine
      ? (event) => {
          mine(event);
          fn(event);
        }
      : fn;
  }
  next.ref = own.ref
    ? (node) => {
        ref.current = node;
        if (typeof own.ref === 'function') own.ref(node);
        else if (own.ref) own.ref.current = node;
      }
    : ref;
  return next;
}

/**
 * The hint, around a control that is not an `IconButton` — the advisor's two
 * discs, the composer's send, a chip's dismiss. Each of those carries its own
 * class and its own size, so this puts the handlers **on the control itself**
 * rather than wrapping it: a wrapper is an extra box in somebody's flex row,
 * and this repo has spent enough on layout that moved because a component
 * needed somewhere to hang a bubble.
 *
 * The child must therefore be a single element that passes unknown props on to
 * a DOM node — every primitive here does.
 *
 * `tip` must already be the trigger's accessible name. If what you want to say
 * is said nowhere else, it is an `InfoTip`.
 */
export default function Tooltip({ tip, placement = 'bottom', children }) {
  const { anchorProps, bubble } = useTip(tip, placement);
  if (!tip || !isValidElement(children)) return children;
  const { ref, ...handlers } = anchorProps;
  return (
    <>
      {cloneElement(children, merge(children.props, handlers, ref))}
      {bubble}
    </>
  );
}

/**
 * The explainer: a word the student is not expected to know, with the sentence
 * that says what it means, opened from its own info button.
 *
 * It is a button rather than a hover target because it carries something that
 * is printed nowhere else, so it has to be reachable by tap and by keyboard.
 * A tap pins it open; only a tap outside or `Esc` closes it, and `Esc` stops
 * there, so an explainer inside a drawer does not take the drawer with it.
 */
export function InfoTip({ title, label, placement = 'bottom', size = 14, className, children }) {
  const id = useId();
  const anchor = useRef(null);
  const pointer = useRef('mouse');
  const grace = useRef(0);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;

  const close = useCallback(() => {
    window.clearTimeout(grace.current);
    setHovered(false);
    setPinned(false);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    claim(close);
    return () => release(close);
  }, [open, close]);

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key !== 'Escape') return;
      // Pinned, this is a layer of its own and unwinds one at a time. Merely
      // hovered, it is not, and `Esc` belongs to whatever is underneath.
      if (pinned) event.stopPropagation();
      close();
    }

    function onPointerDown(event) {
      if (!pinned) return;
      if (anchor.current?.contains(event.target)) return;
      if (event.target.closest?.('.tip-bubble')) return;
      close();
    }

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open, pinned, close]);

  useEffect(() => () => window.clearTimeout(grace.current), []);

  // Crossing the gap between the button and the bubble must not close it: the
  // bubble is in a portal, so the pointer genuinely leaves the button on the way.
  const enter = () => {
    window.clearTimeout(grace.current);
    setHovered(true);
  };
  const leave = () => {
    window.clearTimeout(grace.current);
    grace.current = window.setTimeout(() => setHovered(false), 140);
  };

  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={['info-tip', className].filter(Boolean).join(' ')}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        aria-label={label ?? `What ${title} means`}
        onPointerDown={(event) => {
          pointer.current = event.pointerType || 'mouse';
        }}
        onPointerEnter={(event) => {
          if ((event.pointerType || 'mouse') === 'mouse') enter();
        }}
        onPointerLeave={(event) => {
          if ((event.pointerType || 'mouse') === 'mouse') leave();
        }}
        onFocus={(event) => {
          if (event.target.matches?.(':focus-visible')) setPinned(true);
        }}
        onBlur={() => setPinned(false)}
        onClick={(event) => {
          event.preventDefault();
          // On a mouse the bubble is already up, so the click must not toggle
          // it shut. A tap and the keyboard both pin.
          if (pointer.current !== 'mouse') setPinned((was) => !was);
        }}
      >
        <Icon name="info" size={size} />
      </button>

      {open && (
        <TipBubble
          anchor={anchor}
          placement={placement}
          variant="info"
          id={id}
          role="tooltip"
          onPointerEnter={enter}
          onPointerLeave={leave}
        >
          {title ? <strong>{title}</strong> : null}
          {children}
        </TipBubble>
      )}
    </>
  );
}
