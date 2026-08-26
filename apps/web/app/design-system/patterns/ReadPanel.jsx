import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon.jsx';

/**
 * A document to get to the end of, and an honest account of how far that got.
 *
 * **It reports `scrolled`, never `read`** — the glossary entry of the same name
 * settles the word. Scrolling is not reading, the market says "read" almost
 * without exception, and this product does not, so the word is written down in
 * two places to keep somebody from correcting it back.
 *
 * The panel owns the measurement and nothing else. It calls `onEnd` once, the
 * first time the bottom is reached, and the caller decides what that unlocks —
 * because on step 9 it is two panels unlocking one signature, and a component
 * that owned the lock could only ever know about itself.
 *
 * A control that is locked by this must say so beside itself. That is the
 * caller's line to write, and there is no prop here that would let it be
 * skipped: a disabled control with no reason next to it is the one thing this
 * page is not allowed to ship.
 */
export default function ReadPanel({ title, onEnd, children }) {
  const region = useRef(null);
  const [progress, setProgress] = useState(0);
  // Reaching the end is one-way. Scrolling back up does not un-reach it: the
  // control below has already unlocked, and a figure that walked backwards
  // while the button stayed open would be the panel disagreeing with itself.
  const [reached, setReached] = useState(false);
  const ended = useRef(false);

  useEffect(() => {
    const node = region.current;
    if (!node) return undefined;

    function measure() {
      // Nothing is decided about a box that has not been laid out. The observer
      // fires once with the element still at zero height, and at zero height a
      // long document is indistinguishable from a short one — both report no
      // room to scroll. Reading that as "already at the end" is what unlocked a
      // signature before the release had been drawn.
      if (node.clientHeight === 0) return;

      const room = node.scrollHeight - node.clientHeight;
      // A document genuinely short enough not to scroll is already at its end.
      // Saying 0% of a thing with nothing below the fold would lock a control
      // that has nothing left to show.
      const share = room <= 1 ? 1 : Math.min(1, node.scrollTop / room);
      setProgress(share);
      if (share >= 0.995 && !ended.current) {
        ended.current = true;
        setReached(true);
        onEnd?.();
      }
    }

    // **Not on mount.** A first measure before the browser has laid the content
    // out reads `scrollHeight === clientHeight`, which is indistinguishable from
    // a document short enough to have no end to reach — so the panel would
    // announce that a five-paragraph release had been scrolled to the end before
    // it was drawn, and unlock a signature. The observer fires after layout and
    // again whenever the box or its content changes size, which also covers a
    // font loading late and a narrow viewport reflowing.
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);

    node.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      node.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [onEnd]);

  const done = reached || progress >= 0.995;
  const percent = done ? 100 : Math.round(progress * 100);

  return (
    <section className={done ? 'read-panel done' : 'read-panel'}>
      <header className="read-panel-head">
        <h3>{title}</h3>
        <span className="read-panel-figure" aria-live="polite">
          {done ? (
            <>
              <Icon name="check" size={14} /> Scrolled to the end
            </>
          ) : (
            `${percent}% scrolled`
          )}
        </span>
      </header>

      <div className="read-panel-body" ref={region} tabIndex={0}>
        {children}
      </div>

      <div className="read-panel-meter" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
    </section>
  );
}
