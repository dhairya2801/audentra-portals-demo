import Field from '../primitives/Field.jsx';
import StatedField from '../primitives/StatedField.jsx';

/**
 * The one way this product signs — ADR 0020.
 *
 * The student types her legal name. There is no draw option and no prop that
 * would add one: `Audentra-platform` implements `signatureMethod: "typed" |
 * "drawn"` and this product offers only the first, so a component that could
 * express the second would be a door left open on a decision that was made.
 *
 * Signed twice in one flow, minutes apart — the per-person FERPA release, then
 * the Enrollment Information Acknowledgment — and the two have to be the same
 * act, or the second reads as a different kind of promise than the first. So it
 * is one component and it takes no variant.
 *
 * Three things are always on it, and the order is the argument:
 *
 *   1. **the legal name Aster holds**, locked, naming the Registrar — she signs
 *      as the person on the record, not as whoever is typing;
 *   2. **the field**, whose label says whose name goes in it;
 *   3. **the line that makes it a signature**, then the date.
 *
 * `mismatch` is the caller's to decide and the caller's to word. This component
 * never compares the two strings itself: what counts as the same name is a
 * policy question — case, accents, a middle name — and a primitive that guessed
 * would be wrong on someone's name.
 */
export default function Signature({
  legalName,
  value,
  onChange,
  date,
  label = 'Type your full legal name',
  error,
}) {
  return (
    <div className="signature">
      <StatedField
        label="Your legal name"
        value={legalName}
        office="The Registrar"
        className="signature-name"
      />

      <Field label={label} value={value} onChange={onChange} error={error} autoComplete="off" />

      <p className="signature-line">
        Typing your name here counts as your signature.
      </p>

      <StatedField label="Signed on" value={date} className="signature-date" />
    </div>
  );
}
