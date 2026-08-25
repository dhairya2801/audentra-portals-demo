"use client";
import type {
  StudentDocument,
  StudentOnboardingData,
  StudentRequirementInputField,
} from "@vv/contracts";
import Card, { CardHead } from "../../design-system/primitives/Card.jsx";
import Notice from "../../design-system/patterns/Notice.jsx";
import Field from "../../design-system/primitives/Field.jsx";
import Select from "../../design-system/primitives/Select.jsx";
import { DocumentSlot } from "../document-slot";
import { CITIZENSHIP } from "../flow";
import {
  ConfiguredFields,
  type ConfiguredPage,
  type CustomValue,
} from "./ConfiguredFields";

export const PRONOUNS = [
  { value: "she/her", label: "She / her" },
  { value: "he/him", label: "He / him" },
  { value: "they/them", label: "They / them" },
];

type Citizenship = NonNullable<StudentOnboardingData["citizenshipStatus"]>;

export type DetailsProblems = Partial<
  Record<"firstName" | "lastName" | "preferredName" | "citizenshipStatus", string>
>;

/**
 * Step 2. Her name as the record will carry it, a preferred name if she
 * wants one, the status that decides which ID is accepted, and the ID.
 *
 * Which ID is decided by the citizenship status, so the screen never offers
 * a document that would be refused. The one line saying why exists because an
 * international student holding a U.S. driver's license would otherwise think
 * the product is broken.
 */
export function DetailsStep({
  institution,
  data,
  pronouns,
  coreFields,
  customPages,
  customProblems,
  problems,
  identityDocument,
  identitySentOn,
  identityMessage,
  onChange,
  onPronouns,
  onCustomChange,
  onUploaded,
  onAskHelp,
}: {
  institution: string;
  data: StudentOnboardingData;
  pronouns: string | null | undefined;
  coreFields: Map<keyof StudentOnboardingData, StudentRequirementInputField>;
  customPages: ConfiguredPage[];
  customProblems: Record<string, string | null>;
  problems: DetailsProblems;
  identityDocument: StudentDocument | null;
  identitySentOn: string | null;
  identityMessage: string | null;
  onChange: (patch: Partial<StudentOnboardingData>) => void;
  onPronouns: (value: string | null) => void;
  onCustomChange: (id: string, value: CustomValue) => void;
  onUploaded: (document: StudentDocument) => void;
  onAskHelp: () => void;
}) {
  const status = data.citizenshipStatus ? CITIZENSHIP[data.citizenshipStatus] : null;
  const rule = status ?? CITIZENSHIP.us_citizen;
  const label = (column: keyof StudentOnboardingData, fallback: string) =>
    coreFields.get(column)?.title ?? fallback;

  return (
    <>
      <Card className="asking">
        <CardHead
          kind="status"
          icon="profile"
          tone="ask"
          title="Your name"
          note={`As it appears on your ID. The Registrar holds it, and it prints on your record and your card.`}
        />
        <div className="card-body">
          <div className="field-pair">
            <Field
              label={label("firstName", "First name")}
              autoComplete="given-name"
              value={data.firstName ?? ""}
              error={problems.firstName}
              onChange={(value: string) => onChange({ firstName: value })}
            />
            <Field
              label={label("lastName", "Last name")}
              autoComplete="family-name"
              value={data.lastName ?? ""}
              error={problems.lastName}
              onChange={(value: string) => onChange({ lastName: value })}
            />
          </div>

          <Field
            label={label("preferredName", "Preferred name")}
            autoComplete="nickname"
            value={data.preferredName ?? ""}
            hint={
              data.firstName?.trim()
                ? `What ${institution}, your instructors and your card will use. Leave it blank to be called ${data.firstName.trim()}.`
                : `What ${institution}, your instructors and your card will use.`
            }
            error={problems.preferredName}
            onChange={(value: string) => onChange({ preferredName: value })}
          />

          <Select
            label="Pronouns, optional"
            value={pronouns ?? ""}
            options={[{ value: "", label: "I’d rather not say" }, ...PRONOUNS]}
            onChange={(next: string) => onPronouns(next || null)}
          />

          <Notice tone="quiet" icon="help" action={{ label: "Ask for help", onClick: onAskHelp }}>
            If the name on your offer is wrong, ask now and keep going. Nothing here holds you up,
            and the Registrar can correct the record after you are in.
          </Notice>
        </div>
      </Card>

      <Card className="asking">
        <CardHead
          kind="status"
          icon="card"
          tone="ask"
          title="Your ID"
          note={status ? `${rule.documents}. ${rule.why}` : "Choose your status first. It decides which document is accepted."}
        />
        <div className="card-body">
          <Select
            label={label("citizenshipStatus", "Citizenship status")}
            hint={problems.citizenshipStatus}
            value={data.citizenshipStatus ?? ""}
            options={[
              { value: "", label: "Choose one" },
              ...(Object.keys(CITIZENSHIP) as Citizenship[]).map((value) => ({
                value,
                label: CITIZENSHIP[value].label,
              })),
            ]}
            onChange={(next: string) =>
              onChange({
                citizenshipStatus: (next || undefined) as Citizenship | undefined,
                residencyStatus: next === "international" ? "international" : next ? "domestic" : undefined,
              })
            }
          />

          <DocumentSlot
            category="identity"
            document={identityDocument}
            sentOn={identitySentOn}
            emptyTitle="Add a photo or a scan"
            emptyLine="A clear photo of the whole document, with all four corners in frame."
            chooseLabel="Choose a file"
            onUploaded={onUploaded}
            waiting={
              <Notice tone="quiet" icon="clock">
                Review happens after you carry on. You can send it later from My Documents and finish
                this step now.
              </Notice>
            }
          />

          {identityMessage ? (
            <Notice tone="quiet" icon="info">
              {identityMessage}
            </Notice>
          ) : null}
        </div>
      </Card>

      {customPages.length > 0 ? (
        <ConfiguredFields
          pages={customPages}
          values={data.customFields ?? {}}
          data={data}
          problems={customProblems}
          onChange={onCustomChange}
        />
      ) : null}
    </>
  );
}
