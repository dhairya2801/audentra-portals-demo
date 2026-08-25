"use client";
import type {
  AdmissionOfferSummary,
  StudentDocument,
  StudentFerpaDelegate,
  StudentHousingResidence,
  StudentOnboardingData,
} from "@vv/contracts";
import { useState } from "react";
import Card, { CardHead } from "../../design-system/primitives/Card.jsx";
import ReadPanel from "../../design-system/patterns/ReadPanel.jsx";
import Signature from "../../design-system/patterns/Signature.jsx";
import Notice from "../../design-system/patterns/Notice.jsx";
import Button from "../../design-system/primitives/Button.jsx";
import Icon from "../../design-system/Icon.jsx";
import { CITIZENSHIP, RANK_NAMES, listSentence, type ScreenId } from "../flow";
import { planLabel } from "./HousingStep";
import { RELATIONSHIPS } from "../flow";
import { scopeNames } from "./PermissionsStep";
import { PRONOUNS } from "./DetailsStep";

export type SigningDocument = {
  id: string;
  title: string;
  pdf: string;
  preview: string;
  /** The line that keeps this document apart from something it could be mistaken for. */
  apart: string | null;
};

function Row({
  label,
  value,
  empty = "Not answered",
}: {
  label: string;
  value: string | null | undefined;
  empty?: string;
}) {
  const missing = value == null || value === "";
  return (
    <div className={missing ? "review-row missing" : "review-row"}>
      <dt>{label}</dt>
      <dd>{missing ? empty : value}</dd>
    </div>
  );
}

function EditAction({ onClick }: { onClick: () => void }) {
  return (
    <Button kind="text" onClick={onClick}>
      Edit
    </Button>
  );
}

/**
 * Step 9. What she told the university, and the documents enrolling asks her
 * to sign.
 *
 * An empty value reads as `Not given` or `Not answered`, never hidden: a
 * section that disappears because she left it blank is a section she cannot
 * check. Each section has its own Edit. The read indicator says `scrolled`,
 * never `read`, and the signature is locked until every document has been
 * scrolled to the end, with the sentence beside the locked control saying so.
 */
export function ReviewStep({
  institution,
  offer,
  data,
  pronouns,
  identityDocument,
  immunizationDocument,
  photoDocument,
  residences,
  delegates,
  documents,
  legalName,
  signature,
  signedOn,
  onEdit,
  onSign,
}: {
  institution: string;
  offer: AdmissionOfferSummary;
  data: StudentOnboardingData;
  pronouns: string | null | undefined;
  identityDocument: StudentDocument | null;
  immunizationDocument: StudentDocument | null;
  photoDocument: StudentDocument | null;
  residences: StudentHousingResidence[];
  delegates: StudentFerpaDelegate[];
  documents: SigningDocument[];
  legalName: string;
  signature: string;
  signedOn: string;
  onEdit: (screen: ScreenId) => void;
  onSign: (value: string) => void;
}) {
  const [scrolled, setScrolled] = useState<string[]>([]);
  const all = documents.every((doc) => scrolled.includes(doc.id));
  const first = data.emergencyContacts?.[0];

  const halls = (data.housingResidencePreferences ?? [])
    .map((value, index) => {
      const hall = residences.find((item) => item.value === value);
      return hall ? `${RANK_NAMES[index]}: ${hall.name}` : null;
    })
    .filter((line): line is string => Boolean(line));

  const address = [
    data.streetAddress,
    data.addressLine2,
    [data.city, data.stateOrProvince].filter(Boolean).join(", "),
    data.postalCode,
    data.country,
  ]
    .filter((part) => part && String(part).trim())
    .join(", ");

  const both = documents.length > 1;

  return (
    <>
      <Card className="stating">
        <CardHead kind="card" icon="award" title="Your offer" note="Accepted" />
        <div className="card-body">
          <dl className="review-list">
            <Row label="Program" value={offer.programName} />
            <Row label="Starting" value={offer.termName} />
          </dl>
        </div>
      </Card>

      <Card className="stating">
        <CardHead kind="card" icon="profile" title="About you" aside={<EditAction onClick={() => onEdit("details")} />} />
        <div className="card-body">
          <dl className="review-list">
            <Row label="Legal name" value={legalName} />
            <Row label="Preferred name" value={data.preferredName} empty="Not given (optional)" />
            <Row label="Pronouns" value={PRONOUNS.find((option) => option.value === pronouns)?.label ?? pronouns} empty="Not given (optional)" />
            <Row
              label="Citizenship status"
              value={data.citizenshipStatus ? CITIZENSHIP[data.citizenshipStatus].label : null}
            />
            <Row label="Identity document" value={identityDocument?.fileName} empty="Not sent yet" />
            <Row label="Personal email" value={data.personalEmail} />
            <Row label="Mobile number" value={data.mobilePhone} />
            <Row label="Mailing address" value={address} />
            <Row
              label={`${institution} writes first by`}
              value={data.communicationPreference === "sms" ? "Text message" : data.communicationPreference === "email" ? "Email" : null}
            />
            <Row
              label="Emergency contact"
              value={
                first?.fullName
                  ? `${first.fullName}, ${RELATIONSHIPS.find((r) => r.value === first.relationship)?.label.toLowerCase() ?? first.relationship}, ${first.mobilePhone}`
                  : null
              }
            />
          </dl>
        </div>
      </Card>

      <Card className="stating">
        <CardHead kind="card" icon="home" title="Housing" aside={<EditAction onClick={() => onEdit("housing")} />} />
        <div className="card-body">
          <dl className="review-list">
            <Row label="Your plan" value={planLabel(data.housingPreference)} />
            <Row label="Halls you ranked" value={halls.length ? halls.join(" · ") : null} empty="None ranked" />
          </dl>
        </div>
      </Card>

      <Card className="stating">
        <CardHead kind="card" icon="users" title="Your record" aside={<EditAction onClick={() => onEdit("permissions")} />} />
        <div className="card-body">
          <dl className="review-list">
            <Row
              label="Who can see your record"
              value={
                delegates.length
                  ? delegates
                      .map((delegate) => `${delegate.fullName} (${listSentence(scopeNames(delegate.scopes))})`)
                      .join(" · ")
                  : null
              }
              empty="Nobody. That is a complete answer."
            />
            <Row
              label="Accessibility Services"
              value={
                data.accommodationInterest === "not_now"
                  ? "Not right now"
                  : data.accommodationInterest
                    ? "Yes, I’d like to talk"
                    : null
              }
            />
            <Row label="Immunization record" value={immunizationDocument?.fileName} empty="Not sent yet" />
            <Row label="Student photo" value={photoDocument?.fileName} empty="Not given (optional)" />
          </dl>
        </div>
      </Card>

      <Card className="asking">
        <CardHead
          kind="status"
          icon="file"
          tone="ask"
          title={both ? "Your document packet" : "Your enrollment acknowledgment"}
          note={both ? "Scroll each one to the end." : "Scroll it to the end."}
        />
        <div className="card-body">
          {documents.map((doc) => (
            <div key={doc.id} className="sign-doc">
              {doc.apart ? (
                <Notice tone="quiet" icon="info">
                  {doc.apart}
                </Notice>
              ) : null}
              <ReadPanel
                title={doc.title}
                onEnd={() => setScrolled((done) => [...new Set([...done, doc.id])])}
              >
                <img className="sign-doc-page" src={doc.preview} alt={`${doc.title}, page 1`} />
                <p>
                  <a className="text-link" href={doc.pdf} target="_blank" rel="noreferrer">
                    Open the full document as a PDF
                  </a>
                </p>
              </ReadPanel>
            </div>
          ))}
        </div>
      </Card>

      <Card className="asking">
        <CardHead kind="status" icon="pen" tone="ask" title="Sign" />
        <div className="card-body">
          {all ? (
            <Signature
              legalName={legalName}
              value={signature}
              onChange={onSign}
              date={signedOn}
              label={both ? "Type your full legal name to sign both" : "Type your full legal name to sign"}
            />
          ) : (
            <p className="locked-reason">
              <Icon name="lock" size={15} />{" "}
              {both ? "Scroll both documents to the end to sign them." : "Scroll the document to the end to sign it."}
            </p>
          )}
        </div>
      </Card>
    </>
  );
}
