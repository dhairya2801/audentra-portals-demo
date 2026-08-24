import Icon from '../Icon.jsx';

/**
 * Who can see this — the workspace's one guardrail, as a component.
 *
 * The hardest rule on a staff screen is not a layout rule:
 *
 *   **What reaches the student and what is internal must never look like the
 *   same surface.**
 *
 * A staff member who is unsure whether the thing they are typing goes to Maya
 * or stays in the file will eventually guess wrong, and the cost of guessing
 * wrong is not a visual defect — it is a student reading a colleague's note
 * about her. So the distinction is carried by four signals at once, and this is
 * the fourth and the most explicit of them: a plain sentence, under the thing it
 * is about, that **names the person who cannot see it.**
 *
 * The four, from the Mobbin sweep of 2026-08-24 (Plain has all of them; the
 * wording is Workable's, which is the best found):
 *
 *   1. the surface is tinted — internal is not the same paper as outbound;
 *   2. the mode is chosen at the composer and has a keyboard shortcut;
 *   3. a header states what you did, in the past tense, once it is done;
 *   4. this line, naming the audience — and it persists into the log, so a note
 *      read three weeks later still says who could see it.
 *
 * `to` is a name, never a role: *Not visible to Maya* stops a reader in a way
 * that *Internal only* does not, because the second is a category and the first
 * is a person. When the audience is positive, say it positively — *Visible to
 * the Financial Aid Office* — and use both lines together where a surface can
 * be mistaken for the other one.
 *
 * The tint is deliberately neutral ink and not amber. Yellow-for-internal is
 * the market's convention and it collides with ours: amber already means
 * *someone still has to act*, and a note nobody has to act on must not wear it.
 */
export default function Visibility({ hidden = false, to, audience, className }) {
  return (
    <p className={['visibility', hidden ? 'hidden' : 'shown', className].filter(Boolean).join(' ')}>
      <Icon name={hidden ? 'hidden' : 'users'} size={13} />
      {hidden ? <>Not visible to {to}</> : <>Visible to {audience}</>}
    </p>
  );
}
