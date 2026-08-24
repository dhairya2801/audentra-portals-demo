import StateCard from './StateCard.jsx';

/**
 * The page half of the error state. The frame around it stays usable.
 *
 * It is `StateCard` at page size and nothing of its own — one error shape in
 * the product, crimson because the colour contract says a failed panel is
 * crimson, centred because it stands for the whole page (Jam, 2026-08-21).
 * The sentence promises only what is true: nothing she did caused it, and
 * nothing she sent was lost.
 */
export default function PageError({ label, onRetry }) {
  return (
    <StateCard
      variant="error"
      size="page"
      title={`Something went wrong loading ${label}`}
      action={{ label: 'Try again', icon: 'refresh', onClick: onRetry }}
    >
      Nothing you did caused it, and nothing you have sent Aster was affected. Trying again
      usually works.
    </StateCard>
  );
}
