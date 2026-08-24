import { useEffect, useRef, useState } from 'react';
import Card from '../primitives/Card.jsx';
import Tooltip from '../primitives/Tooltip.jsx';

/**
 * A card that floats: the anchored panel a control opens.
 *
 * It was `app/TopbarPopover.jsx` — one component for the bell and the points
 * chip, so the two could not drift apart on `Esc`, on focus return and on the
 * scrim — and it did that job. What it did not do was say what the *panel* is.
 * Its shell (`.pop-panel`, `.pop-head`, `.pop-foot`, `.pop-state`) was a
 * second set of rules, typed by hand in `housing.css`, on no styleguide, and
 * what went inside was whatever each feature drew from memory. That is why both
 * panels read as a component from somewhere else (Marco, 2026-08-21): they were
 * their own component.
 *
 * So the panel is a `Card`. It carries `section-card`, publishes `--card-pad`
 * and `--card-radius`, and what a feature puts inside it is the card's own three
 * zones — `CardHead`, `CardRows`, `CardFoot` — or the rail's `AnchorCard` taking
 * the top corners, drawn by the rules every block of every page already uses.
 * The popover adds only what floating needs: the position, the layer, the
 * shadow, the scroll, and the sticky head.
 *
 * Not built on `lib/overlay.js`. That primitive is for a dialog that covers the
 * page and traps the keyboard; this is an anchored menu that dismisses on an
 * outside click, exactly like `PreviewStateMenu` two chips along, and it uses
 * the same `--z-popover-scrim` / `--z-popover` pair so the three things that
 * corner can open can never appear on top of one another.
 *
 * `align` is which edge of the trigger the panel hangs from: `end` (the
 * default — the topbar's controls sit at the window's right edge) or `start`.
 */
export default function Popover({
  className,
  ariaLabel,
  panelLabel,
  panelClass,
  align = 'end',
  badge,
  children,
  onOpen,
  trigger,
  tip,
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  return (
    <div className="popover">
      {/* The hint stands down while the panel is open: the panel has already
          answered the question the hint was going to answer. */}
      <Tooltip tip={open ? null : tip}>
        <button
          className={className}
          ref={triggerRef}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={ariaLabel}
          onClick={() => {
            if (!open) onOpen?.();
            setOpen((value) => !value);
          }}
        >
          {trigger}
          {badge}
        </button>
      </Tooltip>

      {open && (
        <>
          <button className="pop-scrim" aria-label={`Close ${panelLabel}`} onClick={close} />
          <Card
            as="div"
            className={['pop-panel', align === 'start' && 'align-start', panelClass]
              .filter(Boolean)
              .join(' ')}
            role="dialog"
            aria-label={panelLabel}
          >
            {/* eslint-disable-next-line react-hooks/refs -- the render prop receives a stable closer (vendored) */}
            {children(close)}
          </Card>
        </>
      )}
    </div>
  );
}
