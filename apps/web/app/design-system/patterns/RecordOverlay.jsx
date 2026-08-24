import { useRef } from 'react';
import Icon from '../Icon.jsx';
import { useOverlay } from '../../design-lib/overlay.js';

/**
 * A record, opened over the list it came from.
 *
 * The stakeholder asked for this directly at the check-in of 2026-08-21 — *"the
 * action screen should function as a pop-up rather than a full web page"*,
 * because closing it should put you back on the board — and the Mobbin sweep of
 * 2026-08-24 says the instinct is right. Jira ships the same issue as a
 * centered modal *and* as a docked sidebar, with the switch as a menu item;
 * Attio opens a record full-bleed with `× ← → 1 of 1` in its top bar.
 *
 * ## The collision that was not one
 *
 * His two principles looked like they wanted the same real estate: *"clean,
 * focused views per step in the workflow"* and *"right panel shows essential
 * context at all times"*. In fourteen searches no product keeps a context panel
 * about one subject while a different record opens elsewhere — the right column
 * always belongs to whatever is in charge of the screen. So:
 *
 *   **The context travels with the subject.**
 *
 * Queue open, the shell's right column is the queue's own standing. A record
 * open, this overlay is a small workspace carrying **its own** two columns —
 * the record, and the student it is about. Both principles are then literally
 * true, and closing still returns you to the list. What is refused is the third
 * reading: a context panel surviving outside the overlay while a scrim dims it.
 * Nobody ships that, and it would be a panel about a subject you are no longer
 * looking at.
 *
 * ## Four obligations, and they are why this is a component and not a modal
 *
 * A pop-up that only exists on top of the board cannot be sent to a colleague,
 * and sending a case to a colleague is the thing a workspace does most.
 *
 *   1. `Esc` returns to the queue — `useOverlay`, so a stack unwinds one layer
 *      at a time and this does not close a drawer opened from inside it.
 *   2. `position` steps between records without going back to the list, and
 *      says `n of m` so the person knows the size of what they are working.
 *   3. `onCopyLink` — the record has an address. The caller owns the URL,
 *      because the route is the app's business and the frame is this file's.
 *   4. `foot` is pinned and outside the scroll, which is where the outcome
 *      lives: how a task ended is not a paragraph you find by scrolling.
 */
/**
 * The frame, which exists only while the record is open.
 *
 * It is a component of its own and not an `if` inside the one below, because
 * `useOverlay`'s focus move is a mount effect — it runs once, when the thing
 * holding it appears. Called from a component that renders `null` while closed,
 * it would run on that first empty render, find no panel to move focus into,
 * and never run again: `Esc` and the focus return would work and the focus move
 * would silently not, which is the half of the contract a mouse never notices
 * and a keyboard notices immediately.
 */
function RecordOverlayFrame({
  onClose,
  kicker,
  title,
  status,
  position,
  onCopyLink,
  context,
  foot,
  children,
  labelledBy = 'record-overlay-title',
}) {
  const panel = useRef(null);
  useOverlay(panel, { onClose });

  return (
    <div className="ro-scrim" onMouseDown={onClose}>
      <div
        className="record-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        ref={panel}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="ro-bar">
          <button type="button" className="ro-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>

          {position ? (
            <div className="ro-steps">
              <button
                type="button"
                onClick={position.onPrev}
                disabled={!position.onPrev}
                aria-label="Previous"
              >
                <Icon name="back" size={15} />
              </button>
              <button
                type="button"
                onClick={position.onNext}
                disabled={!position.onNext}
                aria-label="Next"
              >
                <Icon name="arrow" size={15} />
              </button>
              <span className="ro-count">
                {position.index} of {position.total}
              </span>
            </div>
          ) : null}

          <div className="ro-bar-end">
            {onCopyLink ? (
              <button type="button" className="ro-link" onClick={onCopyLink}>
                <Icon name="copy" size={14} /> Copy link
              </button>
            ) : null}
          </div>
        </header>

        <div className="ro-body">
          <div className="ro-main">
            <div className="ro-title">
              {kicker ? <p className="ro-kicker">{kicker}</p> : null}
              <div className="ro-title-row">
                <h2 id={labelledBy}>{title}</h2>
                {status}
              </div>
            </div>
            {children}
          </div>

          {context ? <aside className="ro-context">{context}</aside> : null}
        </div>

        {/* A `div` and not a `footer`, deliberately. `patterns.css` gives the
            bare `footer` element the page shell's own rules — 36px of margin,
            76px of `--safe-bottom` padding for the corner Edward owns, and the
            8.5px footer voice — because every product page ends in one. Inside
            a dialog that is wrong on all three counts, and `footer` is not a
            landmark here anyway (it only is as a child of `body`), so the
            element buys nothing to pay for. */}
        {foot ? <div className="ro-foot">{foot}</div> : null}
      </div>
    </div>
  );
}

/**
 * The gate. Everything the caller passes is forwarded; the only thing this
 * layer decides is whether the frame exists at all, so that opening the record
 * is a mount and closing it is an unmount.
 */
export default function RecordOverlay({ open, ...props }) {
  if (!open) return null;
  return <RecordOverlayFrame {...props} />;
}
