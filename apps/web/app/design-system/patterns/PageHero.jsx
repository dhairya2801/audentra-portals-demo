import { forwardRef } from 'react';
import Icon from '../Icon.jsx';

/**
 * The band a page opens with — the one saturated surface in the product.
 *
 * It was the first thing `PageShell` rendered and nothing else could render
 * it, so the one screen that is not a section — onboarding, which replaces the
 * chrome — grew a head of its own: an eyebrow, an `h1` and a lede on the bare
 * canvas, with the demo control and the way out floating above them (Marco,
 * 2026-08-21: "tá tudo inconsistente aqui"). The band is now its own pattern
 * and `PageShell` composes it, so a flow opens the way a section does: the
 * eyebrow in mono, the title, the lede, the motif in the right edge.
 *
 *   flag      the green word before the kicker — "Offer accepted"
 *   kicker    the eyebrow's text — who owns this record, as of when; or, in a
 *             flow, the position: "Step 3 of 8"
 *   title     the sentence
 *   lede      one or two lines under it; always rendered, even empty, so the
 *             band is the same height on every route (`--hero-min`)
 *   motif     the section's icon in the orbit, outline on purpose — a two-tone
 *             glyph's back layer turns to mud on a gradient disc
 *   figure    a person where the motif would be — the student's own photograph
 *             on Profile, with the control that changes it under it
 *   focusable the title takes focus when a flow moves to its next question,
 *             so a keyboard user is moved to it instead of left at the foot of
 *             the last one; the ref is the `h1`
 */
const PageHero = forwardRef(function PageHero(
  { flag, kicker, title, lede, motif, figure, focusable = false },
  ref,
) {
  return (
    <header className="page-hero">
      <div className="hero-copy">
        <p className="eyebrow">
          {flag && <span>{flag}</span>}
          {flag && kicker ? ' · ' : null}
          {kicker}
        </p>
        <h1 ref={ref} tabIndex={focusable ? -1 : undefined}>
          {title}
        </h1>
        {/* Always rendered, even with nothing in it. Two reasons, and the
            second one was a bug waiting: the band reserves two lines here so
            every route's band is the same height, and the rule that styles it
            used to read `.page-hero p:last-child` — with no lede, that
            selector landed on the eyebrow and restyled it. */}
        <p className="hero-lede">{lede}</p>
      </div>

      {/* A person in the motif's place — Profile, where the student's own
          photograph leads the page (the review of 2026-08-21, C1.1). It is the
          one place a photograph of the student appears, uploaded by her; every
          other band keeps its glyph in the orbit. */}
      {figure ? <div className="hero-figure">{figure}</div> : null}

      {motif && !figure && (
        <div className="hero-motif" aria-hidden="true">
          <div className="orbit-ring ring-one" />
          <div className="orbit-ring ring-two" />
          <div className="orbit-core">
            <Icon name={motif} size={30} />
          </div>
          <i className="spark-dot one" />
          <i className="spark-dot two" />
          <i className="spark-dot three" />
        </div>
      )}
    </header>
  );
});

export default PageHero;
