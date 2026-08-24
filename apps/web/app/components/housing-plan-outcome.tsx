"use client";

import Icon from "../design-system/Icon.jsx";
import EdwardAsk from "../design-system/patterns/EdwardAsk.jsx";
import { openEdward } from "../design-lib/door.js";
import type { Deadline } from "./housing-logic";

/**
 * What sits below the plan when the plan is not *living on campus* — the
 * reference `PlanOutcome`. None of these is a `StateCard`: the page is complete,
 * this is what the answer means.
 */
export function HousingPlanOutcome({
  variant,
  office,
  deadline,
  catalogueCount,
  catalogueUnavailable,
  onHow,
}: {
  variant: "awaiting" | "commuting" | "off_campus" | "family" | "undecided";
  office: string;
  deadline: Deadline;
  catalogueCount: number;
  catalogueUnavailable: boolean;
  onHow: () => void;
}) {
  const changed = deadline
    ? `Changed your mind? Choose a different plan above, any time before ${deadline.full}.`
    : "Changed your mind? Choose a different plan above, any time.";

  if (variant === "awaiting") {
    return (
      <section className="section-card outcome-card awaiting" aria-labelledby="next-heading">
        <span className="outcome-icon">
          <Icon name={catalogueUnavailable ? "alert" : "home"} size={22} />
        </span>
        <h2 id="next-heading">A second question opens if you live on campus</h2>
        <p>
          {catalogueUnavailable
            ? "The residence hall catalog couldn’t be loaded just now. Your plan is unaffected, and ranking opens again when it loads."
            : catalogueCount === 0
              ? `${office} hasn’t published any residence halls yet. If you live on campus you’ll rank up to three here once they do.`
              : `Students living on campus rank up to three residence halls from the catalog ${office} publishes. It only applies if you live on campus.`}
        </p>
        <p className="outcome-meta">
          <Icon name="clock" size={14} />{" "}
          {deadline ? `Answer any time before ${deadline.full}.` : "Answer any time."}
        </p>
      </section>
    );
  }

  if (variant === "commuting" || variant === "family") {
    return (
      <section className="section-card outcome-card" aria-labelledby="commute-heading">
        <span className="outcome-icon">
          <Icon name="check" size={22} />
        </span>
        <h2 id="commute-heading">
          {variant === "commuting"
            ? "You are commuting, so there is nothing to rank"
            : "You are living with family, so there is nothing to rank"}
        </h2>
        <p>
          Ranking residence halls is only for students living in campus housing. Your answer is complete
          and no housing step is left open on your checklist.
        </p>
        <p className="outcome-meta">
          <Icon name="clock" size={14} /> {changed}
        </p>
      </section>
    );
  }

  if (variant === "off_campus") {
    return (
      <section className="section-card outcome-card" aria-labelledby="own-heading">
        <span className="outcome-icon">
          <Icon name="check" size={22} />
        </span>
        <h2 id="own-heading">You are arranging your own housing. That is the whole answer</h2>
        <p>
          Nothing further is needed about where you live. You do not appear in the room assignment
          list, and no address is required from you for housing.
        </p>
        <p className="outcome-meta">
          <Icon name="clock" size={14} /> {changed}
        </p>
      </section>
    );
  }

  return (
    <section className="section-card outcome-card undecided" aria-labelledby="undecided-heading">
      <span className="outcome-icon">
        <Icon name="help" size={22} />
      </span>
      <h2 id="undecided-heading">Someone at {office} will help you decide</h2>
      <p>
        Nothing is recorded as your plan. Needing to decide is not a decision, and your checklist
        still shows housing as open{deadline ? ", with its deadline" : ""}. Ask Edward and he’ll put
        you in touch with {office}.
      </p>
      <p>
        The residence halls are below so you can read them while you decide. You cannot rank them yet:
        ranking opens once you answer that you are living on campus.
      </p>
      <div className="outcome-actions">
        <EdwardAsk
          label="Ask Edward who can help"
          mark="E"
          onClick={() =>
            openEdward({
              question: `I can’t decide where to live next year. Who at ${office} can help me?`,
              context: { label: "Housing · Your plan", intent: "advisor", office: "housing" },
            })
          }
        />
        <button type="button" className="text-button" onClick={onHow}>
          <Icon name="info" size={15} /> How housing decisions work
        </button>
      </div>
    </section>
  );
}
