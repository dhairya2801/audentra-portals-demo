"use client";

import type { TenantContact } from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import AnchorCard from "../design-system/primitives/AnchorCard.jsx";
import { officeName } from "./help-logic";

/**
 * The rail — the reference's `HelpRail`: where an answer lands, and who is accountable for one.
 * The backend publishes one support contact rather than a directory of offices and no typical
 * reply time, so the anchor leads with the office that answers and the light card lists what the
 * institution has actually published about reaching it.
 */
export function HelpRail({ support, institution, href }: { support: TenantContact; institution: string; href: (path: string) => string }) {
  const office = officeName(support);
  const phoneHref = support.phone ? `tel:${support.phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <>
      <AnchorCard variant="reply" label="Where answers land" figure={office}>
        <p>
          Every answer lands on this page and stays here. That’s the record. {support.hours ? `${office} reads requests ${support.hours}.` : ""}
        </p>
        <p className="reply-note">
          <Icon name="mail" size={14} /> {institution}’s emails only say that something arrived here. Reply on
          this page, not to them.
        </p>
      </AnchorCard>

      <div className="provenance-card office-card">
        <span className="panel-label">Who decides what</span>
        <p>A question is answered by the office that owns the decision. This is the office that receives yours.</p>

        <ul className="office-list">
          <li>
            <strong>{office}</strong>
            <span>Your checklist, your documents, your bill, and anything else that needs a person.</span>
            {(support.hours || support.email || support.phone) && (
              <span className="office-meta">
                {support.hours ? (
                  <>
                    <Icon name="clock" size={13} /> {support.hours}
                  </>
                ) : support.email ? (
                  <>
                    <Icon name="mail" size={13} /> {support.email}
                  </>
                ) : (
                  <>
                    <Icon name="phone" size={13} /> {support.phone}
                  </>
                )}
              </span>
            )}
          </li>
        </ul>

        {support.url ? (
          <a className="secondary-button" href={href(support.url)}>
            <Icon name="external" size={16} /> {institution}’s support site
          </a>
        ) : support.email ? (
          <a className="secondary-button" href={`mailto:${support.email}`}>
            <Icon name="mail" size={16} /> Email {office}
          </a>
        ) : phoneHref ? (
          <a className="secondary-button" href={phoneHref}>
            <Icon name="phone" size={16} /> Call {office}
          </a>
        ) : null}
      </div>
    </>
  );
}
