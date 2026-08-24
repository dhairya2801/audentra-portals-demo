import Icon from '../Icon.jsx';
import Tooltip from '../primitives/Tooltip.jsx';
import Avatar from '../primitives/Avatar.jsx';

/**
 * The right half of the summary panel: the person who owns the subject.
 *
 * It is sized by the cell beside it. The figure on the left is a 61px ring and
 * three short lines; the bar has to come to the same height or the panel is a
 * tall box with a short thing floating in it, which is the inconsistent
 * whitespace this slot had on all five sections.
 *
 * 61px pays for exactly two lines of copy and one row of controls, so:
 *
 *   - **The controls are icons, side by side.** `Email` and `Message` as words
 *     cost 150px of a 420px cell, which left 140px for copy that needs 320 —
 *     that was the overflow, and it is what made the bar 153px tall against a
 *     61px figure. Stacked they fit the width but not the height: two discs in
 *     a column are 73px on their own. Side by side they are 34px tall and cost
 *     the bar nothing. The word is still each button's accessible name and
 *     `Tooltip` gives it back on hover and on keyboard focus.
 *   - **The building and the office hours are not here.** Two more lines is
 *     40px the panel does not have. They are not lost: Edward's person card
 *     prints the office and the hours, which is where they are read — while
 *     deciding whether to write, not while reading a figure.
 *
 * What is left is what the panel is for: who this person is to you, their name,
 * and the two ways to reach them, both one click away. One bar, one content,
 * every section — a section that shows more or less here is the drift. The one
 * line it may add is `note`, under the name, and only where the person is
 * covering a subject that is not theirs (the Health changes of 2026-08-21, H2):
 * it says what this person is *for* on this page, so that an advisor at the top
 * of a page about health cannot read as part of the health record.
 *
 * The subject is always a person. For one afternoon — the My Degree brief of
 * 2026-08-21, D15 — the bar took an office, a glyph in a tile where the face
 * sits, and Marco struck it the same day: this seat is the person who owns the
 * subject for the student, on every section; an office is a thing, a thing
 * never gets a face, and so an office is named in the copy that needs it and
 * never seated here.
 */
export default function AdvisorBar({ advisor, note, onContact }) {
  return (
    <div className="advisor-bar">
      <Avatar person={advisor} size="md" className="advisor-avatar" />
      <div className="advisor-bar-copy">
        <span className="panel-label">{advisor.label}</span>
        <strong>
          {advisor.name}
          {advisor.office ? <span> · {advisor.office}</span> : null}
        </strong>
      </div>
      <div className="advisor-actions">
        <Tooltip tip="Email">
          <button
            className="advisor-action"
            aria-label={`Email ${advisor.name}`}
            onClick={() => onContact('email')}
          >
            <Icon name="mail" size={16} />
          </button>
        </Tooltip>
        <Tooltip tip="Message">
          <button
            className="advisor-action"
            aria-label={`Message ${advisor.name}`}
            onClick={() => onContact('message')}
          >
            <Icon name="message" size={16} />
          </button>
        </Tooltip>
      </div>
      {/* The one line the bar may add, and only where the person is covering a
          subject that is not theirs — Health (the enrollment advisor on a page
          whose decisions are Health Services' and Accessibility Services')
          and, while no academic advisor is assigned, My Degree. It runs under
          the whole bar rather than in the copy column: in the column it wrapped
          to two lines and the bar outgrew the figure cell beside it, which is
          the one thing the panel's height must not depend on. */}
      {note ? <span className="advisor-note">{note}</span> : null}
    </div>
  );
}
