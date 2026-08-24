"use client";

import type { StudentDocument, StudentRequirementDetail } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import ActionBand from "../design-system/patterns/ActionBand.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import StatusPill from "../design-system/primitives/StatusPill.jsx";
import { useTenant } from "./tenant-provider";
import {
  daysLabel,
  daysLeft,
  dependencyTitles,
  latestDecision,
  officeName,
  shortDate,
  stateInfo,
  stateOf,
} from "./health-logic";

/**
 * The immunization record, in the section that owns its door — the reference
 * `RecordCard`, fed by the production requirement and its documents.
 */
export function HealthRecordCard({
  requirement,
  documents,
  all,
  unavailable,
  band,
  onOpen,
  onRetry,
}: {
  requirement: StudentRequirementDetail | null;
  documents: readonly StudentDocument[];
  all: readonly StudentRequirementDetail[];
  unavailable: boolean;
  band: { icon: string; label: string } | null;
  onOpen: () => void;
  onRetry: () => void;
}) {
  const { tenant } = useTenant();
  const institution = tenant.shortName;
  if (unavailable || !requirement) {
    return (
      <section className="section-card" aria-labelledby="record-title">
        <div className="status-heading">
          <span className="status-icon docs">
            <Icon name="file" size={18} />
          </span>
          <div>
            <h2 id="record-title">Immunization record</h2>
            <p>{officeName(requirement)} reviews it.</p>
          </div>
        </div>
        {requirement ? (
          <StateCard
            variant="error"
            icon="alert"
            title="Your record could not be read just now"
            action={{ label: "Try again", icon: "refresh", onClick: onRetry }}
          >
            Nothing has been lost. Until this loads it is shown neither as sent nor as outstanding,
            because {institution} can’t tell you which it is without knowing.
          </StateCard>
        ) : (
          <StateCard icon="check" title="No record has been asked of you">
            When {officeName(requirement)} needs an immunization record from you, it appears here with
            what it needs, by when, and the place to send it.
          </StateCard>
        )}
      </section>
    );
  }

  const office = officeName(requirement);
  const state = stateOf(requirement, documents);
  const info = stateInfo(state);
  const decision = latestDecision(documents);
  const asking = info.holder === "you";
  const gating = requirement.blocking;
  const due = shortDate(requirement.dueAt, tenant);
  const days = daysLabel(daysLeft(requirement.dueAt));
  const deps = dependencyTitles(requirement, all);

  return (
    <section
      className={`section-card immunization-card ${asking ? "asking" : ""}`}
      aria-labelledby="record-title"
    >
      <div className="status-heading">
        <span className={`status-icon ${asking ? info.tone : "docs"}`}>
          <Icon name={state === "accepted" ? "check" : "file"} size={18} />
        </span>
        <div>
          <h2 id="record-title">Immunization record</h2>
          <p>{office} reviews it and decides.</p>
        </div>
        <StatusPill tone={info.tone} pulse={state === "checking"}>
          {info.label}
        </StatusPill>
      </div>

      {band ? <ActionBand icon={band.icon} label={band.label} /> : null}

      {gating && state !== "accepted" ? (
        <span className="gate-chip">
          <Icon name="flag" size={13} />
          Holds class registration
        </span>
      ) : null}

      <div className="record-state">
        <p className="record-line">
          {state === "checking" ? <i className="pulse" aria-hidden="true" /> : null}
          {state === "in-review"
            ? `With ${office} since your last upload. Nothing is needed from you while they have it.`
            : state === "accepted"
              ? `Accepted${decision?.decidedAt ? ` ${shortDate(decision.decidedAt, tenant)}` : ""} by ${office}. Your record is clear and nothing more is needed here.`
              : state === "checking"
                ? `${institution} is checking the files. You can leave this page. It keeps going without you.`
                : state === "changes-requested"
                  ? `${office} sent it back. A replacement goes in the same place, beside what you already sent.`
                  : state === "blocked"
                    ? `${requirement.description} It opens once ${
                        deps.length > 0 ? `“${deps[0].title}”` : "an earlier step"
                      } is complete.`
                    : requirement.description}
        </p>

        {(asking || state === "blocked") && due ? (
          <p className="record-due">
            <Icon name="calendar" size={14} /> {office} asks for it by {due}
            {days ? <b>· {days}</b> : null}
          </p>
        ) : null}
      </div>

      {state === "changes-requested" && decision ? (
        <div className="record-returned">
          <p className="returned-lead">What would fix it</p>
          <ul className="reject-remedies">
            <li>
              <Icon name="check" size={14} />
              Send a new copy of the file that came back. It goes beside the one you sent, never over
              it.
            </li>
            <li>
              <Icon name="check" size={14} />
              Make sure every page is flat, fully in frame, and the date beside each vaccine is
              legible.
            </li>
          </ul>
          {decision.note ? (
            <p className="returned-reason">
              <Icon name="alert" size={14} /> {decision.note}
            </p>
          ) : null}
          <p className="returned-by">
            {office}
            {decision.decidedAt ? ` · ${shortDate(decision.decidedAt, tenant)}` : ""}
          </p>
        </div>
      ) : null}

      <div className="card-foot record-foot">
        <span>
          <Icon name="shield" size={14} /> Stored encrypted, and read only by {office} staff.
        </span>
        <button className="primary-button" type="button" onClick={onOpen}>
          {state === "needed"
            ? "Send your immunization record"
            : state === "changes-requested"
              ? "Send a replacement"
              : "Open the record"}
          <Icon name="arrow" size={16} />
        </button>
      </div>
    </section>
  );
}
