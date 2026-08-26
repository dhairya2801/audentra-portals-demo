import Card from '../primitives/Card.jsx';

/**
 * A group of fields, or a group of choices, on the page's own block surface,
 * with a plain label above it and no status head — 2026-08-24, ENR-216.
 *
 * ## Why this exists
 *
 * The build review of 2026-08-24 found the same shape on six screens: a card
 * whose head was a tinted bar with an icon, a title and a subtitle, wrapped
 * around four text fields. Its verdict is that this is chrome, not structure,
 * and on the offer flow it was a large part of why six screens scrolled.
 *
 * The first build of this component took the whole card away and left the group
 * on the page background. That was wrong, and Marco caught it: `Card` has said
 * since it was written that **every block of a page's main column is a card and
 * nothing sits loose on the canvas**, so a column with two bare groups and one
 * carded block in it is two constructions on one screen.
 *
 * The reference corpus is unanimous the same way, and it is more specific than
 * either reading. [Ghost](https://mobbin.com/screens/7b05eba2-b4e2-4b09-b235-fe91f096186e),
 * [Flodesk](https://mobbin.com/screens/3dddae17-3fbf-4bb7-92cb-dceadd1000ec),
 * [Cofounder](https://mobbin.com/screens/955070c9-c245-4ddb-b150-2d78f4df1876),
 * [Neon](https://mobbin.com/screens/a666b19d-adc8-4f3b-aa03-5495bbba6b78) and
 * [Navattic](https://mobbin.com/screens/9a8cf272-67e8-4782-8792-f2711dcb09d9) all
 * put each group of fields on **its own white card over a tinted page**, and not
 * one of them gives that card a tinted bar or an icon. The head is a plain title
 * on the card's own paper, or there is no head and the field labels carry it.
 *
 * So: **the card stays and the bar goes.** That is what the review is actually
 * asking for, and it is the only reading that leaves one construction on the
 * page.
 *
 * ## The rule
 *
 * > A block whose content has a state of its own keeps its `CardHead`. A block
 * > that is a question takes a plain label, or none.
 *
 * `CardHead` reports a state — submitted, in review, accepted, changes
 * requested — and the head, with its tone and its mark, is where that state is
 * read. The address proof on step 3 has one; so does anything holding an upload
 * whose standing an office decides. A question has no such state. *Where should
 * Aster write first* is not submitted or accepted; it is answered or it is not,
 * and the control already says which.
 *
 * That is why the review never complains about the document blocks and complains
 * about every field block. Both were drawn with the same head, and only one of
 * them had anything to put in it.
 *
 * ## `plain`, for a group that is already on a surface
 *
 * Inside a `Modal` or a `Drawer` the panel **is** the block, and a card in there
 * is a surface on a surface. `plain` drops the card and keeps the label, the
 * body and the footnote. It is a prop rather than a `.modal-panel .field-group`
 * override, because a rule that changes a component by where it happens to be
 * rendered is a rule the next author cannot see from the call site.
 *
 * ## The label is a label
 *
 * Not a heading, and it does not compete with the page title, which on every one
 * of these screens is already asking the question. It takes no subtitle either:
 * `Your answer` under `All four are complete answers` is the shape this flow is
 * coming out of, and a slot for a second line is an invitation to put one back.
 *
 * It does outrank the field labels under it, in the same caps vocabulary and at
 * the same size, one decisive step of ink. Without the tinted bar something has
 * to say which label owns which, and a second type size is not the answer.
 *
 * `labelId` is here so the group's control can point at it —
 * `<ChoiceList labelledBy>` needs a real id, and generating one inside would
 * mean the label and the thing it labels each own half of the relationship.
 *
 * `aside` is the label row's trailing cell, for a count of the group beneath it.
 * ENR-219 moves `n of 7 chosen` out of a modal foot and onto that row, because
 * it counts the group and belongs beside it.
 *
 * `footnote` is the plain line that closes a group and qualifies it — that
 * anything with a deadline is also written in the portal, that an emergency
 * contact can be called and cannot see anything. No box and no fill, and it is
 * part of this component so that it stops being re-typed as a `Notice` with a
 * tint, which is how it looked before.
 */
export default function FieldGroup({
  label,
  labelId,
  aside,
  footnote,
  plain = false,
  className,
  children,
  ...rest
}) {
  const inner = (
    <>
      {label ? (
        <div className="field-group-head">
          <p className="field-label field-group-label" id={labelId}>
            {label}
          </p>
          {aside ? <span className="field-group-aside">{aside}</span> : null}
        </div>
      ) : null}

      <div className="field-group-body">{children}</div>

      {footnote ? <p className="field-foot field-group-foot">{footnote}</p> : null}
    </>
  );

  const classes = ['field-group', plain ? 'plain' : null, className].filter(Boolean).join(' ');

  if (plain) {
    return (
      <div className={classes} {...rest}>
        {inner}
      </div>
    );
  }

  return (
    <Card className={classes} {...rest}>
      {inner}
    </Card>
  );
}
