import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import Button, { IconButton } from '../primitives/Button.jsx';
import { durationFor, toneOf } from '../../design-lib/toast.js';

/**
 * The middle rung of the feedback ladder.
 *
 *   in place   the control that caused it says what happened — `Button pending`,
 *              `Field error`, the row that changed under your hand
 *   toast      something happened, and you were not looking at the place it
 *              happened. This file.
 *   blocking   you cannot continue without deciding — `InfoModal`, `PageError`
 *
 * What this owns, and what the twenty hand-written `setToast(string)` callers
 * never had:
 *
 *   - three tones, and `critical` is not merely a red one: it takes
 *     `role="alert"` and it does not disappear on its own;
 *   - a duration derived from the sentence rather than a constant, paused while
 *     the pointer or the keyboard is on it — without the pause, a toast with an
 *     action is an action you have to catch;
 *   - at most one action, because a second action is a decision and a decision
 *     is a modal;
 *   - a stack of three, so the second message stops deleting the first.
 *
 * The timer is JavaScript and not a CSS animation, deliberately. This repo has
 * twice had a rule change what it did by being moved between files; a timer
 * that lives in the stylesheet is a dismissal that a media query can cancel.
 * The bar across the top is only the picture of the timer, never the timer.
 */
function Toast({ toast, onDismiss }) {
  const { id, tone, title, body, action } = toast;
  const { glyph, role } = toneOf(tone);
  const duration = durationFor(toast);

  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration);
  const startedAt = useRef(0);

  useEffect(() => {
    if (duration == null || paused) return undefined;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onDismiss(id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [duration, id, onDismiss, paused]);

  return (
    <div
      className={['toast', tone, action && 'has-action'].filter(Boolean).join(' ')}
      role={role}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* The picture of the timer, and only where there is a deadline to show:
          a toast with no action has no window the student can miss. */}
      {action && duration != null ? (
        <i
          className="toast-life"
          style={{ animationDuration: `${duration}ms`, animationPlayState: paused ? 'paused' : 'running' }}
        />
      ) : null}

      <span className="toast-glyph">
        <Icon name={glyph} size={17} />
      </span>

      <div className="toast-copy">
        <strong>{title}</strong>
        {body ? <span>{body}</span> : null}
      </div>

      {action ? (
        <Button
          kind="text"
          className="toast-action"
          onClick={() => {
            action.onAct();
            onDismiss(id);
          }}
        >
          {action.label}
        </Button>
      ) : null}

      {/* `compact` is the icon button with no surface of its own — the one
          variant that belongs on ink. Given the toast's own paper it would draw
          a white disc louder than the action beside it. */}
      <IconButton
        className="toast-close"
        variant="compact"
        name="close"
        label="Dismiss"
        tip={null}
        size={15}
        onClick={() => onDismiss(id)}
      />
    </div>
  );
}

/**
 * Bottom-centre, newest nearest the edge, older ones pushed up. The stack must
 * clear the Edward launcher and the mobile sheet: both are anchored to the same
 * corner of the screen, and a confirmation that covers the assistant is a
 * confirmation that costs the student the thing she was about to ask.
 */
export default function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
