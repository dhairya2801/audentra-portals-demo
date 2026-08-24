import { useRef } from 'react';
import { IconButton } from './Button.jsx';
import { useOverlay } from '../../design-lib/overlay.js';

/**
 * The side panel every section opens.
 *
 * Before this file there were seven drawers and seven copies of the same
 * twenty lines — the scrim, the `<aside>` with its three ARIA attributes, the
 * header with its two label spans, the close button, the content wrapper. Not
 * seven similar drawers: seven hand-typed copies, which is why `TaskDrawer` and
 * `ResidenceDrawer` were identical for their first twenty lines and differed on
 * the twenty-first for no reason anyone had decided.
 *
 * That is the shape of every construction bug this repo has had. A rule written
 * in a document — "an overlay traps focus, `Esc` closes it, the scrim closes
 * it" — is a rule seven authors have to remember. A rule written in a component
 * is a rule they cannot get wrong, because they are never asked.
 *
 * So this owns the frame and nothing else:
 *
 *   the scrim, and what it says to a screen reader
 *   the dialog element and its ARIA wiring
 *   the header: the two facts on the left, the close on the right
 *   the content wrapper, and a `foot` below it that does not scroll with it
 *
 * What goes *inside* is the section's own — the icon, the heading, the tabs,
 * the actions, the foot note. `.drawer-actions` and `.drawer-foot` are content,
 * not slots: they sit inside `children` where the section puts them, because
 * where a drawer's actions belong is a decision about that drawer.
 *
 * `foot` is the one exception, and it earns it by being outside the scroll:
 * `BookingDrawer` keeps the chosen time and the confirm button pinned below the
 * picker while the picker scrolls. A control that merely comes last belongs in
 * `children`; only something that must stay visible belongs here.
 *
 * `useOverlay` supplies the focus move, the return, the trap and the `Esc`,
 * and `suspended` hands all of it to something that opens on top — see
 * `src/lib/overlay.js`.
 */
export default function Drawer({
  variant,
  label,
  titleId,
  closeLabel = 'Close',
  onClose,
  suspended = false,
  foot,
  children,
}) {
  const panel = useRef(null);
  useOverlay(panel, { onClose, suspended });

  const [lead, trail] = Array.isArray(label) ? label : [label, null];

  return (
    <>
      <button className="modal-scrim" aria-label={closeLabel} onClick={onClose} />
      <aside
        className={variant ? `drawer ${variant}-drawer` : 'drawer'}
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="drawer-header">
          <div className="drawer-label">
            {lead ? <span>{lead}</span> : null}
            {trail ? <span>{trail}</span> : null}
          </div>
          <IconButton name="close" label={closeLabel} tip="Close" onClick={onClose} />
        </div>

        <div className="drawer-content">{children}</div>
        {foot}
      </aside>
    </>
  );
}
