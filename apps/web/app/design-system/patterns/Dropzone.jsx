import Icon from '../Icon.jsx';

/**
 * A place to put a file — the product's one shape for it.
 *
 * A dashed, sunk area with a tinted tile in it (the tile wears the duotone
 * glyph, because it is content's shape), a headline, one line of rules, and
 * whatever control the caller puts under them — usually a secondary button
 * standing in for the file picker, since nothing in this prototype reads a
 * file. `filed` is the other drawing: the same area turned green, with the
 * file's name where the headline was, because green means one thing here —
 * done — and a file that is in is done.
 *
 * It was `.photo-zone` in the onboarding flow, typed once; the approved surface
 * draws the identical shape for an ID and for a photo, which is the moment a
 * one-off becomes a pattern.
 */
export default function Dropzone({ icon = 'upload', filed = false, title, line, note, children }) {
  return (
    <div className={filed ? 'dropzone filed' : 'dropzone'}>
      <span className="dropzone-mark" aria-hidden="true">
        <Icon name={filed ? 'check' : icon} size={22} weight="duotone" />
      </span>
      <p className="dropzone-copy">
        <strong>{title}</strong>
        {line ? <small>{line}</small> : null}
      </p>
      {children}
      {note ? <small className="dropzone-note">{note}</small> : null}
    </div>
  );
}
