"use client";

import Icon from "../design-system/Icon.jsx";
import EdwardAsk from "../design-system/patterns/EdwardAsk.jsx";
import {
  type CreditMatch,
  type DegreeRequirement,
  confidenceIcon,
  confidenceLabel,
  effectLine,
  matchEffect,
} from "./classrooms-model";

/**
 * A match is evidence under discussion: no accept, no dismiss — the affordance
 * is absent, not disabled. An accordion, closed by default (brief, D16).
 */
export function CreditMatchCard({
  match,
  requirements,
  registrar,
  open,
  onToggle,
  onOpen,
  onAsk,
  onRevealCourse,
}: {
  match: CreditMatch;
  requirements: DegreeRequirement[];
  registrar: string;
  open: boolean;
  onToggle: (id: string) => void;
  onOpen: (match: CreditMatch) => void;
  onAsk: (match: CreditMatch) => void;
  onRevealCourse: (match: CreditMatch) => void;
}) {
  const bodyId = `match-${match.id}-body`;
  const effect = effectLine(matchEffect(match, requirements));

  return (
    <article className={`match-card${open ? " open" : ""}`} id={`match-${match.id}`}>
      <button
        type="button"
        className="match-head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => onToggle(match.id)}
      >
        <span className="match-route">
          <span className="match-from">
            <small>From your documents</small>
            <strong>{match.evidence.detail}</strong>
            <span>{match.evidence.source}</span>
          </span>
          <span className="match-arrow" aria-hidden="true">
            <Icon name="arrow" size={16} />
          </span>
          <span className="match-to">
            <small>Might count toward</small>
            <strong>
              {match.target.courseCode} · {match.target.courseTitle}
            </strong>
            <span>
              {match.target.requirementName} · {match.target.credits} credits
            </span>
          </span>
        </span>
        <span className={`confidence-chip ${match.confidence}`}>
          <Icon name={confidenceIcon(match.confidence)} size={12} />
          {confidenceLabel(match.confidence)}
        </span>
        <span className="match-chevron" aria-hidden="true">
          <Icon name="chevron" size={18} />
        </span>
      </button>

      <div className="match-body" id={bodyId} hidden={!open}>
        <div className="match-meta">
          <span>Rule {match.rule.code}</span>
          <span>{registrar} decides</span>
        </div>

        {effect ? (
          <p className="match-effect">
            <Icon name="arrow" size={15} />
            {effect}
          </p>
        ) : null}

        <p className="match-standing">
          <Icon name="info" size={15} />
          Not approved. This has not changed a requirement, a credit total or your degree progress.
        </p>

        <div className="match-actions">
          <button type="button" className="secondary-button" onClick={() => onOpen(match)}>
            See the evidence <Icon name="arrow" size={15} />
          </button>
          <EdwardAsk mark="E" onClick={() => onAsk(match)} />
          {match.target.requirementId ? (
            <button type="button" className="text-button" onClick={() => onRevealCourse(match)}>
              See the course
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
