"use client";

import type { AcademicProgram } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import AnchorCard from "../design-system/primitives/AnchorCard.jsx";

/**
 * The rail: the program in the dark slot — facts, never progress — and the
 * official-record card. No Momentum points: a requirement earns nothing.
 */
export function ClassroomsRail({
  program,
  catalogVersion,
  institution,
  registrar,
  onOpenCredit,
}: {
  program: AcademicProgram | null;
  catalogVersion: string | null;
  institution: string;
  registrar: string;
  onOpenCredit: () => void;
}) {
  return (
    <>
      <AnchorCard
        variant="program"
        label="Your program"
        figureClass="program-lead"
        figure={program ? `${program.degree} · ${program.name}` : "Not assigned yet"}
      >
        {program ? (
          <dl className="program-facts">
            {catalogVersion ? (
              <div>
                <dt>Catalog</dt>
                <dd>{catalogVersion}</dd>
              </div>
            ) : null}
            <div>
              <dt>Code</dt>
              <dd>{program.code}</dd>
            </div>
            <div>
              <dt>To graduate</dt>
              <dd>{program.totalCredits} credits</dd>
            </div>
          </dl>
        ) : (
          <p className="program-pending">
            Your catalog, your requirements and the credits you need to graduate all arrive with
            the program.
          </p>
        )}
      </AnchorCard>

      <div className="record-card">
        <span className="record-icon" aria-hidden="true">
          <Icon name="shield" size={19} />
        </span>
        <span className="panel-label">Your official record</span>
        <p>
          This page shows {institution}’s published catalog and the credit the Registrar has
          already approved. Your official academic record lives with the {registrar}.
        </p>
        {program?.source ? (
          <p className="record-where">
            <Icon name="pin" size={13} />{" "}
            <a href={program.source.url} target="_blank" rel="noreferrer">
              {program.source.label}
            </a>
          </p>
        ) : null}
        <button type="button" className="learn-link" onClick={onOpenCredit}>
          How credit is approved <Icon name="arrow" size={14} />
        </button>
      </div>
    </>
  );
}
