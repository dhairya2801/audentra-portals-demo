"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "../../design-system/Icon.jsx";
import { BREW_SOURCES, topicById } from "./catalog";
import type { OnboardingDraft } from "./onboarding";

const STEP_MS = 320;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Each line names something the reader actually asked for, so the wait reads
 * back their own answers rather than a spinner's worth of nothing. When the
 * draft is unknown — the first paint of the day, before stored preferences are
 * read — the list falls back to the two steps that are true regardless.
 */
function stepsFor(draft: OnboardingDraft | null, students: number | null): string[] {
  if (!draft) {
    return ["Opening today’s records", "Assembling your Morning Brew"];
  }
  const topics = draft.topics
    .map((id) => topicById(id)?.title)
    .filter((title): title is string => Boolean(title))
    .map((title) => `Following ${title}`);
  const sources = BREW_SOURCES.filter((source) => draft.sources[source.id].enabled).map(
    (source) => `Adding ${source.title}`,
  );
  return [
    students === null ? "Reading your student records" : `Reading ${students} student records`,
    ...topics,
    ...sources,
  ];
}

/**
 * The screen between "make my Morning Brew" and the Morning Brew.
 *
 * It is a real wait — the briefing is an aggregate read over the whole tenant —
 * and it is also the one moment to show that the page about to appear is built
 * from the reader's own answers. `onDone` fires once the list has run, so the
 * caller decides what follows; when the caller passes none, the screen simply
 * completes and holds, which is what the first load of the day needs.
 */
export function BrewLoading({
  firstName,
  draft,
  students,
  onDone,
}: {
  firstName: string | null;
  draft: OnboardingDraft | null;
  students: number | null;
  onDone?: () => void;
}) {
  const steps = useMemo(() => stepsFor(draft, students), [draft, students]);
  // Someone who asked for less motion gets the finished list on the first
  // paint rather than a list that ticks; the initial state says so, so no
  // render is spent walking it there.
  const [reduced] = useState(prefersReducedMotion);
  const [done, setDone] = useState(() => (reduced ? Number.MAX_SAFE_INTEGER : 0));

  useEffect(() => {
    if (reduced) {
      const settle = window.setTimeout(() => onDone?.(), STEP_MS);
      return () => window.clearTimeout(settle);
    }
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setDone(index);
      if (index >= steps.length) {
        window.clearInterval(timer);
        window.setTimeout(() => onDone?.(), STEP_MS);
      }
    }, STEP_MS);
    return () => window.clearInterval(timer);
    // `steps` is derived from the draft, which does not change while this runs.
  }, [steps.length, reduced, onDone]);

  const complete = Math.min(done, steps.length);
  const percent = steps.length ? Math.round((complete / steps.length) * 100) : 0;

  return (
    <section className="brew-building" aria-label="Preparing Morning Brew" aria-live="polite">
      <div className="brew-building__inner">
        <span className="brew-building__mark" aria-hidden="true">
          <Icon name="brew" size={26} />
        </span>
        <h1>Building your Morning Brew{firstName ? `, ${firstName}` : ""}</h1>
        <p>From what you just chose. Nothing here is guessed.</p>

        <ul className="brew-building__steps">
          {steps.map((step, index) => (
            <li className={index < complete ? "is-done" : ""} key={step}>
              <i aria-hidden="true">
                <Icon name="check" size={11} />
              </i>
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>

      <div
        className="brew-building__progress"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${percent}%` }} />
      </div>
    </section>
  );
}
