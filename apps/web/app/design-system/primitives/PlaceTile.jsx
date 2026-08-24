/**
 * A photograph of a place, in a tile of fixed ratio — and the monogram when there is none.
 *
 * A person is `<Avatar>`; a thing is a glyph in a tile; a *place* may carry a photograph of the
 * place, never of people (CLAUDE.md, 2026-08-22; the housing review's G1 and its rule 4). The
 * ratio is fixed and the picture is cropped to fill it, so a catalogue of eight — or forty — lines
 * up whatever the institution published. `sm` is a shortlist row, `md` a catalogue card's leading
 * slot, `lg` an assignment, `full` the detail: the picture at full width with a caption naming what
 * it shows — which is how a bedroom, were one ever published, would name its room type.
 *
 * The fallback is the `.org-tile` monogram the clubs already use: initials, never a grey rectangle
 * promising a photograph that is not coming, never stock and never generated.
 *
 * Reference: Expedia's results card — the photograph leads, fixed ratio, the facts beside it
 * (ENR-207 references.md, 2026-08-22).
 */
export default function PlaceTile({ image, initials, size = 'md', className }) {
  const classes = (...names) => names.filter(Boolean).join(' ');

  if (!image) {
    return (
      <span
        className={classes('org-tile', (size === 'lg' || size === 'full') && 'large', className)}
        aria-hidden="true"
      >
        {initials}
      </span>
    );
  }

  if (size === 'full') {
    return (
      <figure className={classes('place-photo', className)}>
        <img src={image.src} alt={image.alt ?? ''} />
        {image.caption ? <figcaption>{image.caption}</figcaption> : null}
      </figure>
    );
  }

  return (
    <span className={classes('place-tile', size, className)}>
      <img src={image.src} alt={image.alt ?? ''} loading="lazy" />
    </span>
  );
}
