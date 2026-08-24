import Icon from '../Icon.jsx';

/**
 * A card, and the three zones it is allowed to have.
 *
 * The rules these components hold were already written in
 * `docs/agents/design-workflow.md`, and were already being broken, because a
 * rule in a document is a rule every author has to carry:
 *
 *   - every block of a page's main column is a card; nothing sits loose on the
 *     canvas;
 *   - a card has a head, content and a foot, and they are *visible* — the head
 *     and the foot are the card's own paper one shade down, run out to its
 *     edges and closed with a hairline;
 *   - a list inside a card is `.card-rows`: the rows give up their surface and
 *     live on the card's white, and they run out to the card's own edges so the
 *     first and last take the corner they touch;
 *   - a row must never hard-code the card's padding or radius — the card
 *     publishes `--card-pad` and `--card-radius` for exactly that.
 *
 * A square row meeting a rounded card is the tell that someone built a
 * component without looking at the one holding it (Jam, 2026-08-20). It is not
 * possible to make that mistake through `Card` + `CardRows`, because neither
 * one asks the author for a radius.
 */
export default function Card({ as: Tag = 'section', variant, className, children, ...rest }) {
  const classes = ['section-card', variant, className].filter(Boolean).join(' ');
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * The band a card opens with — **one anatomy for every card in the product**
 * (Marco, 2026-08-21: "padronize os headers"): a bare outline glyph, the name,
 * one line under it, and a trailing cell for a count, a control or the handle.
 * `kind` only decides the glyph's colour:
 *
 *   status   the glyph takes a `tone` — the card carries a state.
 *   card     the glyph is neutral purple — one block among several.
 *   section  kept for its call sites; renders the same head, with `eyebrow`
 *            as the line under the name. It used to be a different shape.
 *
 * `tone` is the status mark's variant, and it is the one place a card head is
 * allowed colour — which is the rule "spend colour once per card" made into an
 * argument rather than a reminder.
 *
 * ## A head's mark is a glyph, not a tile — Marco, 2026-08-21
 *
 * The head used to draw its icon in a tinted tile, which is exactly the shape
 * the content under it draws — a task's kind, an organisation, a document — so
 * a card opened with the same form it then repeated on every row. One shape
 * for heads across the whole product, one for content: the head's mark is a
 * **bare outline glyph** (regular weight, 20px) in the tone's colour, before
 * the name; a tinted tile with a duotone glyph belongs to content and never to
 * a head. `.status-icon` and `.card-icon` are that glyph's box, everywhere.
 *
 * ## A status head can be the group's handle — Jam of 2026-08-21
 *
 * Laura asked for *Aster is reviewing* and *Coming up later* to collapse the
 * way *steps completed* did, and the honest finding was that *completed* was
 * a one-off green box with its own toggle while the other two were cards
 * with a static head: three groups of the same kind, two shapes, one of them
 * clickable. So the status head is the one disclosure shape the product has:
 * give it `onToggle` and it renders as a `<button aria-expanded>` with the
 * `count` before the chevron, and the card closes on the head. Give it no
 * `onToggle` and it is the static head it always was — which is also what an
 * empty group gets, because a button that opens nothing is a lie.
 *
 * Every group starts closed (Marco, 2026-08-21); what the student opens is
 * remembered by the page.
 *
 * ## The mark is on the head or on the rows, never both
 *
 * A status head takes an icon tile when the rows under it carry none — the
 * tile is then the card's one mark. When the rows carry their own tile (a task's
 * kind, a step's standing), the head goes **bare**: no tile, no empty column,
 * the name at the card's padding. A clock on the head and a clock on every row
 * is the same glyph said twice, and the rows no longer line up with the rows
 * of the card beside them (Marco, 2026-08-21).
 */
export function CardHead({
  kind = 'card',
  icon,
  iconSize,
  tone,
  eyebrow,
  title,
  titleId,
  note,
  aside,
  count,
  open,
  onToggle,
  controls,
}) {
  // `section` used to be a different shape — an eyebrow above the name and no
  // glyph. Marco, 2026-08-21: one head for the whole product. It keeps its name
  // for the call sites; what it renders is the standard head, with the eyebrow
  // copy as the line under the name and a glyph when one is given.
  const isStatus = kind === 'status' || kind === 'section';
  const line = note ?? eyebrow;
  const collapsible = isStatus && typeof onToggle === 'function';
  const bare = isStatus && !icon;

  const tile = icon ? (
    <span
      className={isStatus ? ['status-icon', tone].filter(Boolean).join(' ') : 'card-icon'}
      aria-hidden="true"
    >
      <Icon name={icon} size={iconSize ?? 20} />
    </span>
  ) : null;

  const copy = (
    <div>
      <h2 id={titleId}>{title}</h2>
      {line ? <p>{line}</p> : null}
    </div>
  );

  const trailing =
    count != null || collapsible ? (
      <span className="status-trailing">
        {count != null ? <span className="status-count">{count}</span> : null}
        {collapsible ? (
          <span className={`status-chevron${open ? ' open' : ''}`} aria-hidden="true">
            <Icon name="chevron" size={18} />
          </span>
        ) : null}
      </span>
    ) : (
      aside
    );

  if (collapsible) {
    return (
      <button
        type="button"
        className={`status-heading collapsible${bare ? ' bare' : ''}${open ? ' open' : ''}`}
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={controls}
        onClick={onToggle}
      >
        {tile}
        {copy}
        {trailing}
      </button>
    );
  }

  return (
    <div className={isStatus ? `status-heading${bare ? ' bare' : ''}` : 'card-heading'}>
      {tile}
      {copy}
      {trailing}
    </div>
  );
}

/**
 * A list inside a card. The rows live on the card's own white — no surface, no
 * border, no shadow, no radius of their own — and this is the element that
 * bleeds them out to the card's edges so the hairlines span it.
 */
export function CardRows({ as: Tag = 'div', className, children, ...rest }) {
  return (
    <Tag className={['card-rows', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * The other end of the head: a note or a control that *closes* a card. Same
 * band, same bleed, same hairline. Anything that merely sits at the bottom of a
 * card is content and does not belong here — a foot is for what qualifies the
 * card as a whole.
 */
export function CardFoot({ className, children, ...rest }) {
  return (
    <div className={['card-foot', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}
