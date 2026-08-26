import { useRef } from 'react';
import { IconButton } from '../primitives/Button.jsx';
import { useOverlay } from '../../design-lib/overlay.js';

/**
 * The centre-screen overlay's frame, and nothing else — ENR onboarding
 * redesign, 2026-08-24.
 *
 * The scrim, the panel, the close control, the trapped focus, the `Esc`. Three
 * things sit on it and differ only in the foot: `InfoModal` explains a rule and
 * has no foot; an outcome announces something and has one action; a decision
 * asks, and its foot carries the answers. Before this, the only centred overlay
 * in the repo was `InfoModal`, and the two new uses would each have hand-typed
 * this shell — which is the eight-drawers audit of 2026-08-20 starting again.
 *
 * **There is no `confirmClose` prop, and that is the decision.** The brief's
 * rule 3.5 is that nothing partially filled is ever lost and that closing a
 * modal never discards, so there is no "are you sure" on the way out of any of
 * them. Made a property of the frame because behaviour remembered on four
 * screens is forgotten on the fifth: `onClose` keeps the work, and the screen
 * behind says a draft is waiting.
 *
 * `className` names the panel, so a caller that already has painted CSS keeps
 * it — `InfoModal` passes `info-modal` and renders exactly the DOM it rendered
 * before this file existed. New callers take the default.
 *
 * `foot` is rendered outside the scrolling body: a decision's actions stay
 * reachable while its content scrolls, which is what makes a two-step modal
 * possible without one tall panel scrolling through everything. What goes in it
 * is the caller's, the way a `Drawer`'s foot is — the frame places it and never
 * learns what a particular decision's answers are called.
 */
export default function Modal({
  className = 'modal-panel',
  labelledBy,
  onClose,
  foot,
  children,
}) {
  const panel = useRef(null);
  useOverlay(panel, { onClose });

  return (
    <div
      className="center-modal-wrap"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <button className="modal-scrim" aria-label="Close" onClick={onClose} />
      <div className={className} ref={panel}>
        <IconButton className="modal-close" name="close" label="Close" onClick={onClose} />
        {foot ? <div className="modal-body">{children}</div> : children}
        {foot ? <div className="modal-foot">{foot}</div> : null}
      </div>
    </div>
  );
}
