import Icon from '../Icon.jsx';

/**
 * A spot illustration — the one illustration style the product has.
 *
 * The question the Jam of 2026-08-21 put was *where do illustrations go*, and
 * the honest answer was that an imported set — unDraw, Open Peeps, any of them
 * — would be a second visual language sitting inside the first: their own line
 * weight, their own palette, their own idea of a person. The product already
 * has a drawn thing it repeats on every page: the orbit motif in the band's
 * right edge, two rings, a core and three sparks. This is that motif at card
 * scale, with a duotone glyph in the core instead of the section's icon.
 *
 * It goes where a state card needs a picture and nowhere else: empty, error,
 * partial, done. A spot in a card head or beside a row is decoration, and the
 * card rules already say what to do with decoration.
 *
 * `tone` is the colour family and it follows the colour contract — `quiet`
 * (paper), `done` (green), `error` (crimson), `working` (amber), `accent`
 * (purple). `size` is the whole motif; the glyph is sized from it.
 */
export default function Spot({ icon, tone = 'quiet', size = 84, className }) {
  const glyph = Math.round(size * 0.36);
  return (
    <span
      className={['spot', `spot-${tone}`, className].filter(Boolean).join(' ')}
      style={{ '--spot-size': `${size}px` }}
      aria-hidden="true"
    >
      <i className="spot-ring" />
      <i className="spot-ring dashed" />
      <span className="spot-core">
        <Icon name={icon} size={glyph} weight="duotone" />
      </span>
      <i className="spot-dot one" />
      <i className="spot-dot two" />
    </span>
  );
}
