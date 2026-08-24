import Icon from '../Icon.jsx';

/**
 * Where the work arrives — the staff workspace's spine.
 *
 * Everything the student portal produces lands here: a submission waiting on a
 * reviewer's decision, a step that went past its date, a callback request, a
 * question sent to an office. The portal has been a mouth throwing work at a
 * room that did not exist; this is the room.
 *
 * ## Three rules, and all three are about restraint
 *
 * **1. A row is not a card.** Full bleed, a hairline under it, a tint on hover,
 * and no radius, no border, no shadow of its own. The Mobbin sweep of
 * 2026-08-24 found the boundary drawn on a single Deel screen: boxed count
 * tiles across the top, ruled rows underneath. Forty cards is not forty times
 * as clear as one card — it is a stack of boxes with the work hidden inside
 * them. B's 15px rounded row is the piece of the student's language that does
 * not survive the move.
 *
 * **2. Colour is spent once, on lateness.** Zoho's workqueue is the cleanest
 * example in the corpus: status and priority are plain unstyled words, and the
 * single coloured thing in the entire table is `Late by 3 days`. Everything
 * else on the row — the state, the owner, the type — is ink. `StatusDot` and
 * `Deadline` are built to that rule; a row that adds a third colour has broken
 * it.
 *
 * **3. Priority is carried by grouping, not by a chip.** A `HIGH` badge on
 * every third row is a column of noise that never resolves into an order. A
 * group heading resolves it once, at the top, and the rows underneath inherit
 * their urgency from where they are. The default grouping is the clock —
 * *Overdue · Today · This week · Later* — because that is the question a staff
 * member actually opens the queue with.
 *
 * ## The mark on a row is a glyph, never a tile
 *
 * A 40px duotone tile is the product's shape for a piece of *content* — a
 * club's emblem, a document type, a residence. In a queue it is furniture: it
 * doubles the row's height, it is the same six shapes over and over, and it
 * pushes the words that differ off to the right. The row's mark is a small
 * monochrome glyph, or an `Avatar` when the subject of the row is a person.
 * The tile keeps its job on summary tiles and card heads (ADR 0004).
 *
 * ## Columns
 *
 * `columns` is data, not design: it names the heads and sets the grid template
 * in one place so a head and its cells cannot drift apart. The first column is
 * always the subject — the mark, the title, and one optional line under it —
 * and `cells` on a row fills the rest, in order.
 *
 * The head row is `aria-hidden`. Its labels are there for the eye scanning a
 * column; a screen reader gets the row's own content in the same order, and
 * hearing "Due" before a date it is about to hear anyway is noise, not help.
 * Where a cell is not self-describing, the caller gives the row an `aria-label`.
 */
export function Queue({ columns = [], subject = 'Task', label, children, className }) {
  /* The subject gets a floor as well as the leftover. `minmax(0, 1fr)` alone
     lets the fixed columns eat it down to nothing on a narrow work column, and
     a table whose first cell is fourteen pixels wide has forgotten what it is a
     table of. Below the floor the queue scrolls inside its own frame rather
     than dropping a column: which column a person needs is not a decision a
     stylesheet can take for them. */
  const template = ['minmax(260px, 1fr)', ...columns.map((c) => c.width || 'auto')].join(' ');

  return (
    <section
      className={['queue', className].filter(Boolean).join(' ')}
      style={{ '--queue-columns': template }}
      aria-label={label}
    >
      {columns.length ? (
        <div className="queue-head" aria-hidden="true">
          <span className="queue-column">{subject}</span>
          {columns.map((c) => (
            <span
              key={c.key}
              className={['queue-column', c.align === 'end' ? 'end' : null]
                .filter(Boolean)
                .join(' ')}
            >
              {c.label}
            </span>
          ))}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * One band of the queue, and the only place urgency is stated.
 *
 * `tone` is `StatusDot`'s vocabulary, and it is on the heading rather than on
 * the rows: *Overdue* is crimson once, and the four rows under it stay in ink.
 * `count` sits beside the label because a group whose size you cannot see is a
 * group you have to scroll to measure.
 */
export function QueueGroup({ label, count, tone = 'quiet', children }) {
  return (
    <div className="queue-group" role="group" aria-label={label}>
      <h3 className={['queue-group-head', tone].filter(Boolean).join(' ')}>
        <span className="queue-group-label">{label}</span>
        {typeof count === 'number' ? <span className="queue-group-count">{count}</span> : null}
      </h3>
      <ul className="queue-rows">{children}</ul>
    </div>
  );
}

/**
 * One thing one person does about one student.
 *
 * The whole row is the control, because the whole row is one destination —
 * a target the width of the table is the difference between a queue you work
 * and a queue you aim at. `active` is the row currently open in the overlay,
 * and it stays marked while the overlay is over it so that closing lands the
 * eye back where it was.
 *
 * `rowId` puts that id in the DOM. It is what lets a page move focus to the row
 * a person was actually looking at when the overlay closes — which is not always
 * the row they opened, because the overlay lets them step between records
 * without going back to the list.
 */
export function QueueRow({
  rowId,
  mark,
  avatar,
  title,
  note,
  cells = [],
  onOpen,
  active = false,
  label,
}) {
  return (
    <li className="queue-row-item">
      <button
        type="button"
        className={['queue-row', active ? 'active' : null].filter(Boolean).join(' ')}
        onClick={onOpen}
        data-row-id={rowId}
        aria-label={label}
        aria-current={active ? 'true' : undefined}
      >
        <span className="queue-subject">
          {avatar || (mark ? <Icon name={mark} size={16} className="queue-mark" /> : null)}
          <span className="queue-subject-copy">
            <span className="queue-title">{title}</span>
            {note ? <span className="queue-note">{note}</span> : null}
          </span>
        </span>
        {cells.map((cell, i) => {
          /* A cell is a node, or `{ content, align }` when the column is a
             column of numbers — money, counts and dates are right-aligned so a
             reader compares them down the column instead of across the row.
             A React element is an object too, and never carries `content`. */
          const spec = cell && typeof cell === 'object' && 'content' in cell;
          return (
            <span
              key={i}
              className={['queue-cell', spec && cell.align === 'end' ? 'end' : null]
                .filter(Boolean)
                .join(' ')}
            >
              {spec ? cell.content : cell}
            </span>
          );
        })}
      </button>
    </li>
  );
}

export default Queue;
