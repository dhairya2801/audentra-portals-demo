/**
 * Where the portal can go — the destination model, completed by ENR-180.
 *
 * Every destination is declared once. The navigation rows, the page hero and the
 * section placeholder all read this file, so a concept cannot end up with two
 * names on two screens — ENR-174 AC4 as structure rather than as discipline.
 *
 * Started by ENR-166, which declared the rows it builds. ENR-180 extends it with
 * the grouping ENR-174 AC1 requires, the copy each empty section needs and the
 * routing helpers.
 *
 * The page shell pass adds `hero`. Every section opens with the same band — the
 * one My Enrollment has carried since ENR-164 — and its copy lives here rather
 * than inside the page, so a section cannot grow a title that drifts from the
 * name the sidebar gives it. A group owns one hero for all of its leaves: the
 * hero says where you are, the tab row below says which leaf you are reading.
 *
 * `appears` and `produces` are the two halves of the placeholder sentence: what
 * will be here, and what puts it here.
 *
 * `built` says a card owns that screen. Whether it renders is decided by the
 * page registry in `App.jsx` — a destination whose page has not landed yet
 * shows its placeholder, which is its honest state.
 *
 * A destination is a place the navigation can reach. Two things the portal
 * shows are not destinations: My Documents and Accessibility. The Jam of
 * 2026-08-21 took them out of the sidebar and put them under Profile and
 * Health; Marco finished the move the same afternoon — what has no row does not
 * get a page either, it opens the side panel, because that is the portal's one
 * way of opening what lives inside a page. They are declared in `PANELS` below,
 * which carries the copy an `EntryRow` needs and nothing else: no route, no
 * hero, no placeholder, because a panel has no address to land on.
 */

export const GROUPS = {
  financials: 'My Financials',
  campus: 'My Campus Life',
  // Profile is sectioned, not scrolled, since the review of 2026-08-21 (C1.3):
  // five leaves under one hero, reached from the person card — never a row in
  // the sidebar's list.
  profile: 'Profile',
};

/**
 * The hero a group's leaves share. Overview, Financial aid and Payments are one
 * subject read three ways, so they get one band and one balance — the tab row
 * under it is what changes.
 */
export const GROUP_HEROES = {
  financials: {
    kicker: 'My Financials · 2026–27 academic year',
    title: 'What the year costs, and what covers it.',
    lede: 'What the year costs, what’s covering it, and what still needs you, with the person who can change it.',
    motif: 'wallet',
  },
  campus: {
    // The kicker opens with the navigation's own label — ENR-174 AC 4, one
    // concept one name — decided 2026-08-22 with the Health rename (C9).
    kicker: 'My Campus Life · Published by Aster Student Life',
    title: 'Find your people.',
    lede: 'Events, clubs, and the people who run them. One session is required. Everything else is yours to choose.',
    motif: 'users',
  },
  profile: {
    kicker: 'Profile',
    title: 'What Aster knows about you.',
    lede: 'Some of it is yours to change. The rest belongs to an office, and this page says which one.',
    // No motif: the hero's figure is the student's own photograph (C1.1).
  },
};

export const DESTINATIONS = [
  {
    id: 'my-enrollment',
    label: 'My Enrollment',
    route: '/enrollment',
    icon: 'checklist',
    badge: 'openSteps',
    lede: 'Everything Aster still needs from you, in the order that keeps you moving.',
    // The one hero with a flag: the eyebrow states a fact about her standing,
    // not the name of a section. ENR-164's Jam approved this copy as it is.
    hero: {
      flag: 'Offer accepted',
      kicker: 'Class of 2030',
      title: 'You’re in, Maya. Here’s what’s left.',
      lede: 'Your next steps are in the order that keeps things moving. Start with the first one, or pick any task you can do now.',
      motif: 'check',
    },
    appears: 'The steps Aster still needs from you appear here.',
    produces: 'New steps open as you finish the ones before them.',
    next: 'profile',
    built: true,
  },
  {
    id: 'appointments',
    label: 'Appointments',
    route: '/appointments',
    icon: 'calendar',
    lede: 'Time booked with the people who can unblock a step.',
    // The eyebrow names who owns what is on this page: the times are the teams',
    // not the portal's, and that is the whole premise of ENR-178.
    hero: {
      kicker: 'Appointments · Times published by Aster teams',
      title: 'Book time with the people who can help.',
      // One sentence in every state since 2026-08-21 (appointments changes, 8.1):
      // what is booked lives in the list, not in the band. Since 2026-08-22 the
      // asking left this screen (ADR 0010): a team with nothing posted is Edward's
      // to route, and the lede says "posted", as a US campus does.
      lede: 'Each team posts the times it can offer. Pick one — or ask Edward when a team has none.',
    },
    appears: 'Appointments you book with Aster staff appear here.',
    produces: 'Booking opens as each team publishes its availability.',
    next: 'help',
    built: true,
  },
  {
    id: 'my-classrooms',
    label: 'My Degree',
    route: '/classrooms',
    icon: 'degree',
    lede: 'What your degree asks of you, and the courses that satisfy each requirement.',
    hero: {
      kicker: 'My Degree · BA Computer Science',
      title: 'What your degree asks of you.',
      lede: 'Every requirement your program sets, and the courses that satisfy each one. This is Aster’s reading of your record, not the record itself.',
      motif: 'book',
    },
    appears: 'Your degree requirements appear here, with the courses that satisfy each one.',
    produces: 'They arrive when Aster assigns your academic program.',
    next: 'my-enrollment',
    built: true,
  },

  {
    id: 'health',
    // "My Health and Wellness" since 2026-08-22 (the walkthrough of 2026-08-20,
    // C9): the "My …" form the rest of the navigation uses, and a name that
    // stops the section reading as a medical record alone — it carries a
    // record and a question. Title case, as every other row (ENR-174 AC 5).
    label: 'My Health and Wellness',
    route: '/health',
    // Not a heart and not a cross: this section is not a medical record, and the
    // first thing a student reads must not suggest it is.
    icon: 'health',
    // No badge, deliberately. The record's open state is already counted on
    // My Documents — the same thing twice in one sidebar is a lie about how much
    // is outstanding.
    // Two things, named as two — the Health changes of 2026-08-21 (H4). The
    // lede spoke only of the record from the UX writing pass until the question
    // came back onto this page as a panel the same afternoon.
    lede: 'Health Services needs your immunization record before you can register. Accessibility Services has a question you can answer whenever you want, or not at all.',
    hero: {
      kicker: 'My Health and Wellness',
      title: 'One record, and one question.',
      lede: 'Health Services needs your immunization record before you can register. Accessibility Services has a question you can answer whenever you want, or not at all.',
      motif: 'shield',
    },
    appears: 'The health step from onboarding is finished here, whatever is left of it.',
    produces: 'The record is open to you from the day your offer is accepted.',
    next: 'profile',
    built: true,
  },

  {
    id: 'financials-overview',
    label: 'Overview',
    route: '/financials',
    icon: 'wallet',
    group: 'financials',
    lede: 'What the year costs, what is covering it, and what still needs you.',
    appears: 'What your year costs, what your aid covers and what is left to pay appear here.',
    produces: 'They arrive when Aster publishes your financial package.',
    next: 'financials-aid',
    built: true,
  },
  {
    id: 'financials-aid',
    label: 'Financial aid',
    route: '/financials/aid',
    icon: 'award',
    group: 'financials',
    lede: 'Every source paying towards your year, and what could still be added.',
    appears: 'Aid you have been offered, and the paperwork it still needs, appear here.',
    produces: 'They arrive once your aid package is released.',
    next: 'profile',
    built: true,
  },
  {
    id: 'financials-payments',
    label: 'Payments',
    route: '/payments',
    icon: 'card',
    group: 'financials',
    lede: 'What Aster bills you, when each payment is due, and what it has recorded.',
    appears: 'Payments you make and payments still scheduled appear here.',
    produces: 'The first one appears after your first charge is posted.',
    next: 'financials-overview',
    built: true,
  },

  {
    id: 'events',
    label: 'Events',
    route: '/campus-life',
    icon: 'ticket',
    group: 'campus',
    lede: 'What Aster has scheduled for your class.',
    appears: 'Events Aster publishes for your class appear here.',
    produces: 'Nothing is scheduled yet.',
    next: 'clubs',
    // Obligations only — ENR-189. Campus life is optional; the count is not.
    badge: 'required',
    built: true,
  },
  {
    id: 'clubs',
    label: 'Clubs',
    route: '/campus-life?view=clubs',
    icon: 'users',
    group: 'campus',
    lede: 'The groups you can join once the list is published.',
    appears: 'Clubs you can join appear here.',
    produces: 'Student Life publishes this year’s list before term starts.',
    next: 'events',
    built: true,
  },

  {
    id: 'housing',
    label: 'Housing',
    route: '/housing',
    icon: 'home',
    // A destination of its own rather than a third leaf of My Campus Life. The
    // reasoning is in docs/adr/0002-housing-is-not-a-campus-life-leaf.md: a
    // group's hero, summary and notice are true of every leaf, and a housing
    // deadline is true of neither Events nor Clubs.
    //
    // No badge, for the reason Health gives above: the housing step is already
    // counted in `openSteps` on My Enrollment, and the same obligation counted
    // twice in one sidebar is a discrepancy the student cannot resolve.
    lede: 'Where you plan to live, and the residence halls you would like if that is on campus.',
    // The eyebrow names who publishes the catalogue, because the eight
    // residences on this page are the institution's list and not the portal's.
    hero: {
      kicker: 'Housing · Published by Residential Life',
      title: 'Where you’ll live.',
      lede: 'Two questions: where you’ll live, and which residence halls you’d like. Residential Life assigns the rooms.',
      motif: 'home',
    },
    appears: 'Your housing plan appears here, with the residence halls Residential Life publishes.',
    produces: 'Both are open to you from the day your offer is accepted.',
    next: 'my-enrollment',
    built: true,
  },

  {
    id: 'help',
    label: 'Help',
    route: '/help',
    icon: 'help',
    kind: 'utility',
    // ENR-181 took "ask" back for Edward. Help is where Aster's own guides live
    // and where a request reaches a named office — a different promise, so it
    // stops being written in the assistant's words. ENR-182 built the page to
    // this sentence: guides, then a route to an office that can decide.
    lede: 'Aster’s guides, and a way to reach the office that owns a step.',
    hero: {
      kicker: 'Help',
      title: 'Get unstuck, Maya.',
      lede: 'Aster’s own guides, and a way to put a named office on a step that is blocked.',
    },
    appears: 'Aster’s guides, and any request you raise with an office, appear here.',
    produces: 'Raise one when a step is blocked and you need a person on it.',
    next: 'appointments',
    built: true,
  },
  {
    id: 'profile',
    label: 'Profile',
    tab: 'About me',
    route: '/profile',
    icon: 'profile',
    kind: 'profile',
    group: 'profile',
    built: true,
    lede: 'The record Aster keeps about you.',
    hero: {
      kicker: 'Profile',
      title: 'What Aster knows about you.',
      lede: 'Some of it is yours to change. The rest belongs to an office, and this page says which one.',
    },
    appears: 'The details Aster holds about you appear here.',
    produces: 'Some you control; the rest an office changes for you.',
    next: 'my-enrollment',
    built: true,
  },
  // The other four sections of Profile (C1.3). They share the hero, the legend
  // and the rail; the tab row under the hero is what changes. `kind: 'profile'`
  // keeps them out of every list that treats Profile as the person card.
  {
    id: 'profile-contact',
    label: 'Contact and communication',
    route: '/profile?section=contact',
    icon: 'mail',
    kind: 'profile',
    group: 'profile',
    lede: 'Where Aster reaches you, and which channel it uses first.',
    built: true,
  },
  {
    id: 'profile-access',
    label: 'Who can see what',
    route: '/profile?section=access',
    icon: 'users',
    kind: 'profile',
    group: 'profile',
    lede: 'The people you let see your record, category by category.',
    built: true,
  },
  {
    id: 'profile-documents',
    label: 'My documents',
    route: '/profile?section=documents',
    icon: 'file',
    kind: 'profile',
    group: 'profile',
    lede: 'Everything you have sent Aster, and everything Aster has sent you.',
    built: true,
  },
  {
    id: 'profile-origins',
    label: 'Where I came from',
    route: '/profile?section=origins',
    icon: 'graduation',
    kind: 'profile',
    group: 'profile',
    lede: 'The schools and colleges before Aster, as their transcripts say.',
    built: true,
  },
];

/**
 * The two things that live inside a page rather than beside it.
 *
 * A panel is not a small destination. It has no route, so nothing links to it
 * and the back button never lands in it; it has no hero, because a drawer says
 * where you are in its label; it has no placeholder, because there is no
 * address for a student to arrive at before it is built. What it has is the
 * copy the row on the parent page needs — the name the door carries,
 * and the one line saying what is behind it, on the  that is the door —
 * every destination's copy is: a concept must not end up with two names on two
 * screens (ENR-174 AC4).
 *
 * `owner` is the page that holds the door. It is what the panel's drawer label
 * leads with, and it is the reason each of these is under the section it is
 * under: the record is part of what Aster knows about her, and the accommodation
 * question is asked beside the health step it must never be mistaken for
 * (ADR-0003).
 *
 * Neither carries a count. My Enrollment already counts the steps, and any
 * counter that could include the accommodation question would turn a complete
 * "not right now" into a pending item — the one thing that section exists to
 * avoid (ADR-0001, ENR-208 AC 3). The number on the documents card is the
 * record's own, read live from the record.
 */
export const PANELS = {
  'my-documents': {
    id: 'my-documents',
    owner: 'Profile',
    label: 'My Documents',
    icon: 'file',
    lede: 'Everything you have sent Aster, and everything Aster has sent you.',
  },
  accessibility: {
    id: 'accessibility',
    owner: 'My Health and Wellness',
    label: 'Accessibility',
    icon: 'accessibility',
    lede: 'One question that’s yours to answer, or not.',
  },
};

export function panelById(id) {
  return PANELS[id] ?? null;
}

/**
 * The home. The Dashboard that used to hold this slot summarised sections the
 * student then had to open anyway; the Jam of 2026-08-20 removed it. My
 * Enrollment is the page that already answers "what now", so it is the landing.
 */
export const DEFAULT_ROUTE = '/enrollment';

/**
 * The design system, rendered — `src/design-system/styleguide/Styleguide.jsx`.
 *
 * It is a route and not a destination: it has no place in a student's
 * navigation, no preview states, and no entry in `DESTINATIONS`. `isRouteHash`
 * already accepts it, so nothing else has to know about it — `App` checks the
 * hash before it looks a destination up.
 */
export const STYLEGUIDE_ROUTE = '#/styleguide';

/**
 * Onboarding — ENR-163. A route, and deliberately not a destination.
 *
 * It has no row in `NAV`, no entry in `DESTINATIONS` and no hero, because it is
 * not a section of the portal: it is what a newly admitted student walks
 * through once, before the portal exists for her. `App` checks the hash before
 * it looks a destination up, the same way it does for the styleguide — except
 * that onboarding replaces the chrome instead of rendering inside it, since a
 * sidebar is a list of ways out of a flow that is required to refuse them
 * (ENR-151 AC 1).
 *
 * The step is part of the route so a later one is *attemptable*: a refusal that
 * cannot be attempted is a refusal nobody can verify.
 */
export const ONBOARDING_ROUTE = '#/onboarding';

export function isOnboardingHash(hash) {
  if (typeof hash !== 'string') return false;
  return hash === ONBOARDING_ROUTE || hash.startsWith(`${ONBOARDING_ROUTE}/`);
}

/** The 1-based step in `#/onboarding/5`, or null for the bare route. */
export function onboardingStepFrom(hash) {
  if (!isOnboardingHash(hash)) return null;
  const rest = hash.slice(ONBOARDING_ROUTE.length).replace(/^\//, '');
  const step = Number(rest);
  return Number.isInteger(step) && step >= 1 ? step : null;
}

/**
 * The sidebar, in order — Laura's, from the Jam of 2026-08-21: what I must do,
 * who I talk to, my degree, my health, where I will live, then the money and the
 * rest of my life at Aster. My Documents left the list for the profile that
 * morning, and Accessibility never joined it (see `PANELS` above).
 *
 * Messages is gone. It was never a card: it arrived in the product base as a
 * decorative row and ENR-180 kept it because the topbar bell needed somewhere to
 * point. Its copy promised a channel the product decided not to have — ENR-161
 * AC5 and ENR-177 AC6 both hold "while no inbound channel exists" — and the
 * thread it would have shown is the one Help already owns (ENR-177 AC4). The
 * bell went with it: what changed since I was last here belongs to ENR-161, and
 * until that lands the sidebar counts are the honest version of it. Groups are labels, never destinations — the page a
 * student wanted is always a leaf, which is why My Financials holds an Overview
 * rather than being clickable itself (ENR-174 AC1).
 *
 * Academic is gone with My Progress: a heading holding one leaf costs a click
 * and buys nothing, so My Classrooms is a destination in its own right. This
 * diverges from ENR-174 AC1, which names both leaves — the divergence is the
 * Jam's, and it is recorded on the card.
 */
export const NAV = [
  { kind: 'link', id: 'my-enrollment' },
  { kind: 'link', id: 'appointments' },
  { kind: 'link', id: 'my-classrooms' },
  { kind: 'link', id: 'health' },
  // After Health, before the money: the Jam of 2026-08-21 put it here, among
  // the sections about the student herself. It used to sit last, under My
  // Campus Life. It is a link, not a leaf of the group below it — ADR 0002,
  // amended the same day.
  { kind: 'link', id: 'housing' },
  {
    kind: 'group',
    id: 'financials',
    label: GROUPS.financials,
    items: ['financials-overview', 'financials-aid', 'financials-payments'],
  },
  { kind: 'group', id: 'campus', label: GROUPS.campus, items: ['events', 'clubs'] },
];

/** Reachable from the foot of the sidebar, not from the section list. */
export const UTILITY_ID = 'help';

/** Reachable from the profile chip only, so the concept is never listed twice. */
export const PROFILE_ID = 'profile';

export function destinationById(id) {
  return DESTINATIONS.find((item) => item.id === id) ?? null;
}

/**
 * Only a hash that starts with `#/` is a route. `#privacy` in the footer is a
 * plain anchor and must not be read as a page that does not exist.
 */
export function isRouteHash(hash) {
  return typeof hash === 'string' && hash.startsWith('#/');
}

/** Reads a hash into a destination. Returns null for a route nobody owns. */
export function destinationByRoute(hash) {
  if (!hash || hash === '#' || hash === '#/') return destinationByRoute(DEFAULT_ROUTE);
  if (!isRouteHash(hash)) return null;
  const route = hash.split('?')[0].replace(/(.)\/$/, '$1');
  return DESTINATIONS.find((item) => item.route === route) ?? null;
}

/**
 * The band a destination opens with. A leaf inside a group inherits the group's
 * hero, so all three financials pages say the same thing about where you are;
 * a destination's own `hero` wins over it. Anything a section still has to say
 * dynamically — how many sessions are required today — is passed as an override
 * by the page and merged on top of this.
 *
 * The fallback is built from the fields every destination already carries, so a
 * new destination renders a correct hero before anyone writes copy for it.
 */
export function heroFor(item) {
  if (!item) return { kicker: 'Aster', title: 'That page doesn’t exist', motif: 'help' };

  const group = item.group ? GROUP_HEROES[item.group] : null;
  const own = item.hero ?? null;

  return {
    kicker: item.label,
    title: item.label,
    lede: item.lede,
    motif: item.icon,
    ...group,
    ...own,
  };
}

/** The leaves of a group that have a page behind them. */
export function groupLeaves(group) {
  return DESTINATIONS.filter((item) => item.group === group && item.built);
}
