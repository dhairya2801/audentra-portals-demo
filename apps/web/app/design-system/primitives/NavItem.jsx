import Icon from '../Icon.jsx';
import Avatar from './Avatar.jsx';

/**
 * The sidebar's parts — a row, a group of rows, the profile chip, and the list
 * asleep. They know nothing about where the portal goes: `Sidebar` (app/)
 * reads the destination model and hands each one a route, a glyph and a label.
 *
 * One row for every destination, top-level or inside a group. It is
 * `--control-height` tall — the shell's one control height, the same as the
 * topbar's — with the glyph at the left edge every other part of the column
 * shares, the label, and a count when something in that section is still open.
 * The glyph is regular on every row and `fill` on the one you are on: the one
 * weight a stateful control's *on* state takes (ADR 0004). The count is a flat
 * chip that inverts to paper on the tinted row. Before the pass of 2026-08-21
 * a top-level row was 46px and a row inside a group 40px, indented behind a
 * guide line — two sizes of one thing. The group's label above is the
 * hierarchy; its rows are rows.
 *
 * `countLabel` is what the count says to a screen reader — "6 steps still
 * open" — because the number alone is a number.
 */
export default function NavItem({
  href,
  icon,
  active = false,
  count,
  countLabel,
  onClick,
  className,
  children,
}) {
  const classes = ['nav-item', active && 'active', className].filter(Boolean).join(' ');
  return (
    <a
      className={classes}
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <span className="nav-icon" aria-hidden="true">
        <Icon name={icon} weight={active ? 'fill' : 'regular'} />
      </span>
      <span className="nav-label">{children}</span>
      {count > 0 ? (
        <span className="nav-count">
          <span aria-hidden="true">{count}</span>
          <span className="sr-only">{countLabel}</span>
        </span>
      ) : null}
    </a>
  );
}

/**
 * A group of rows under a caps label that opens and closes them. It renders
 * the `<li>` and the `<ul>`; its children are `<li>`s. `holdsActive` says the
 * page you are on is inside — when the group is closed, the label takes the
 * row's colour so a closed group never hides where the student is.
 */
export function NavGroup({ id, label, open, holdsActive = false, onToggle, children }) {
  const toggleId = `nav-group-${id}`;
  const listId = `nav-group-list-${id}`;
  const classes = ['nav-group-toggle', holdsActive && !open && 'holds-active']
    .filter(Boolean)
    .join(' ');
  return (
    <li className="nav-group">
      <button
        type="button"
        className={classes}
        id={toggleId}
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggle}
      >
        {label}
        <span className={`group-chevron${open ? ' open' : ''}`} aria-hidden="true">
          <Icon name="chevron" size={14} />
        </span>
      </button>
      <ul className="nav-sublist" id={listId} aria-labelledby={toggleId} hidden={!open}>
        {children}
      </ul>
    </li>
  );
}

/**
 * The student, as the way in to her profile: the `md` avatar — the same disc
 * size as the brand mark at the top of the column — her preferred name, her
 * standing, and a chevron pointing where the link goes. A row, with the row's
 * hover and the row's active tint.
 */
export function ProfileChip({ href, person, name, standing, active = false, onClick }) {
  return (
    <a
      className={`profile-chip${active ? ' active' : ''}`}
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <Avatar person={person} size="md" />
      <span className="profile-name">
        <strong>{name}</strong>
        <span>{standing}</span>
      </span>
      <span className="chip-chevron" aria-hidden="true">
        <Icon name="chevron" size={16} />
      </span>
    </a>
  );
}

/**
 * The list asleep, in the list's own anatomy — a glyph and a word per row, a
 * short eyebrow where a group's label will be — so loading → ready is a fade
 * and not a rearrangement.
 */
const SHAPE = ['row', 'row', 'row', 'row', 'row', 'label', 'row', 'row', 'row', 'label', 'row', 'row'];

export function NavSkeleton() {
  return (
    <div className="nav-skeleton" aria-hidden="true">
      {SHAPE.map((kind, index) =>
        kind === 'label' ? (
          <span key={index} className="skeleton-line label" />
        ) : (
          <span key={index} className="nav-skeleton-row">
            <span className="skeleton-line glyph" />
            <span className="skeleton-line word" />
          </span>
        ),
      )}
    </div>
  );
}
