import Icon from '../Icon.jsx';
import { GROUPS, groupLeaves } from '../../design-lib/navigation.js';
// Portal adaptation: a tab is a client-side, tenant-aware navigation, not a full reload.
import { TenantLink } from '../../components/tenant-link';

/**
 * The leaf switcher for a navigation group — one row, one look, wherever a group
 * has more than one page. My Financials had `.section-tabs` and My Campus Life
 * had `.campus-tabs`; they did the same job in two shapes and two colours, which
 * is exactly the drift the Jam of 2026-08-20 asked us to stop.
 *
 * Labels and routes come from `navigation.js`, so a page cannot be called one
 * thing here and another in the sidebar (ENR-174 AC4).
 *
 * It sits directly above the content it switches. Anything true of the whole
 * group — the balance, a required session — belongs above this row, not below.
 */
export default function GroupTabs({ group, activeId }) {
  const leaves = groupLeaves(group);
  if (leaves.length < 2) return null;

  return (
    <nav className="group-tabs" aria-label={`${GROUPS[group]} sections`}>
      {leaves.map((leaf) => {
        const active = leaf.id === activeId;
        return (
          <TenantLink
            key={leaf.id}
            className={active ? 'active' : undefined}
            href={leaf.route}
            aria-current={active ? 'page' : undefined}
          >
            <Icon name={leaf.icon} size={16} />
            {leaf.tab ?? leaf.label}
          </TenantLink>
        );
      })}
    </nav>
  );
}
