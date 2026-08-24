/**
 * The state of a thing, as a dot and a word — the workspace's pill.
 *
 * `StatusPill` says "one pill for the whole product", and that is still true:
 * this is not a second pill, it is the same vocabulary in the shape a table can
 * carry. The tones are `StatusPill`'s, unchanged and non-negotiable — `act`
 * amber, `wait`/`progress` blue, `done` green, `stop` crimson, `quiet` no
 * colour at all — because what a hue means is a fact about the product and not
 * a decision a screen or a persona gets to retake.
 *
 * Why the shape changes for staff, when the meaning does not: a filled pill is
 * a small block of colour, and a block of colour is a signal. One of them on a
 * student's card points at the one thing that matters. Forty of them down a
 * work queue point at nothing — the eye reads a column of tinted rectangles as
 * texture and stops seeing any of them. The Mobbin sweep of 2026-08-24 found
 * the newest operational tools have all moved off the pill for exactly this:
 * Deel's `● Pending your approval`, Remote's roster, Zoho's workqueue, where
 * status and priority are unstyled words and the only coloured thing in the
 * whole table is `Late by 3 days`.
 *
 * So the rule the workspace holds, and this component exists to make easy:
 * **colour is spent once per row, on lateness.** A dot carries the state
 * without spending any — it is 6px of hue against a word in ink, which reads at
 * a glance in one row and disappears politely in forty.
 *
 * A pill is still right where a count sits inside it, or where a state stands
 * alone on a card rather than in a column. Use `StatusPill` there.
 */
export default function StatusDot({ tone = 'quiet', className, children }) {
  return (
    <span className={['status-dot', tone, className].filter(Boolean).join(' ')}>
      <i className="status-dot-mark" aria-hidden="true" />
      {children}
    </span>
  );
}
