/**
 * A person, as a disc.
 *
 * Six classes used to do this — `.avatar`, `.mobile-avatar`, `.advisor-avatar`,
 * `.tiny-avatar`, `.grant-avatar` and Edward's borrowed `.advisor-avatar` — at
 * 32, 33, 34, 38 and 40 pixels, every one of them a purple disc with initials
 * in it, and not one of them able to show a face. The Jam of 2026-08-21 asked
 * for a photo on the "MJ" in the rail, and the honest answer was that nothing
 * in the product had a place to put one.
 *
 * So this is the one disc. It shows `person.photo` when there is one and the
 * initials when there is not, at five sizes, and it is the *only* way a person
 * is drawn. Who gets a photo is a rule, not a per-screen choice
 * (`docs/agents/design-workflow.md`, People):
 *
 *   - a **person** Aster knows — the student, an advisor, a club contact —
 *     is a face when the record has one and initials when it does not;
 *   - a **thing** — an office, a residence, an organisation, a destination on
 *     another site — is never a face. It is a glyph in a tile, or a monogram;
 *   - Edward is neither: an assistant with a mark, so it cannot be mistaken
 *     for someone at Aster.
 *
 * The photo is decorative when the name is printed beside it, which is nearly
 * always; pass `alone` when it is not, and the name becomes the alt text.
 */
/** `xl` is the one place a photograph of the student leads a page: the Profile hero (C1.1). */
const SIZES = { xs: 24, sm: 32, md: 40, lg: 56, xl: 96 };

export default function Avatar({ person, size = 'md', alone = false, className }) {
  const px = SIZES[size] ?? SIZES.md;
  const classes = ['avatar', `avatar-${size}`, className].filter(Boolean).join(' ');
  const photo = person?.photo;
  const name = person?.name ?? '';

  if (photo) {
    return (
      <img
        className={classes}
        src={photo}
        width={px}
        height={px}
        alt={alone ? name : ''}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <span
      className={classes}
      role={alone ? 'img' : undefined}
      aria-label={alone ? name : undefined}
      aria-hidden={alone ? undefined : 'true'}
    >
      {person?.initials ?? initialsOf(name)}
    </span>
  );
}

/** "Tomás Okafor" → "TO". Used when a record carries a name and no initials. */
export function initialsOf(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}
