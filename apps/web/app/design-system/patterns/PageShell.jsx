import PageHero from './PageHero.jsx';
import { heroFor } from '../../design-lib/navigation.js';

/**
 * The frame every page inherits — ENR-174 AC7.
 *
 * It used to own only the top and the bottom: a head, then whatever `children`
 * happened to be, then the footer. Everything in between was invented once per
 * section, so the tab row, the escalation strip and the summary panel landed in
 * a different order on every screen — and on My Financials the summary panel,
 * which is built to tuck under the hero, tucked under an alert strip instead and
 * sat on top of it. The Jam of 2026-08-20 called that out, and asked for My
 * Enrollment's construction everywhere.
 *
 * So the shell owns the order now. Four slots, always in this sequence:
 *
 *   hero      the band that says where you are          — always
 *   summary   the section's one figure, and who owns it — tucked under the hero
 *   notice    one line true of the whole section        — see below
 *   tabs      which leaf of the group you are reading   — directly above it
 *   body      main column, and the rail beside it
 *
 * The tab row comes last of the four because everything above it is true of the
 * whole group and everything below it is what the tab switches. That is why the
 * balance sits above the tabs on My Financials — it is the same number on all
 * three leaves — and it is ENR-189's rule for My Campus Life read as layout: a
 * required session is an obligation for the section, so it must not be able to
 * hide behind a tab the student did not open.
 *
 * A page passes slots, not markup order, so it cannot get the order wrong. The
 * tuck between the hero and the summary is a rule about those two elements
 * being adjacent, which is now guaranteed rather than hoped for.
 *
 * ## The notice does not get a place of its own — Jam of 2026-08-21
 *
 * There were two slots for one job, and no rule saying which. `alert` rode the
 * foot of the summary panel and `notice` was a full-width band above the tabs,
 * so every page picked by feel — and My Documents picked backwards, putting
 * *your transcript was sent back, send a new copy* in the quiet slot and *we
 * are still checking it* in the loud one above it.
 *
 * The band was the worse half. On My Enrollment it was a rounded amber card,
 * 1180 wide and 62 tall with an 18px gap under it, holding one sentence of
 * sixty characters — seventy per cent empty, and a whole row of the page's
 * rhythm spent on a footnote. A notice is not a thing in its own right, so it
 * should not be drawn as one.
 *
 * One slot now, and the shell docks it:
 *
 *   summary panel present   the notice is that panel's **foot**. The figure
 *                           says 33%, and the notice is why it is not 100%;
 *                           attached, it cannot be scrolled past without the
 *                           number, and it costs the page no height at all.
 *   no summary panel        one **line** above the tab row — two hairlines and
 *                           a sentence, not a card. Only My Campus Life.
 *
 * Everything narrower than the whole section docks somewhere else, and the page
 * places it itself, because only the page knows what it is about: a notice for
 * one list is the head of that list's `.section-card`, provenance is its
 * `.card-foot`, and a fact about one row is a chip on the row. `Notice.jsx` has
 * the four zones and the rule for choosing between them.
 *
 * The shell owns the distances too, since the Jam of 2026-08-21: `--hero-gap`
 * after the band or the panel tucked into it, `--space-9` after the notice and
 * after the tab row. A notice cannot bring its own distance, so a page cannot
 * get the gap wrong the way three of them had.
 */
export default function PageShell({
  destination,
  hero,
  tabs,
  summary,
  summaryLabel,
  notice,
  rail,
  children,
}) {
  // Copy comes from the destination model; a page overrides only what it has to
  // say dynamically — how many sessions are required, whether a board is empty.
  const { flag, kicker, title, lede, motif, figure } = { ...heroFor(destination), ...hero };

  return (
    <>
      <PageHero flag={flag} kicker={kicker} title={title} lede={lede} motif={motif} figure={figure} />

      {summary && (
        <section className="page-summary" aria-label={summaryLabel}>
          <div className="summary-main">{summary}</div>
          {notice && <div className="summary-alert">{notice}</div>}
        </section>
      )}

      {notice && !summary ? <div className="page-notice">{notice}</div> : null}
      {tabs}

      {rail ? (
        <div className="page-body">
          <div className="page-main">{children}</div>
          <aside className="page-rail">{rail}</aside>
        </div>
      ) : (
        children
      )}

      <footer>
        <span>Aster University sample experience · Designed with Audentra</span>
        <span>
          <a href="#privacy">Privacy</a>
          <a href="#accessibility">Accessibility</a>
          <a href="#/help">Help</a>
        </span>
      </footer>
    </>
  );
}
