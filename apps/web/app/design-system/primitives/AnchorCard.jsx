/**
 * The card that opens a rail.
 *
 * Every section's rail leads with the same thing: the section's key secondary
 * figure, on ink. The design workflow has said so in words since the page-shell
 * pass — and eight rails still each wrote it out by hand, each inventing a
 * modifier class of its own (`reply-card`, `waiting-card`, `access-card`,
 * `stage-card`, `deadline-card`, `counts-card`, `availability-card`,
 * `interests-card`) for markup that was identical underneath.
 *
 * The modifier is still available, because some of those classes carry real
 * layout for what follows the figure. What is no longer up to the author is the
 * order — label, then figure, then whatever qualifies it — which is the part
 * that kept coming out differently.
 *
 *   <AnchorCard variant="reply" label="Usual reply" figure={TYPICAL_REPLY}>
 *     <p>…</p>
 *   </AnchorCard>
 *
 * `figure` takes a node, not just a string, because two rails put a `<small>`
 * inside the figure to qualify it in place — see `ProfileRail`. Everything
 * else belongs under it, in `children`.
 *
 * `label` is optional for the one anchor that leads with something other than a
 * label — My Campus Life opens its rail with the points tile — and `figure` is
 * optional for the one that leads with a sequence rather than a number, the
 * housing stage tracker. Neither is a licence to skip them: an anchor without a
 * figure had better be showing something that answers the same question.
 */
export default function AnchorCard({ variant, label, figure, figureClass, children }) {
  return (
    <div className={variant ? `anchor-card ${variant}-card` : 'anchor-card'}>
      {label === undefined ? null : <span className="panel-label">{label}</span>}
      {figure === undefined ? null : <strong className={figureClass}>{figure}</strong>}
      {children}
    </div>
  );
}
