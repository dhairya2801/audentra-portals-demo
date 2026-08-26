"use client";
import type { AdmissionOfferSummary } from "@vv/contracts";
import StateCard from "../../design-system/patterns/StateCard.jsx";
import { PortalMark } from "../../components/portal-ui";

/**
 * Where step 1 sends her when there is nothing left to answer: a declined
 * offer, or one that lapsed. Neither reading blames her and neither offers
 * the two answers back. Only Admissions reopens a decision, so Admissions is
 * the only thing on the screen.
 */
export function ClosedOffer({
  offer,
  institution,
  deadline,
  admissions,
}: {
  offer: AdmissionOfferSummary;
  institution: string;
  deadline: string;
  admissions: { label: string; href: string | null };
}) {
  const declined = offer.status === "declined";

  return (
    <div className="closed-offer">
      <PortalMark />

      <StateCard
        variant={declined ? "empty" : "error"}
        icon={declined ? "check" : "clock"}
        title={declined ? "Your answer is recorded" : "This offer has closed"}
        action={
          admissions.href
            ? {
                label: `Write to ${admissions.label}`,
                icon: "mail",
                onClick: () => window.location.assign(admissions.href as string),
              }
            : undefined
        }
      >
        {declined ? (
          <>
            You told {institution} that you would not be joining, and your place has gone to somebody
            else. If that was a mistake, Admissions is the only office that can look at it, and the
            sooner you ask the better.
          </>
        ) : (
          <>
            The deadline to answer was {deadline} and no answer was recorded, so the offer for{" "}
            {offer.termName} has lapsed. If something got in the way, tell Admissions. They can say
            whether anything is still possible for this term or the next one.
          </>
        )}
      </StateCard>
    </div>
  );
}
