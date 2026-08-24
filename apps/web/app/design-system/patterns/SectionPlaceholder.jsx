import Icon from '../Icon.jsx';
import { destinationById } from '../../design-lib/navigation.js';

/**
 * ENR-174 AC8: a section with nothing to show states what will appear there and
 * what produces it, then offers the route to whatever produces it. Never the
 * word "empty", never "coming soon".
 */
export default function SectionPlaceholder({ section }) {
  const next = destinationById(section.next);

  return (
    <section className="section-placeholder" aria-labelledby="placeholder-title">
      <span className="placeholder-icon" aria-hidden="true">
        <Icon name={section.icon} size={26} />
      </span>
      <h2 id="placeholder-title">What appears here</h2>
      <p>
        {section.appears} {section.produces}
      </p>
      {next && (
        <a className="placeholder-route" href={next.route}>
          Go to {next.label}
          <Icon name="arrow" size={16} />
        </a>
      )}
    </section>
  );
}
