import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import Icon from '../Icon.jsx';

/**
 * A choice from a short list — the product's own, not the browser's.
 *
 * ## Why this exists at all
 *
 * A native `<select>` can be styled down to its border and no further: the menu
 * it opens is drawn by the operating system, in the system font, with the
 * system's own highlight. On Windows that is a blue bar; on macOS it is a
 * translucent sheet; on neither is it Audentra. Every other control on the
 * screen — the search field, the chip, the button, the tab row — is this
 * product's drawing, so the one control that opens a menu was the one place a
 * staff member met a different product (Marco, 2026-08-25).
 *
 * The Mobbin sweep of 2026-08-25 asked whether a serious table's filters are
 * ever left native, and the answer is no, in seven products out of seven:
 * Retool, Databricks, Notion, Zoom, Neon, Clay, Hotjar and Hex all draw the
 * closed control *and* the open menu themselves. The shape they agree on is the
 * one below — a floating panel on the surface colour, a hairline, a soft
 * shadow, rows that tint on hover, and the chosen row marked rather than
 * filled. Nobody paints the full-bleed system bar, because a bar that wide says
 * "this row is the answer" when all it means is "your cursor is here".
 *
 * ## What it keeps from the native control
 *
 * Everything a keyboard does. The trigger is a `combobox` that owns a
 * `listbox`: `↓`/`↑` move, `Home`/`End` jump, `Enter` and `Space` choose, `Esc`
 * closes without choosing, and typing jumps to the next option starting with
 * what was typed — the type-ahead that makes a sixty-subject list usable and
 * the first thing a hand-rolled menu usually drops. Focus never leaves the
 * trigger; `aria-activedescendant` is what moves, which is the pattern that
 * survives a screen reader reading the list.
 *
 * ## Why the panel is `fixed` and not `absolute`
 *
 * Four of the fifteen selects this replaces live inside a drawer and two inside
 * a modal, and both of those clip and scroll their own content. A panel
 * positioned inside that box is cut off by it. So the panel is placed from the
 * trigger's own rectangle in viewport coordinates, flips above the trigger when
 * the room below is not enough, and closes on scroll rather than trailing
 * behind the control it belongs to.
 */
export default function Select({
  label,
  value,
  options = [],
  onChange,
  hint,
  className,
  ariaLabel,
  id,
}) {
  const generatedId = useId();
  const rootId = id ?? generatedId;
  const listId = `${rootId}-list`;
  const labelId = `${rootId}-label`;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const typed = useRef({ text: '', at: 0 });

  const index = options.findIndex((option) => String(option.value) === String(value));
  const chosen = index >= 0 ? options[index] : null;

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    setRect({ top: box.bottom, bottom: box.top, left: box.left, width: box.width });
  }, []);

  /* Placed before paint, so the panel never renders at 0,0 for a frame. */
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    /* A panel is anchored to a rectangle, and a rectangle that moves under it is
       a panel pointing at nothing. Scrolling closes rather than re-places: the
       control has left the place the answer was about. */
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  /* Keep the active row in view when the keyboard is what is moving. */
  useEffect(() => {
    if (!open || active < 0) return;
    const row = listRef.current?.children?.[active];
    row?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function openWith(start) {
    setActive(start);
    setOpen(true);
  }

  function choose(i) {
    const option = options[i];
    if (!option) return;
    onChange?.(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function move(delta) {
    if (!options.length) return;
    const from = active >= 0 ? active : index >= 0 ? index : -1;
    const next = Math.min(options.length - 1, Math.max(0, from + delta));
    setActive(next);
  }

  /* Type-ahead. The buffer resets after a second of quiet, so `ma` finds
     Mathematics and a later `m` starts again rather than looking for `mam`. */
  function seek(char) {
    const now = Date.now();
    const text = now - typed.current.at > 1000 ? char : typed.current.text + char;
    typed.current = { text, at: now };
    const from = (active >= 0 ? active : index) + 1;
    const order = [...options.slice(from), ...options.slice(0, Math.max(0, from))];
    const hit = order.find((option) => option.label.toLowerCase().startsWith(text));
    if (!hit) return;
    setActive(options.indexOf(hit));
  }

  function onKeyDown(event) {
    const { key } = event;
    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        event.preventDefault();
        openWith(index >= 0 ? index : 0);
      } else if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        /* Typing on a closed control moves the value the way a native select
           does, without opening anything. */
        event.preventDefault();
        openWith(index >= 0 ? index : 0);
        seek(key.toLowerCase());
      }
      return;
    }
    if (key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (key === 'End') {
      event.preventDefault();
      setActive(options.length - 1);
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      choose(active >= 0 ? active : index);
    } else if (key === 'Tab') {
      setOpen(false);
    } else if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      seek(key.toLowerCase());
    }
  }

  /* Below the trigger, unless the room below cannot hold the panel and the room
     above can — the flip a menu near the foot of a drawer needs. */
  const below = rect ? window.innerHeight - rect.top : 0;
  const flip = rect ? below < 220 && rect.bottom > below : false;
  const style = rect
    ? flip
      ? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.bottom }
      : { left: rect.left, width: rect.width, top: rect.top }
    : undefined;

  return (
    <div className={['select-field', className].filter(Boolean).join(' ')}>
      {label ? (
        <span className="field-label" id={labelId}>
          {label}
        </span>
      ) : null}

      <button
        type="button"
        className={['select-control', open && 'open'].filter(Boolean).join(' ')}
        ref={triggerRef}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${rootId}-o${active}` : undefined}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : ariaLabel}
        onKeyDown={onKeyDown}
        onClick={() => (open ? setOpen(false) : openWith(index >= 0 ? index : 0))}
      >
        <span className="select-value">{chosen ? chosen.label : ''}</span>
        <Icon name="chevron" size={14} className="select-chevron" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="select-scrim"
            aria-label={`Close ${label ?? ariaLabel ?? 'menu'}`}
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
          />
          <ul
            className={['select-panel', flip && 'flip'].filter(Boolean).join(' ')}
            id={listId}
            role="listbox"
            ref={listRef}
            style={style}
            aria-labelledby={label ? labelId : undefined}
          >
            {options.map((option, i) => (
              <li
                key={option.value}
                id={`${rootId}-o${i}`}
                role="option"
                aria-selected={i === index}
                className={[i === index && 'chosen', i === active && 'active']
                  .filter(Boolean)
                  .join(' ')}
                /* The row responds where it highlights: the whole row carries
                   the tint, so the whole row takes the pointer. `mousedown`
                   rather than `click`, so the choice lands before the scrim
                   under it can take the press. */
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(i);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="select-option-label">{option.label}</span>
                {i === index ? <Icon name="check" size={13} className="select-tick" /> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {hint ? <small className="field-hint">{hint}</small> : null}
    </div>
  );
}
