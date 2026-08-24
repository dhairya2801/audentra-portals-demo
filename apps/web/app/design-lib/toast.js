/**
 * One feedback queue, shared — the feedback system.
 *
 * Before this file the portal had 58 places that said "something happened" and
 * one `useState` holding a single string to say it in. A second message
 * overwrote the first, unread. Every message wore a green tick whether or not
 * it was a success. Every message lived exactly 3600ms, whether it was two
 * words or two sentences, and nothing could pause it or dismiss it.
 *
 * The rule this file exists to make cheap:
 *
 *   > A toast may never be the only place something is said.
 *
 * A toast confirms what you just watched happen, and offers the way back while
 * it is still cheap. Anything a student may need *after* it has vanished — an
 * error, an obligation, a state change she did not watch — has a permanent home
 * somewhere else, and the toast is a pointer to it. That is why `critical` is
 * not simply "a red toast": it is a different contract, and the one tone that
 * does not disappear on its own.
 *
 * `onToast` stays the prop name every section already threads, and a bare
 * string still works — it means `info`, which is the honest default. The green
 * tick is now something a caller has to ask for, so it stops appearing over
 * sentences that are not good news.
 */

import { useCallback, useRef, useState } from 'react';

/** Three tones, and the contract each one carries. */
const TONES = {
  success: { glyph: 'check', role: 'status' },
  info: { glyph: 'info', role: 'status' },
  critical: { glyph: 'alert', role: 'alert' },
};

/** Never fewer than four seconds; never more than ten; reading time between. */
const FLOOR_MS = 4000;
const CEILING_MS = 10000;
const PER_WORD_MS = 350;

/**
 * How long a message stays. Not a constant — a constant is how "Sent to the
 * Registrar's Office. You can close this page — the check keeps going." and
 * "Removed." came to be given the same 3.6 seconds.
 *
 * `critical` returns `null`, which means *no timer at all*. It stays until the
 * student dismisses it, because a failure she did not see is a failure she will
 * meet again later, somewhere worse.
 */
export function durationFor({ tone, title, body }) {
  if (tone === 'critical') return null;
  const words = `${title} ${body ?? ''}`.trim().split(/\s+/).length;
  return Math.min(CEILING_MS, Math.max(FLOOR_MS, words * PER_WORD_MS));
}

export function toneOf(tone) {
  return TONES[tone] ?? TONES.info;
}

/**
 * A string, or a shape. The string form is not a shortcut kept for old callers
 * — it is the correct call for the many places that only have one sentence to
 * say, and it lands on `info` rather than on a tick it did not earn.
 */
function normalise(input) {
  const toast = typeof input === 'string' ? { title: input } : { ...input };
  return {
    tone: TONES[toast.tone] ? toast.tone : 'info',
    title: toast.title,
    body: toast.body ?? null,
    action: toast.action ?? null,
  };
}

/**
 * At most three on screen. The fourth pushes the oldest out — which is still a
 * loss, but a visible one, and three is already more than anybody reads.
 */
const MAX_ON_SCREEN = 3;

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const sequence = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((input) => {
    if (!input) return;
    const toast = normalise(input);
    if (!toast.title) return;
    sequence.current += 1;
    const id = sequence.current;
    setToasts((current) => [...current, { ...toast, id }].slice(-MAX_ON_SCREEN));
  }, []);

  return { toasts, push, dismiss };
}
