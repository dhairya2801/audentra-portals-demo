"use client";

import type { StudentHelpRequest } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import type { TenantConfig } from "../lib/tenant";
import { shortDate, sinceLabel, stateOf } from "./help-logic";

/**
 * One request, as the student sees it — the reference's `RequestRow`. No assignee, no queue, no
 * reference number: the state is carried by a tinted chip, never by a painted edge on the row.
 */
export function HelpRequestRow({
  request,
  office,
  tenant,
  now,
  onOpen,
}: {
  request: StudentHelpRequest;
  office: string;
  tenant: TenantConfig;
  now: number;
  onOpen: (request: StudentHelpRequest) => void;
}) {
  const state = stateOf(request);
  const lastFromOffice = request.messages.at(-1)?.direction === "staff";

  return (
    <button className="request-row" onClick={() => onOpen(request)} aria-label={`${request.subject}, ${state.label}, ${office}`}>
      <span className={`request-chip ${state.tone}`}>{state.label}</span>

      <span className="request-body">
        <strong>{request.subject}</strong>
        <span className="request-meta">
          {office} · you asked on {shortDate(request.createdAt, tenant)}
        </span>
      </span>

      <span className="request-trail">
        <span className="request-when">{sinceLabel(request.updatedAt, now)}</span>
        {lastFromOffice && request.status === "waiting_on_student" ? (
          <span className="request-unread">
            <i aria-hidden="true" /> New reply
          </span>
        ) : (
          <span className="request-open" aria-hidden="true">
            <Icon name="arrow" size={15} />
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * Everything she has asked, and where each one got to — the reference's `RequestList`. A student
 * who has never asked anything is drawn differently from a list that could not be read.
 */
export function HelpRequestList({
  requests,
  open,
  office,
  tenant,
  now,
  institution,
  onOpen,
  onAsk,
}: {
  requests: StudentHelpRequest[];
  open: number;
  office: string;
  tenant: TenantConfig;
  now: number;
  institution: string;
  onOpen: (request: StudentHelpRequest) => void;
  onAsk: () => void;
}) {
  return (
    <section className="section-card" aria-labelledby="requests-heading">
      <div className="status-heading">
        <span className="status-icon accent" aria-hidden="true">
          <Icon name="message" size={20} />
        </span>
        <div>
          <h2 id="requests-heading">Your requests</h2>
          <p>What you have asked</p>
        </div>
        <div className="requests-standing">
          {requests.length > 0 && <span className="result-count">{open > 0 ? `${open} open` : "All answered"}</span>}
          <button className="secondary-button" onClick={onAsk}>
            <Icon name="pen" size={15} /> Ask an office
          </button>
        </div>
      </div>

      {requests.length === 0 ? (
        <StateCard icon="message" title={`You haven’t asked ${institution} anything yet`}>
          Anything you raise with an office appears here, with what is happening to it and the answer when it
          comes. This page is where {institution} replies, so nothing you are told goes missing in an inbox.
        </StateCard>
      ) : (
        <div className="card-rows request-rows">
          {requests.map((request) => (
            <HelpRequestRow key={request.id} request={request} office={office} tenant={tenant} now={now} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}
