"use client";
import type { StudentDocument, StudentOnboardingData } from "@vv/contracts";
import Card, { CardHead } from "../../design-system/primitives/Card.jsx";
import ChoiceList from "../../design-system/patterns/ChoiceList.jsx";
import FieldGroup from "../../design-system/patterns/FieldGroup.jsx";
import Notice from "../../design-system/patterns/Notice.jsx";
import { DocumentSlot } from "../document-slot";

type Interest = NonNullable<StudentOnboardingData["accommodationInterest"]>;

/**
 * Step 5. No diagnosis asked, no paperwork asked for the accommodation, and
 * declining is complete.
 *
 * The two halves are not equally optional and the screen says so: the
 * question is optional, the immunization record is not — it is required
 * before term starts. Neither blocks this step.
 */
export function HealthStep({
  institution,
  value,
  immunization,
  immunizationSentOn,
  onChange,
  onUploaded,
}: {
  institution: string;
  value: Interest | undefined;
  immunization: StudentDocument | null;
  immunizationSentOn: string | null;
  onChange: (value: Interest) => void;
  onUploaded: (document: StudentDocument) => void;
}) {
  const answer = value === "not_now" ? "no" : value ? "yes" : null;

  return (
    <>
      <FieldGroup
        label="Accessibility Services"
        labelId="accommodation-label"
        footnote="Optional. Nothing about your health is sent with this."
      >
        <ChoiceList
          name="accommodation"
          labelledBy="accommodation-label"
          options={[
            [
              "yes",
              "Yes, I’d like to talk",
              "Accessibility Services gets your name. Nothing about your health goes with it.",
            ],
            [
              "no",
              "Not right now",
              "Recorded as your answer. It blocks nothing, and you can change it whenever you like.",
            ],
          ]}
          value={answer}
          onChange={(next: string) => onChange(next === "yes" ? "both" : "not_now")}
        />
      </FieldGroup>

      <Card className="asking">
        <CardHead
          kind="status"
          icon="health"
          tone="ask"
          title="Your immunization record"
          note={`Required before term starts. ${institution} Health Services holds it.`}
        />
        <div className="card-body">
          <DocumentSlot
            category="health"
            document={immunization}
            sentOn={immunizationSentOn}
            emptyTitle="Add your record"
            emptyLine="A photo or a scan of each page. A PDF, a JPEG or a PNG."
            chooseLabel="Choose a file"
            onUploaded={onUploaded}
            waiting={
              <Notice tone="quiet" icon="clock">
                This one does not hold up the step. Send it here or later from My Documents. What it
                holds up is registering for classes.
              </Notice>
            }
          />
        </div>
      </Card>
    </>
  );
}
