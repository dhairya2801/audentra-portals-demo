"use client";
import type { AdmissionOfferSummary } from "@vv/contracts";
import Button from "../../design-system/primitives/Button.jsx";
import Icon from "../../design-system/Icon.jsx";

/**
 * Step 1. She reads the offer and answers yes or no. One answer, and it gates
 * everything after it.
 *
 * The offer is a read model: what Admissions published, as label-and-value
 * rows with no control in it. The response deadline is on the band above and
 * appears nowhere on this card — one deadline per screen.
 *
 * This step has exactly two exits and they are the two answers. No
 * `Save and continue`: nine steps are locked behind this decision.
 */
export function OfferStep({
  offer,
  institution,
  deposit,
  accepting,
  onAccept,
  onDecline,
}: {
  offer: AdmissionOfferSummary;
  institution: string;
  deposit: string;
  accepting: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const accepted = offer.status === "accepted";

  return (
    <>
      <section className="offer-card">
        <p className="offer-kicker">Offer of admission</p>
        <h2 className="offer-degree">{offer.programName}</h2>
        <dl className="offer-facts">
          <div>
            <dt>Starting</dt>
            <dd>{offer.termName}</dd>
          </div>
          <div>
            <dt>Campus</dt>
            <dd>{offer.campusName}</dd>
          </div>
          <div>
            <dt>Enrollment deposit</dt>
            <dd>{deposit}</dd>
          </div>
        </dl>
      </section>

      <div className="offer-answer">
        <Button kind="primary" icon={accepted ? "arrow" : "check"} pending={accepting} onClick={onAccept}>
          {accepted ? "Continue to step 2" : `Yes, I’m joining ${institution}`}
        </Button>
        {accepted ? null : (
          <Button kind="secondary" onClick={onDecline}>
            No, I won’t be joining
          </Button>
        )}
      </div>

      <ul className="offer-after">
        <li>
          <Icon name="check" size={15} /> Saying yes opens the nine steps after this one. You can
          stop part way and come back.
        </li>
        <li>
          <Icon name="check" size={15} /> Nothing is charged today. The deposit is the last step, and
          it can be waived.
        </li>
      </ul>
    </>
  );
}
