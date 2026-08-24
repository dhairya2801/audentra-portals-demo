import Icon from '../Icon.jsx';

/**
 * The loading state of any page.
 *
 * Two things have to be true of it at once, and before the Jam of 2026-08-21
 * only the first was: the layout must not jump when the content arrives, and
 * the student must be able to tell that something is happening. The old
 * skeleton was three loose grey lines and two pale cards — a shape no page in
 * the product has, with a shimmer so faint that Laura circled it and said
 * *"está faltando um loading aqui"*.
 *
 * So the skeleton now takes the page's own anatomy — a band the height of the
 * hero, a panel the height of the summary, then cards — so loading → ready is
 * a fade rather than a rearrangement; and it says what it is doing, once, in
 * the band, where the eye lands first: a spinner and "Loading {label}…". That
 * line is the same sentence the screen reader already had, now visible, and
 * it is the only moving thing that is not a shimmer. There is no progress bar
 * at the top: the product would then have two vocabularies for "wait".
 *
 * `prefers-reduced-motion` stops the shimmer and the spin; the sentence does
 * the work on its own.
 */
export default function PageSkeleton({ label }) {
  const what = label ? `Loading ${label}…` : 'Loading this section…';
  return (
    <div className="page-skeleton" aria-busy="true" aria-live="polite">
      <div className="skeleton-band">
        <p className="skeleton-status">
          <span className="skeleton-spinner" aria-hidden="true">
            <Icon name="spinner" size={18} />
          </span>
          {what}
        </p>
        <span className="skeleton-line title" aria-hidden="true" />
        <span className="skeleton-line lede" aria-hidden="true" />
      </div>
      <div className="skeleton-panel" aria-hidden="true">
        <span className="skeleton-disc" />
        <span className="skeleton-lines">
          <span className="skeleton-line short" />
          <span className="skeleton-line figure" />
        </span>
        <span className="skeleton-lines trailing">
          <span className="skeleton-line short" />
          <span className="skeleton-line" />
        </span>
      </div>
      <div className="skeleton-card" aria-hidden="true">
        <span className="skeleton-line" />
        <span className="skeleton-line" />
        <span className="skeleton-line short" />
      </div>
      <div className="skeleton-card" aria-hidden="true">
        <span className="skeleton-line" />
        <span className="skeleton-line short" />
      </div>
    </div>
  );
}
