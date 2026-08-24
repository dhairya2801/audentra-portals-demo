/**
 * One overlay behaviour, shared — ENR-181.
 *
 * Before this file the portal had four different answers to the same question.
 * `AcademicDrawer` and `CampusDrawer` each carried their own `FOCUSABLE`
 * constant and their own tab trap, subtly different from one another;
 * `TaskDrawer` and `InfoModal` had no trap at all and leaned on a global `Esc`
 * listener in `App.jsx` that closed every overlay at once — so `Esc` on a modal
 * opened from inside a drawer closed the drawer too.
 *
 * What an overlay gets here:
 *
 *   - focus moves into it on mount and back to whatever opened it on unmount;
 *   - `Esc` closes it, and stops there, so a stack unwinds one layer at a time;
 *   - `Tab` is trapped when it is modal, and free when it is not.
 *
 * `modal: false` is a real case, not a shortcut: the Edward window on a desktop
 * is a non-modal dialog, because the student has to keep using the page they
 * are asking about (ENR-175). Non-modal means no trap — trapping the keyboard
 * inside a panel the page is still live behind is the wrong contract.
 *
 * There is no body scroll lock here, deliberately. This repo has never had one,
 * the mobile sheets use `overscroll-behavior: contain` instead, and ENR-175
 * Scenario 5 asks for the page's scroll position to be left exactly alone.
 */

import { useEffect, useRef, useState } from 'react';

export const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function visibleTargets(node) {
  if (!node) return [];
  return [...node.querySelectorAll(FOCUSABLE)].filter(
    (element) => !element.hidden && element.getClientRects().length > 0,
  );
}

/**
 * @param panel  ref to the dialog element
 * @param onClose        what `Esc` and the scrim do
 * @param modal          traps `Tab` inside the panel. Default true.
 * @param suspended      something sits on top of this overlay: it owns `Esc`
 *                       and the trap until it closes. Focus return is not run,
 *                       so suspending never steals focus out of the thing above.
 * @param autoFocus      move focus in on mount. Default true.
 * @param returnFocus    hand focus back on unmount. Default true. Edward turns
 *                       it off: its opener is the pill, which is not in the DOM
 *                       while the window is open, so it does the hand-back
 *                       itself once the pill is back.
 */
export function useOverlay(
  panel,
  { onClose, modal = true, suspended = false, autoFocus = true, returnFocus = true },
) {
  const opener = useRef(null);

  // Mount only. Kept apart from the key handler so that suspending for a modal
  // above does not run this cleanup and pull focus back out of it.
  useEffect(() => {
    opener.current = document.activeElement;
    if (autoFocus) {
      const node = panel.current;
      (visibleTargets(node)[0] ?? node)?.focus?.();
    }
    const returnTo = returnFocus ? opener.current : null;
    return () => returnTo?.focus?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (suspended) return undefined;

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (!modal || event.key !== 'Tab') return;
      const targets = visibleTargets(panel.current);
      if (targets.length === 0) return;

      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    // Capture, so the overlay reads `Esc` before anything listening on `window`.
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [modal, onClose, panel, suspended]);
}

/**
 * Below this width an overlay that covers the page is modal, because the page
 * behind it is not usable anyway. Matches the sheet breakpoint in `app.css`.
 */
export function useMedia(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs with an external media query (vendored)
    setMatches(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** The sheet breakpoint in `app.css`. Below it, a covering overlay is modal. */
export const SHEET_QUERY = '(max-width: 620px)';

/** The width at which the fuller form can hold two panes side by side. */
export const TWO_PANE_QUERY = '(min-width: 821px)';

/**
 * The width at which the page is genuinely two grids — a main column and the
 * narrower rail beside it. Below it `.page-rail` stops being a column and
 * reflows underneath the main one, so anything that has to stay above the
 * content it qualifies must be rendered somewhere else. Matches the
 * `@media (width<=1060px)` rule `.page-body` uses in `app.css`.
 */
export const RAIL_QUERY = '(min-width: 1061px)';

export function useIsSheet() {
  return useMedia(SHEET_QUERY);
}
