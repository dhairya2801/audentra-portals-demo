"use client";
import type {
  StudentDocument,
  StudentOnboardingData,
  StudentRequirementInputField,
} from "@vv/contracts";
import Card, { CardHead } from "../../design-system/primitives/Card.jsx";
import ChoiceList from "../../design-system/patterns/ChoiceList.jsx";
import FieldGroup from "../../design-system/patterns/FieldGroup.jsx";
import Notice from "../../design-system/patterns/Notice.jsx";
import Field from "../../design-system/primitives/Field.jsx";
import Select from "../../design-system/primitives/Select.jsx";
import Icon from "../../design-system/Icon.jsx";
import { DocumentSlot } from "../document-slot";
import { CITIZENSHIP } from "../flow";

export const COUNTRIES = [
  "United States",
  "Canada",
  "Mexico",
  "United Kingdom",
  "India",
  "China",
  "Brazil",
  "Other",
];

type Path = NonNullable<StudentOnboardingData["residencyVerificationPath"]>;

export type ContactProblems = Partial<
  Record<
    | "personalEmail"
    | "mobilePhone"
    | "streetAddress"
    | "city"
    | "stateOrProvince"
    | "postalCode"
    | "country"
    | "residencyVerificationPath",
    string
  >
>;

/**
 * Step 3. Where the university writes, and which way it writes first.
 *
 * The one line that survives under a field is on the mobile number, because
 * it is the only one that justifies why the number is asked for at all. The
 * address proof keeps its card because it is the one block here with a state
 * of its own; a domestic student is asked, an international student is not.
 */
export function ContactStep({
  institution,
  data,
  coreFields,
  problems,
  residencyDocument,
  residencySentOn,
  onChange,
  onUploaded,
}: {
  institution: string;
  data: StudentOnboardingData;
  coreFields: Map<keyof StudentOnboardingData, StudentRequirementInputField>;
  problems: ContactProblems;
  residencyDocument: StudentDocument | null;
  residencySentOn: string | null;
  onChange: (patch: Partial<StudentOnboardingData>) => void;
  onUploaded: (document: StudentDocument) => void;
}) {
  const label = (column: keyof StudentOnboardingData, fallback: string) =>
    coreFields.get(column)?.title ?? fallback;
  const domestic = data.citizenshipStatus
    ? CITIZENSHIP[data.citizenshipStatus].domestic
    : true;
  const path = data.residencyVerificationPath ?? null;

  return (
    <>
      <FieldGroup label={`Where ${institution} writes`}>
        <Field
          label={label("personalEmail", "Personal email")}
          type="email"
          autoComplete="email"
          value={data.personalEmail ?? ""}
          error={problems.personalEmail}
          onChange={(value: string) => onChange({ personalEmail: value })}
        />
        <Field
          label={label("mobilePhone", "Mobile number")}
          type="tel"
          autoComplete="tel"
          hint={`${institution} texts this number only for something time-critical.`}
          value={data.mobilePhone ?? ""}
          error={problems.mobilePhone}
          onChange={(value: string) => onChange({ mobilePhone: value })}
        />
      </FieldGroup>

      <FieldGroup label="Mailing address">
        <Field
          label={label("streetAddress", "Street address")}
          autoComplete="address-line1"
          value={data.streetAddress ?? ""}
          error={problems.streetAddress}
          onChange={(value: string) => onChange({ streetAddress: value })}
        />
        <Field
          label="Apartment, suite or unit, optional"
          autoComplete="address-line2"
          value={data.addressLine2 ?? ""}
          onChange={(value: string) => onChange({ addressLine2: value })}
        />
        <div className="field-pair">
          <Field
            label={label("city", "City")}
            autoComplete="address-level2"
            value={data.city ?? ""}
            error={problems.city}
            onChange={(value: string) => onChange({ city: value })}
          />
          <Field
            label={label("stateOrProvince", "State or province")}
            autoComplete="address-level1"
            value={data.stateOrProvince ?? ""}
            error={problems.stateOrProvince}
            onChange={(value: string) => onChange({ stateOrProvince: value })}
          />
        </div>
        <div className="field-pair">
          <Field
            label={label("postalCode", "Postal code")}
            autoComplete="postal-code"
            value={data.postalCode ?? ""}
            error={problems.postalCode}
            onChange={(value: string) => onChange({ postalCode: value })}
          />
          <Select
            label={label("country", "Country")}
            hint={problems.country}
            value={data.country ?? ""}
            options={[
              { value: "", label: "Choose one" },
              ...COUNTRIES.map((country) => ({ value: country, label: country })),
            ]}
            onChange={(next: string) => onChange({ country: next || undefined })}
          />
        </div>
      </FieldGroup>

      <FieldGroup
        label={`Where should ${institution} write first?`}
        labelId="channel-label"
        footnote={
          <>
            <Icon name="info" size={14} /> Whatever you pick, anything with a deadline is also
            written in the portal.
          </>
        }
      >
        <ChoiceList
          name="channel"
          labelledBy="channel-label"
          options={[
            ["email", "Email", `${institution} writes to your personal email first.`],
            ["sms", "Text message", `${institution} texts you first for anything time-critical.`],
          ]}
          value={data.communicationPreference ?? null}
          onChange={(value: "email" | "sms") => onChange({ communicationPreference: value })}
        />
      </FieldGroup>

      {domestic ? (
        <Card className="asking">
          <CardHead
            kind="status"
            icon="home"
            tone="ask"
            title="Proof of your address"
            note="How the Registrar confirms where you live. Residency decides tuition, so it is checked once."
          />
          <div className="card-body">
            <ChoiceList
              name="residency-path"
              labelledBy="residency-path-label"
              options={[
                [
                  "home_address_review",
                  "Review the address above",
                  "The Registrar checks it against your application. Nothing to send.",
                ],
                [
                  "document_upload",
                  "Send a document",
                  "A utility bill, a bank statement, a lease, or a driver’s license showing this address.",
                ],
                [
                  "advisor_review",
                  "Talk it through with an advisor",
                  "If your situation is not simple. An advisor writes to you after this step.",
                ],
              ]}
              value={path}
              onChange={(value: Path) => onChange({ residencyVerificationPath: value })}
            />
            {problems.residencyVerificationPath ? (
              <p className="field-foot">
                <Icon name="alert" size={14} /> {problems.residencyVerificationPath}
              </p>
            ) : null}

            {path === "document_upload" ? (
              <DocumentSlot
                category="residency"
                document={residencyDocument}
                sentOn={residencySentOn}
                emptyTitle="Add a photo or a scan"
                emptyLine="Dated in the last three months, with your name and this address on it."
                chooseLabel="Choose a file"
                onUploaded={onUploaded}
                waiting={
                  <Notice tone="quiet" icon="clock">
                    Review happens after you carry on. You can send it later from My Documents.
                  </Notice>
                }
              />
            ) : null}
          </div>
        </Card>
      ) : null}
    </>
  );
}
