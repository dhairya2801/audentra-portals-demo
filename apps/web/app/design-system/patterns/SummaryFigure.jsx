import { InfoTip } from '../primitives/Tooltip.jsx';

/**
 * The left half of the summary panel: the section's one figure.
 *
 * ## Which sections get a panel at all — Jam of 2026-08-21
 *
 * Four, then five: My Enrollment, My Documents, My Classrooms, My Financials —
 * and Health again since the evening of 2026-08-21, when the page became two
 * things (a record and a question) and the panel stopped being the one card
 * read twice. A section qualifies when **both** cells are true of it — a figure that is the section's
 * standing, and a person who owns the subject — and five of the nine that had
 * one failed that test:
 *
 *   Appointments   `Fri 12 Sep · 10:00` is the first row of the list below it,
 *                  and the person beside it is the person in that row.
 *   My Housing     the figure was the plan, which is the first card below it.
 *   Health         the figure, the label and the line were the heading, the
 *                  state chip and the gate chip of the one card on the page.
 *   My Profile     `12 of 20 details are yours` is a legend, not a standing —
 *                  nothing in it moves and nothing in it is pending.
 *   Help           its right cell may not name a person at all (ENR-177 AC 3),
 *                  so it ran a button there and was the odd one out by
 *                  construction.
 *
 * A panel summarises a page of things. Where the page *is* the one thing, the
 * panel is that thing read twice, and it costs the top of every screen.
 *
 * ## The cell
 *
 * Five sections used to fill this slot, and every one of them had built its own
 * cell.
 * Four class names (`.progress-summary`, `.balance-summary`,
 * `.next-appointment`, `.profile-standing`), two different internal structures,
 * and one of them, `.balance-panel .balance-summary`, addressed a class that
 * exists in no JSX file at all, so the balance cell had been running with no
 * layout rules and no `min-width: 0` since it was written. The panel came out
 * 123px tall on three sections, 137 on one and 139 on another.
 *
 * This is the shape, once:
 *
 *   [ mark ]  LABEL
 *             The figure
 *             one line under it
 *
 * The mark is what differs between sections — a progress ring, an avatar, or
 * nothing — not the arrangement. Anything that qualifies the figure rather than
 * stating it goes to the foot of the panel, in `PageShell`'s `notice` slot, and
 * never becomes a fourth line here: that is what made My Classrooms taller than
 * every other section and pushed its advisor off-centre.
 *
 * The three lines are fixed, so the four panels come out the same height by
 * construction rather than by luck: the label is one line, the figure is
 * centred in a line the height of the *money* figure whatever size it is, and
 * the line under it reserves two lines and is drawn even when the section
 * passes nothing into it. Before that they measured 119, 119, 119 and 129.
 *
 * `explain` is the one thing that may sit *in* the label: the rule behind the
 * count. "2 of 11 requirements met" is a number a student can read and cannot
 * check — what makes a requirement met, and what is deliberately not counted
 * yet, is the question the figure provokes and the panel has no line for. It
 * takes a sentence, or `{ title, body }` when the term is not the label, and it
 * is an `InfoTip` rather than a hint because none of that is said anywhere
 * else. Sections whose line under the figure already answers it pass nothing:
 * an explainer on every label is an explainer that means nothing.
 */
export default function SummaryFigure({ mark, label, explain, figure, money, children }) {
  return (
    <div className={`summary-figure ${money ? 'money' : ''} ${mark ? '' : 'bare'}`}>
      {mark}
      <div className="summary-figure-copy">
        <span className="panel-label">
          {label}
          {explain ? (
            <InfoTip title={explain.title ?? label}>{explain.body ?? explain}</InfoTip>
          ) : null}
        </span>
        <strong>{figure}</strong>
        {/* A section with nothing to say here says nothing, and the line is not
            drawn. Padding it to a fixed number of lines is how the panel ended
            up with a blank line under every short sentence. */}
        {children ? <p>{children}</p> : null}
      </div>
    </div>
  );
}
