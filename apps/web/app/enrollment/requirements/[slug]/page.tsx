"use client";

import type {
  HousingPreference,
  HousingResidenceOption,
  StudentDashboard,
  StudentDocument,
  StudentHousingPlan,
  StudentPaymentList,
  StudentProfile,
  StudentRequirementDetail,
  StudentRequirementSummary,
  UpdateStudentHousingPlanInput,
  UpdateStudentProfileInput,
} from "@vv/contracts";
import { studentRequirementSlug } from "@vv/contracts";
import { useParams, useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Icon from "../../../design-system/Icon.jsx";
import Card, { CardFoot, CardHead, CardRows } from "../../../design-system/primitives/Card.jsx";
import Button, { IconButton } from "../../../design-system/primitives/Button.jsx";
import Field from "../../../design-system/primitives/Field.jsx";
import StatedField from "../../../design-system/primitives/StatedField.jsx";
import StatusPill from "../../../design-system/primitives/StatusPill.jsx";
import AnchorCard from "../../../design-system/primitives/AnchorCard.jsx";
import Avatar from "../../../design-system/primitives/Avatar.jsx";
import PlaceTile from "../../../design-system/primitives/PlaceTile.jsx";
import Tooltip from "../../../design-system/primitives/Tooltip.jsx";
import EdwardAsk from "../../../design-system/patterns/EdwardAsk.jsx";
import EntryRow from "../../../design-system/patterns/EntryRow.jsx";
import Notice from "../../../design-system/patterns/Notice.jsx";
import PageError from "../../../design-system/patterns/PageError.jsx";
import PageSkeleton from "../../../design-system/patterns/PageSkeleton.jsx";
import StateCard from "../../../design-system/patterns/StateCard.jsx";
import { openEdward } from "../../../design-lib/door.js";
import { FerpaAccessCenter } from "../../../components/ferpa-access-center";
import { PointsInfoModal } from "../../../components/points-popover";
import { PortalShell } from "../../../components/portal-shell";
import { TenantLink as Link } from "../../../components/tenant-link";
import { RequirementExtractReview } from "../../../components/requirement-extract-review";
import {
  RequirementHelpRequest,
  RequirementHelpRequestedStatus,
} from "../../../components/requirement-help-request";
import {
  ChoiceOption,
  FieldShell,
  RequirementResponseAction,
} from "../../../components/requirement-response-action";
import { RequirementUpload } from "../../../components/requirement-upload";
import { useApiAction, useApiResource } from "../../../hooks/use-api-resource";
import {
  getStudentAcademics,
  createDepositPayment,
  getStudentBootstrap,
  getStudentDashboard,
  getStudentHousingPlan,
  getStudentDocuments,
  getStudentDocumentProfilePhoto,
  getStudentProfile,
  getStudentPayments,
  getStudentRequirement,
  getStudentRequirements,
  updateStudentHousingPlan,
  updateStudentRequirementProfile,
} from "../../../lib/api-client";
import {
  beginDocumentExtractionProjection,
  currentDocumentProjection,
  reconcileDocumentExtractionProjection,
  type DocumentExtractionProjectionState,
} from "../../../lib/document-extraction-ui";
import { kindIcon, requirementKind, type RequirementKind } from "../../../lib/requirement-kind";
import { useTenant } from "../../../components/tenant-provider";
import {
  formatTenantDate,
  formatTenantMoney,
  type TenantConfig,
} from "../../../lib/tenant";

const terminalRequirementStatuses = new Set([
  "completed",
  "waived",
  "not_applicable",
]);

type ResidenceOption = Exclude<HousingResidenceOption, null>;

const housingChoices: Array<{
  value: HousingPreference;
  title: string;
  description: string;
}> = [
  {
    value: "on_campus",
    title: "On campus",
    description: "Live in an {institution} residence community.",
  },
  {
    value: "off_campus",
    title: "Off campus",
    description: "Arrange housing independently in the city.",
  },
  {
    value: "commuting",
    title: "Commuting",
    description: "Plan parking, transit, and time between classes.",
  },
  {
    value: "undecided",
    title: "Still deciding",
    description: "Keep your plans open for now.",
  },
  {
    value: "family",
    title: "Family or dependent housing",
    description: "Connect with family-friendly housing guidance.",
  },
];

type HousingPreviewSelection = {
  preference: HousingPreference;
  residenceOption: ResidenceOption | null;
};

type ExpandedStudentHousingPlan = StudentHousingPlan & {
  residencePreferences?: ResidenceOption[];
  roomType?: string | null;
  bathroomPreference?: string | null;
  roommateMatching?: string | null;
  knownRoommateName?: string | null;
  knownRoommateEmail?: string | null;
  sleepSchedule?: string | null;
  studyHabits?: string | null;
  roomNoise?: string | null;
  cleanliness?: string | null;
  guestPreference?: string | null;
  temperaturePreference?: string | null;
  smokeVapeCompatibility?: string | null;
  substanceFreeHousing?: boolean | null;
  genderInclusiveHousing?: boolean | null;
  accessibleHousingInformation?: boolean | null;
  livingLearningCommunities?: string[];
};

type ExpandedUpdateStudentHousingPlanInput = UpdateStudentHousingPlanInput &
  Omit<ExpandedStudentHousingPlan, keyof StudentHousingPlan | "version" | "updatedAt">;

const housingCompatibilityFields = [
  ["sleepSchedule", "Sleep schedule", [["early", "Early bird"], ["middle", "Usually 11–1"], ["night", "Night owl"], ["changes", "It changes"]]],
  ["studyHabits", "Study habits", [["room", "Mostly in my room"], ["elsewhere", "Mostly elsewhere"], ["mix", "A mix"], ["late_room", "Late-night room study"]]],
  ["roomNoise", "Room noise", [["quiet", "Usually quiet"], ["headphones", "Music with headphones"], ["background", "Background sound"], ["social", "Lively and social"]]],
  ["cleanliness", "Cleanliness", [["everything_in_place", "Everything in place"], ["tidy", "Tidy but lived-in"], ["relaxed", "Pretty relaxed"]]],
  ["guestPreference", "Guests", [["rarely", "Rarely"], ["notice", "Sometimes, with notice"], ["active", "I like an active room"]]],
  ["temperaturePreference", "Temperature", [["cool", "Cool"], ["middle", "In the middle"], ["warm", "Warm"]]],
  ["smokeVapeCompatibility", "Roommate substance preference", [["smoke_free", "Substance-free roommate"], ["off_campus_only", "Okay if use is only off campus"], ["no_preference", "No preference"]]],
] as const;

const livingLearningCommunityOptions = [
  ["first_year_launch", "First-Year Launch"],
  ["honors_house", "Honors House"],
  ["stem_innovation", "STEM + Innovation"],
  ["arts_collective", "Arts Collective"],
  ["wellbeing_commons", "Wellbeing Commons"],
  ["substance_free_living", "Substance-Free Living"],
] as const;

const expectedDocumentType = {
  consent: "ferpa",
  financial_aid: "financial_aid",
  health: "immunization",
  identity: "identity",
  other: "other",
  residency: "residency",
  transcript: "transcript",
} as const;

function nullableFormValue(form: FormData, name: string) {
  const value = String(form.get(name) ?? "").trim();
  return value || null;
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDueDate(value: string | null, tenant: TenantConfig) {
  if (!value) return "No due date";
  return formatTenantDate(value, tenant, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function shortDue(value: string | null, tenant: TenantConfig) {
  if (!value) return null;
  return formatTenantDate(value, tenant, { month: "short", day: "numeric" });
}

function requirementPath(slug: string) {
  return `/enrollment/requirements/${encodeURIComponent(slug)}`;
}

/** The pill the head wears — the reference `StatusPill` tones over the
 *  platform's requirement status. */
function statusPill(status: StudentRequirementDetail["status"], office: string) {
  switch (status) {
    case "completed":
      return { tone: "done", label: "Completed", pulse: false };
    case "waived":
      return { tone: "done", label: "Waived", pulse: false };
    case "not_applicable":
      return { tone: "quiet", label: "Not needed", pulse: false };
    case "submitted":
      return { tone: "wait", label: `With ${office}`, pulse: true };
    case "under_review":
      return { tone: "wait", label: "In review", pulse: true };
    case "in_progress":
      return { tone: "progress", label: "In progress", pulse: false };
    case "blocked":
      return { tone: "quiet", label: "Locked", pulse: false };
    case "help_requested":
      return { tone: "wait", label: "Help requested", pulse: true };
    case "rejected":
      return { tone: "stop", label: "Came back", pulse: false };
    case "expired":
      return { tone: "stop", label: "Expired", pulse: false };
    default:
      return { tone: undefined, label: "Open", pulse: false };
  }
}

function statusSentence(
  requirement: StudentRequirementDetail,
  tenant: TenantConfig,
) {
  switch (requirement.status) {
    case "completed":
      return "Recorded on your enrollment record.";
    case "waived":
      return `${requirement.responsibleOffice} waived this step for you.`;
    case "not_applicable":
      return "This step does not apply to you.";
    case "submitted":
    case "under_review":
      return `${requirement.responsibleOffice} is checking what you sent.`;
    case "blocked":
      return "Opens when the step before it is done.";
    case "rejected":
      return `${requirement.responsibleOffice} sent this back. Look at what they need and send it again.`;
    case "expired":
      return "The window for this step has closed.";
    case "help_requested":
      return `Your question is with ${tenant.shortName}.`;
    default:
      return requirement.dueAt
        ? `Due ${formatDueDate(requirement.dueAt, tenant)}.`
        : "No fixed due date.";
  }
}

function InlineLoading({ label }: { label: string }) {
  return (
    <Notice tone="working" icon="clock">
      {label}
    </Notice>
  );
}

function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <StateCard
      variant="error"
      size="compact"
      title="This part did not load"
      action={onRetry ? { label: "Try again", icon: "refresh", onClick: onRetry } : undefined}
    >
      {message}
    </StateCard>
  );
}

function ActionResult({
  status,
  error,
  success,
}: {
  status: "idle" | "loading" | "success" | "error";
  error?: string | null;
  success: string;
}) {
  if (status === "error") {
    return (
      <Notice tone="urgent" icon="alert" title="That did not save">
        {error}
      </Notice>
    );
  }
  if (status === "success") {
    return (
      <Notice tone="done" icon="check" title="Saved">
        {success}
      </Notice>
    );
  }
  return null;
}

function ProfileActionForm({
  profile,
  requirementId,
  onSaved,
}: {
  profile: StudentProfile;
  requirementId: string;
  onSaved: (profile: StudentProfile) => void;
}) {
  const { tenant } = useTenant();
  const [preferredName, setPreferredName] = useState(profile.preferredName);
  const [pronouns, setPronouns] = useState(profile.pronouns || "");
  const [mobilePhone, setMobilePhone] = useState(profile.mobilePhone || "");
  const [communicationPreference, setCommunicationPreference] = useState<
    "email" | "sms"
  >(profile.communicationPreference);
  const [version, setVersion] = useState(profile.version);
  const [touched, setTouched] = useState(false);
  const saveProfile = useApiAction(
    useCallback(
      (input: UpdateStudentProfileInput) =>
        updateStudentRequirementProfile(requirementId, input),
      [requirementId],
    ),
  );
  const nameError =
    touched && preferredName.trim() === "" ? "Tell us what to call you." : undefined;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (preferredName.trim() === "") return;
    saveProfile.reset();

    try {
      const saved = await saveProfile.run({
        expectedVersion: version,
        preferredName: preferredName.trim(),
        pronouns: pronouns.trim() || null,
        mobilePhone: mobilePhone.trim() || null,
        communicationPreference,
      });
      setVersion(saved.version);
      onSaved(saved);
    } catch {
      // The local form stays in place so the student can fix or retry it.
    }
  };

  return (
    <form className="requirement-form" onSubmit={submit} noValidate>
      {profile.firstName || profile.lastName ? (
        <StatedField
          label="Legal name"
          value={[profile.firstName, profile.lastName].filter(Boolean).join(" ")}
          office="The Registrar"
        />
      ) : null}
      <Field
        label="Preferred name"
        value={preferredName}
        autoComplete="nickname"
        error={nameError}
        hint={`What ${tenant.shortName} calls you in messages and on your ID.`}
        onChange={setPreferredName}
      />
      <Field
        label="Pronouns · optional"
        value={pronouns}
        hint="For example: she/her"
        onChange={setPronouns}
      />
      <Field
        label="Mobile number · optional"
        type="tel"
        autoComplete="tel"
        value={mobilePhone}
        onChange={setMobilePhone}
      />
      <p className="field-label">Where {tenant.shortName} writes first</p>
      <div className="choice-panel" role="radiogroup" aria-label="Preferred communication">
        <ChoiceOption
          type="radio"
          name="communicationPreference"
          value="email"
          title="Email"
          note={profile.email || "Your student email"}
          checked={communicationPreference === "email"}
          onChange={() => setCommunicationPreference("email")}
        />
        <ChoiceOption
          type="radio"
          name="communicationPreference"
          value="sms"
          title="Text message"
          note={mobilePhone.trim() ? mobilePhone : "Add a mobile number above"}
          checked={communicationPreference === "sms"}
          onChange={() => setCommunicationPreference("sms")}
        />
      </div>
      <p className="form-help">You can edit these details anytime from your profile.</p>
      <ActionResult
        status={saveProfile.status}
        error={saveProfile.message}
        success="Your details are saved and this step is updated."
      />
      <Button kind="primary" icon="arrow" full type="submit" pending={saveProfile.status === "loading"}>
        Save details
      </Button>
    </form>
  );
}

function ProfileAction({
  requirementId,
  onSaved,
}: {
  requirementId: string;
  onSaved: (profile: StudentProfile) => void;
}) {
  const loadProfile = useCallback(
    (signal: AbortSignal) => getStudentProfile(signal),
    [],
  );
  const profile = useApiResource(loadProfile);

  if (profile.status === "loading") {
    return <InlineLoading label="Loading what you can change here…" />;
  }
  if (profile.status === "error") {
    return <InlineError message={profile.error} onRetry={profile.reload} />;
  }

  return (
    <ProfileActionForm
      key={profile.data.version}
      profile={profile.data}
      requirementId={requirementId}
      onSaved={onSaved}
    />
  );
}

function HousingActionForm({
  plan,
  onSaved,
  onPreviewChange,
}: {
  plan: StudentHousingPlan;
  onSaved: (plan: StudentHousingPlan) => void;
  onPreviewChange: (selection: HousingPreviewSelection) => void;
}) {
  const tenantRuntime = useTenant();
  const expandedPlan = plan as ExpandedStudentHousingPlan;
  const [preference, setPreference] = useState<HousingPreference | null>(
    plan.preference,
  );
  const [residenceOption, setResidenceOption] = useState<ResidenceOption | null>(
    plan.residenceOption,
  );
  const [residencePreferences, setResidencePreferences] = useState<ResidenceOption[]>(
    () =>
      expandedPlan.residencePreferences?.length
        ? [...expandedPlan.residencePreferences]
        : plan.residenceOption
          ? [plan.residenceOption]
          : [],
  );
  const [version, setVersion] = useState(plan.version);
  const [roommateMatching, setRoommateMatching] = useState(
    expandedPlan.roommateMatching ?? "",
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const saveHousing = useApiAction(
    useCallback(
      (input: ExpandedUpdateStudentHousingPlanInput) =>
        updateStudentHousingPlan(input),
      [],
    ),
  );
  useEffect(() => {
    if (!preference) return;
    onPreviewChange({
      preference,
      residenceOption: preference === "on_campus" ? residenceOption : null,
    });
  }, [onPreviewChange, preference, residenceOption]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!preference) return;
    saveHousing.reset();
    const form = new FormData(event.currentTarget);

    try {
      const saved = await saveHousing.run({
        expectedVersion: version,
        preference,
        ...(preference === "on_campus" && residenceOption
          ? {
              residenceOption,
            }
          : {}),
        residencePreferences:
          preference === "on_campus" ? residencePreferences : [],
        roomType:
          preference === "on_campus" ? nullableFormValue(form, "roomType") : null,
        bathroomPreference:
          preference === "on_campus"
            ? nullableFormValue(form, "bathroomPreference")
            : null,
        roommateMatching:
          preference === "on_campus"
            ? nullableFormValue(form, "roommateMatching")
            : null,
        knownRoommateName:
          preference === "on_campus" && roommateMatching === "known_roommate"
            ? nullableFormValue(form, "knownRoommateName")
            : null,
        knownRoommateEmail:
          preference === "on_campus" && roommateMatching === "known_roommate"
            ? nullableFormValue(form, "knownRoommateEmail")?.toLowerCase() ?? null
            : null,
        sleepSchedule:
          preference === "on_campus"
            ? nullableFormValue(form, "sleepSchedule")
            : null,
        studyHabits:
          preference === "on_campus" ? nullableFormValue(form, "studyHabits") : null,
        roomNoise:
          preference === "on_campus" ? nullableFormValue(form, "roomNoise") : null,
        cleanliness:
          preference === "on_campus" ? nullableFormValue(form, "cleanliness") : null,
        guestPreference:
          preference === "on_campus"
            ? nullableFormValue(form, "guestPreference")
            : null,
        temperaturePreference:
          preference === "on_campus"
            ? nullableFormValue(form, "temperaturePreference")
            : null,
        smokeVapeCompatibility:
          preference === "on_campus"
            ? nullableFormValue(form, "smokeVapeCompatibility")
            : null,
        substanceFreeHousing:
          preference === "on_campus" && form.has("substanceFreeHousing"),
        genderInclusiveHousing:
          preference === "on_campus" && form.has("genderInclusiveHousing"),
        accessibleHousingInformation:
          preference === "on_campus" && form.has("accessibleHousingInformation"),
        livingLearningCommunities:
          preference === "on_campus"
            ? form.getAll("livingLearningCommunities").map(String)
            : [],
      });
      setVersion(saved.version);
      setPreference(saved.preference);
      setResidenceOption(saved.residenceOption);
      setResidencePreferences(
        saved.residencePreferences?.length
          ? [...saved.residencePreferences]
          : saved.residenceOption
            ? [saved.residenceOption]
            : [],
      );
      setRoommateMatching(saved.roommateMatching ?? "");
      onSaved(saved);
    } catch {
      // Leave the selected choices intact so the student can retry.
    }
  };

  return (
    <form className="requirement-form" onSubmit={submit}>
      <p className="field-label">Where you will live</p>
      <div className="choice-panel" role="radiogroup" aria-label="Where you will live">
        {housingChoices.map((choice) => (
          <ChoiceOption
            key={choice.value}
            type="radio"
            name="housing-preference"
            value={choice.value}
            required
            title={choice.title}
            note={tenantRuntime.copy(choice.description)}
            checked={preference === choice.value}
            onChange={() => {
              setPreference(choice.value);
              if (choice.value !== "on_campus") {
                setResidenceOption(null);
                setResidencePreferences([]);
              }
            }}
          />
        ))}
      </div>
      <p className="form-help">
        Your housing path is required. Residence and room details can be decided
        later.
      </p>
      {preference === "on_campus" ? (
        <>
          <p className="field-label spaced">A residence you would like · optional</p>
          <div className="choice-panel" role="radiogroup" aria-label="Residence style">
            {plan.residences.map((option) => (
              <ChoiceOption
                key={option.value}
                type="radio"
                name="residence-option"
                value={option.value}
                title={option.name}
                note={option.description}
                checked={residenceOption === option.value}
                onChange={() => {
                  setResidenceOption(option.value);
                  setResidencePreferences((current) => [
                    option.value,
                    ...current.filter((value) => value !== option.value),
                  ].slice(0, 3));
                }}
              />
            ))}
          </div>
          {residenceOption ? (
            <button
              className="skip-link"
              type="button"
              onClick={() => {
                setResidenceOption(null);
                setResidencePreferences([]);
              }}
            >
              Clear my residence choice and decide later
            </button>
          ) : (
            <p className="form-help">
              Leave every residence unselected to save your on-campus plan and
              decide later.
            </p>
          )}

          <button
            className="skip-link"
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((value) => !value)}
          >
            {moreOpen ? "Hide room and roommate preferences" : "Add room and roommate preferences · optional"}
          </button>

          <div className={moreOpen ? "housing-more requirement-form" : "housing-more visually-hidden"}>
            <FieldShell label="Room type">
              <select name="roomType" defaultValue={expandedPlan.roomType ?? ""}>
                <option value="">Decide later</option>
                <option value="single">Single</option>
                <option value="double">Double</option>
                <option value="triple">Triple</option>
                <option value="quad">Quad</option>
                <option value="suite">Suite</option>
                <option value="no_preference">No preference</option>
              </select>
            </FieldShell>
            <FieldShell label="Bathroom">
              <select
                name="bathroomPreference"
                defaultValue={expandedPlan.bathroomPreference ?? ""}
              >
                <option value="">Decide later</option>
                <option value="shared_floor">Shared floor bathroom</option>
                <option value="suite">Suite bathroom</option>
                <option value="private">Private bathroom</option>
                <option value="no_preference">No preference</option>
              </select>
            </FieldShell>
            <FieldShell label="Roommate matching">
              <select
                name="roommateMatching"
                value={roommateMatching}
                onChange={(event) => setRoommateMatching(event.target.value)}
              >
                <option value="">Decide later</option>
                <option value="match_preferences">Match me from my preferences</option>
                <option value="known_roommate">I know my roommate</option>
                <option value="browse_later">Let me browse profiles later</option>
              </select>
            </FieldShell>
            {roommateMatching === "known_roommate" ? (
              <>
                <FieldShell label="Roommate full name">
                  <input
                    name="knownRoommateName"
                    defaultValue={expandedPlan.knownRoommateName ?? ""}
                    autoComplete="name"
                    maxLength={160}
                  />
                </FieldShell>
                <FieldShell label="Roommate email">
                  <input
                    name="knownRoommateEmail"
                    type="email"
                    defaultValue={expandedPlan.knownRoommateEmail ?? ""}
                    autoComplete="email"
                    maxLength={254}
                  />
                </FieldShell>
              </>
            ) : null}
            <p className="field-label spaced">Shared-space compatibility</p>
            <p className="form-help">
              Honest routine preferences help Housing make a compatible placement.
            </p>
            {housingCompatibilityFields.map(([name, label, options]) => (
              <FieldShell label={label} key={name}>
                <select name={name} defaultValue={String(expandedPlan[name] ?? "")}>
                  <option value="">Decide later</option>
                  {options.map(([value, optionLabel]) => (
                    <option value={value} key={value}>{optionLabel}</option>
                  ))}
                </select>
              </FieldShell>
            ))}
            <p className="field-label spaced">Communities</p>
            <div className="choice-panel tight" role="group" aria-label="Community preferences">
              {[
                ["substanceFreeHousing", "Substance-free floor or community", expandedPlan.substanceFreeHousing],
                ["genderInclusiveHousing", "Gender-inclusive housing", expandedPlan.genderInclusiveHousing],
                ["accessibleHousingInformation", "Accessible housing information", expandedPlan.accessibleHousingInformation],
              ].map(([name, label, checked]) => (
                <ChoiceOption
                  key={String(name)}
                  type="checkbox"
                  name={String(name)}
                  value="true"
                  title={String(label)}
                  defaultChecked={checked === true}
                />
              ))}
            </div>
            <p className="field-label spaced">Living-learning communities</p>
            <div className="choice-panel tight" role="group" aria-label="Living-learning communities">
              {livingLearningCommunityOptions.map(([value, label]) => (
                <ChoiceOption
                  key={value}
                  type="checkbox"
                  name="livingLearningCommunities"
                  value={value}
                  title={label}
                  defaultChecked={expandedPlan.livingLearningCommunities?.includes(value)}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}
      <ActionResult
        status={saveHousing.status}
        error={saveHousing.message}
        success="Your housing plan is saved and reflected in your enrollment record."
      />
      <Button
        kind="primary"
        icon="arrow"
        full
        type="submit"
        disabled={!preference}
        pending={saveHousing.status === "loading"}
      >
        Save housing plan
      </Button>
    </form>
  );
}

function HousingAction({
  onSaved,
  onPreviewChange,
}: {
  onSaved: (plan: StudentHousingPlan) => void;
  onPreviewChange: (selection: HousingPreviewSelection) => void;
}) {
  const loadHousing = useCallback(
    (signal: AbortSignal) => getStudentHousingPlan(signal),
    [],
  );
  const housing = useApiResource(loadHousing);

  if (housing.status === "loading") {
    return <InlineLoading label="Loading your housing choices…" />;
  }
  if (housing.status === "error") {
    return <InlineError message={housing.error} onRetry={housing.reload} />;
  }

  return (
    <HousingActionForm
      key={housing.data.version}
      plan={housing.data}
      onSaved={onSaved}
      onPreviewChange={onPreviewChange}
    />
  );
}

function DocumentAction({
  requirement,
  unlocks,
  onUploaded,
  onDocumentMutated,
  onDocumentSelected,
  documentOverride,
  documentOverrideProjection,
}: {
  requirement: StudentRequirementDetail;
  unlocks: StudentRequirementSummary[];
  onUploaded: (document: StudentDocument) => void;
  /** A mutation response (upload, retry, confirm) — the parent that owns a
   *  projection begins a new one from it, as the old rail panel did. */
  onDocumentMutated?: (document: StudentDocument) => void;
  onDocumentSelected?: (document: StudentDocument | null) => void;
  documentOverride?: StudentDocument | null;
  documentOverrideProjection?: DocumentExtractionProjectionState | null;
}) {
  const { tenant } = useTenant();
  const [recentDocument, setRecentDocument] =
    useState<StudentDocument | null>(null);
  const onUploadedRef = useRef(onUploaded);
  const notifiedTerminalDocuments = useRef(new Set<string>());
  useEffect(() => {
    onUploadedRef.current = onUploaded;
  }, [onUploaded]);
  const loadDocuments = useCallback(
    (signal: AbortSignal) => getStudentDocuments(signal),
    [],
  );
  const documents = useApiResource(loadDocuments);
  const latestStoredDocument = useMemo(() => {
    const matchingDocuments =
      documents.status === "ready"
        ? documents.data.items.filter(
            (document) => document.requirementId === requirement.id,
          )
        : [];

    return matchingDocuments.reduce<StudentDocument | null>(
      (latest, document) => {
        if (!latest) return document;
        return Date.parse(document.createdAt) > Date.parse(latest.createdAt)
          ? document
          : latest;
      },
      null,
    );
  }, [documents.data, documents.status, requirement.id]);
  const requirementDocumentOverride =
    documentOverride?.requirementId === requirement.id ? documentOverride : null;
  const requirementDocumentOverrideProjection =
    documentOverrideProjection?.document.id === requirementDocumentOverride?.id
      ? documentOverrideProjection
      : null;
  let serverDocument = currentDocumentProjection(
    latestStoredDocument,
    requirementDocumentOverride,
  );
  if (
    requirementDocumentOverride &&
    requirementDocumentOverrideProjection &&
    latestStoredDocument?.id === requirementDocumentOverride.id
  ) {
    serverDocument = reconcileDocumentExtractionProjection(
      requirementDocumentOverrideProjection,
      latestStoredDocument,
    ).document;
  }
  const recentRequirementDocument =
    recentDocument?.requirementId === requirement.id
      ? recentDocument
      : null;
  // Once the parent owns a retry projection, preserve the reconciled server
  // object so an observed processing response advances that projection. The
  // local mutation response remains the fallback before the parent update is
  // committed (and for non-transcript document actions).
  const selectedDocument = requirementDocumentOverrideProjection
    ? serverDocument
    : currentDocumentProjection(serverDocument, recentRequirementDocument);
  const extraction = selectedDocument?.extraction;
  useEffect(() => {
    onDocumentSelected?.(selectedDocument);
  }, [onDocumentSelected, selectedDocument]);

  useEffect(() => {
    if (
      !selectedDocument?.extraction ||
      selectedDocument.extraction.status === "processing"
    ) {
      return;
    }
    const terminalKey = `${selectedDocument.id}:${selectedDocument.extraction.status}:${selectedDocument.extraction.processedAt ?? ""}`;
    if (notifiedTerminalDocuments.current.has(terminalKey)) return;
    notifiedTerminalDocuments.current.add(terminalKey);
    onUploadedRef.current(selectedDocument);
  }, [selectedDocument]);

  const rememberDocument = (document: StudentDocument) => {
    if (document.extraction?.status !== "processing") {
      notifiedTerminalDocuments.current.add(
        `${document.id}:${document.extraction?.status ?? "none"}:${document.extraction?.processedAt ?? ""}`,
      );
    }
    setRecentDocument(document);
    onDocumentMutated?.(document);
    onDocumentSelected?.(document);
    documents.refresh();
    onUploadedRef.current(document);
  };
  const category = requirement.documentCategory;
  const edwardLine =
    category === "transcript"
      ? "Edward reads the transcript, builds your course record and starts advisory course matching. You do not need to classify it."
      : category === "identity"
        ? "Edward identifies the document and locates the portrait for your private student-ID preview."
        : category === "financial_aid"
          ? "Edward only checks that each file is a financial-aid document before it reaches the review queue. No financial figures are extracted."
          : `The originals are stored securely and routed straight to ${requirement.responsibleOffice} for review.`;
  const policy = requirement.immunizationPolicy;

  return (
    <>
      <section className="document-brief">
        <h3>What {tenant.shortName} needs</h3>
        <p>
          {category === "transcript"
            ? "Every page or file that belongs to your academic record."
            : category === "identity"
              ? "Every side of your identity document, together."
              : "Every file that supports this step, together."}
        </p>
        <p className="document-why">
          <Icon name="info" size={14} /> {edwardLine}
        </p>
        <p className="document-accepts">PDF, JPG or PNG · up to 10 MB each · up to 8 files</p>
        {unlocks.length > 0 ? (
          <p className="document-unblocks">
            <Icon name="lock" size={14} />{" "}
            {unlocks.length === 1
              ? `Unlocks “${unlocks[0].title}”.`
              : `Unlocks ${unlocks.length} more steps, starting with “${unlocks[0].title}”.`}
          </p>
        ) : null}
      </section>

      {policy ? (
        <section className="extract-review" aria-labelledby="immunization-policy-title">
          <div className="extract-head">
            <h3 id="immunization-policy-title">What Edward checks · {policy.name}</h3>
            <p className="extract-note">
              Policy {policy.code}, version {policy.version}. Health Services makes
              the final determination.
            </p>
          </div>
          <ul className="extract-fields">
            {policy.requirements.map((item) => (
              <li key={item.id} className="extract-field open">
                <label>
                  {item.name}
                  {item.required ? " · required" : " · optional"}
                </label>
                <span className="extract-read">
                  {item.description}
                  {item.doseCount
                    ? ` · ${item.doseCount} documented ${item.doseCount === 1 ? "dose" : "doses"}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {documents.status === "loading" ? (
        <InlineLoading label="Checking for something you already sent…" />
      ) : documents.status === "error" ? (
        <InlineError
          message={`We could not restore your existing document record. ${documents.error}`}
          onRetry={documents.reload}
        />
      ) : (
        <RequirementUpload
          requirementId={requirement.id}
          categoryHint={requirement.documentCategory ?? undefined}
          activeDocument={selectedDocument}
          onUploaded={rememberDocument}
        />
      )}

      {documents.refreshError && extraction?.status === "processing" ? (
        <Notice
          tone="working"
          icon="clock"
          title="Waiting for a connection"
          action={{ label: "Check now", icon: "refresh", onClick: documents.refresh }}
        >
          Your original is safely stored. This page retries on its own when the
          connection returns.
        </Notice>
      ) : null}

      {selectedDocument && extraction ? (
        <section className="document-check" aria-label="Edward’s document check">
          <RequirementExtractReview
            key={`${selectedDocument.id}:${extraction.status}:${extraction.processedAt ?? ""}`}
            document={selectedDocument}
            expectedType={category ? expectedDocumentType[category] : null}
            onDocumentChanged={rememberDocument}
          />
        </section>
      ) : null}
    </>
  );
}

function SecuredProfilePhoto({
  documentId,
  name,
}: {
  documentId: string;
  name: string;
}) {
  const [loadedPhoto, setLoadedPhoto] = useState<{
    documentId: string;
    source: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    void getStudentDocumentProfilePhoto(documentId, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setLoadedPhoto({ documentId, source: objectUrl });
      })
      .catch(() => {
        // Keep an identity preview private if the current delegate session no
        // longer has document/profile access or was revoked while loading.
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId]);

  return (
    <Avatar
      person={{
        name,
        photo: loadedPhoto?.documentId === documentId ? loadedPhoto.source : undefined,
      }}
      size="xl"
      alone
    />
  );
}

function IdentityPreview({ canViewProfilePhoto }: { canViewProfilePhoto: boolean }) {
  const { tenant } = useTenant();
  const loadIdentityPreview = useCallback(
    async (signal: AbortSignal) => {
      const [profile, documents] = await Promise.all([
        getStudentProfile(signal),
        getStudentDocuments(signal),
      ]);
      return { profile, documents };
    },
    [],
  );
  const preview = useApiResource(loadIdentityPreview);
  const student = preview.status === "ready" ? preview.data.profile : null;
  const photoDocument =
    preview.status === "ready"
      ? preview.data.documents.items.find(
          (document) =>
            document.category === "identity" &&
            document.extraction?.status === "completed" &&
            document.extraction.visualRegions?.some(
              (region) => region.kind === "profile_photo",
            ),
        )
      : null;
  const maskedId = student?.studentId ? student.studentId.slice(-4) : null;
  const name = student?.preferredName || "Your name";

  return (
    <Card aria-labelledby="identity-preview-title">
      <CardHead
        kind="status"
        icon="student"
        title="Your ID preview"
        titleId="identity-preview-title"
        note={
          photoDocument
            ? "Portrait found in your identity document"
            : "Appears once Edward locates a portrait"
        }
      />
      {preview.status === "error" ? (
        <StateCard variant="error" size="compact" title="Could not load" action={{ label: "Try again", icon: "refresh", onClick: preview.reload }}>
          {preview.error}
        </StateCard>
      ) : (
        <div className="identity-preview">
          {photoDocument && canViewProfilePhoto ? (
            <SecuredProfilePhoto documentId={photoDocument.id} name={name} />
          ) : (
            <Avatar person={{ name }} size="xl" alone />
          )}
          <div>
            <strong>{name}</strong>
            <small>
              {tenant.academicContext.academicYearLabel ||
                tenant.academicContext.currentTermLabel ||
                "Student record"}
            </small>
            <small className="mono">
              {maskedId ? `STUDENT ID •••• ${maskedId}` : "STUDENT ID · pending"}
            </small>
          </div>
        </div>
      )}
      <CardFoot>
        <p>
          <Icon name="shield" size={14} />{" "}
          {photoDocument
            ? "Staff review is still required before an official university ID is issued."
            : "Staff review the portrait before an official university ID is issued."}
        </p>
      </CardFoot>
    </Card>
  );
}

function TranscriptPreview({
  document,
  refreshKey,
}: {
  document: StudentDocument | null;
  refreshKey: number;
}) {
  const { tenant } = useTenant();
  const loadAcademics = useCallback(
    (signal: AbortSignal) => getStudentAcademics(signal),
    [],
  );
  const academics = useApiResource(loadAcademics);
  const extraction = document?.extraction;
  const courses = extraction?.courses ?? [];
  const documentCreditIds =
    academics.status === "ready" && document
      ? new Set(
          academics.data.transcriptCredits
            .filter((credit) => credit.sourceDocumentId === document.id)
            .map((credit) => credit.id),
        )
      : new Set<string>();
  const recommendations =
    academics.status === "ready"
      ? academics.data.exemptionRecommendations.filter((recommendation) =>
          documentCreditIds.has(recommendation.transcriptCreditId),
        )
      : [];
  const leadingRecommendation = recommendations[0] ?? null;
  const sourceCredit =
    leadingRecommendation && academics.status === "ready"
      ? academics.data.transcriptCredits.find(
          (credit) =>
            credit.id === leadingRecommendation.transcriptCreditId,
        )
      : null;
  return (
    <Card aria-labelledby="transcript-preview-title" data-refresh-key={refreshKey}>
      <CardHead
        kind="status"
        icon="degree"
        title="Academic insight"
        titleId="transcript-preview-title"
        note={
          leadingRecommendation
            ? "A potential match"
            : extraction?.status === "completed"
              ? academics.status === "loading"
                ? "Checking your courses"
                : "Read, waiting on an advisor"
              : extraction?.status === "processing"
                ? "Reading your transcript"
                : extraction?.status === "failed"
                  ? "Paused until a retry"
                  : "Begins after you send it"
        }
      />
      {leadingRecommendation ? (
        <CardRows>
          <StatedField
            label="Transcript evidence"
            value={sourceCredit?.sourceCode ?? sourceCredit?.title ?? "Reviewed course"}
            note={
              sourceCredit?.gradeOrScore
                ? `Score / grade ${sourceCredit.gradeOrScore}`
                : "Reviewed course evidence"
            }
          />
          <StatedField
            label={`${tenant.shortName} equivalent`}
            value={leadingRecommendation.targetCourseCode}
            note={leadingRecommendation.targetCourseTitle}
          />
          <StatedField label="Why" value={leadingRecommendation.rationale} />
        </CardRows>
      ) : extraction?.status === "completed" ? (
        <CardRows>
          <StatedField
            label={academics.status === "loading" ? "Generating insight" : "Automatic insight"}
            value={
              academics.status === "loading"
                ? `Checking ${courses.length} ${courses.length === 1 ? "course" : "courses"} against ${tenant.shortName} rules`
                : extraction?.courseExemptionEvaluation
                  ? "No policy-backed equivalency matched yet"
                  : "Course mapping needs advisor review"
            }
            note={
              academics.status === "loading"
                ? "Potential matches appear here on their own."
                : extraction?.courseExemptionEvaluation
                  ? `${courses.length} extracted ${courses.length === 1 ? "course was" : "courses were"} evaluated with the active ${academics.status === "ready" ? academics.data.catalogVersion : "catalog"}, program, prerequisites and equivalency rules. An advisor can review every unmatched course.`
                  : "Your extracted courses are kept. The policy context for an automatic recommendation was not available, so an advisor will review them."
            }
          />
        </CardRows>
      ) : (
        <CardRows>
          <StatedField
            label="Course matching"
            value={
              extraction?.status === "processing"
                ? "Reading your transcript"
                : extraction?.status === "failed"
                  ? "Paused until retry"
                  : "Begins after upload"
            }
            note="Edward extracts every course and grade, then a versioned prompt evaluates the catalog, program requirements, prerequisites and equivalency rules for staff review."
            quiet
          />
        </CardRows>
      )}
      <CardFoot>
        <p>
          <Icon name="info" size={14} /> Prediction only · Registrar approval required.
          Recommendations never grant academic credit on their own.
        </p>
      </CardFoot>
    </Card>
  );
}

function TranscriptRecordPanel({ document }: { document: StudentDocument | null }) {
  if (!document || document.extraction?.status !== "completed") return null;
  const extraction = document.extraction;
  const courses = extraction.courses ?? [];
  return (
    <Card aria-labelledby="transcript-record-title">
      <CardHead
        kind="status"
        icon="file"
        tone="done"
        title="Your transcript view"
        titleId="transcript-record-title"
        note={document.fileName}
        count={courses.length}
      />
      <CardRows>
        <StatedField label="Institution" value={extraction.institutionName ?? "Not identified"} />
        <StatedField label="Academic term" value={extraction.academicTerm ?? "Multiple terms"} />
        <StatedField label="Courses found" value={String(courses.length)} />
      </CardRows>
      {courses.length ? (
        <ul className="reject-remedies">
          {courses.slice(0, 5).map((course, index) => (
            <li key={`${course.sourceCode ?? course.title}-${index}`}>
              <Icon name="book" size={14} />
              {course.sourceCode ? `${course.sourceCode} · ` : ""}
              {course.title}
              {course.grade || course.score ? ` · ${course.grade ?? course.score}` : ""}
            </li>
          ))}
          {courses.length > 5 ? (
            <li>
              <Icon name="rows" size={14} />
              And {courses.length - 5} more parsed courses.
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="inline-empty">
          No course rows were readable. The original remains available for
          registrar review.
        </p>
      )}
      {extraction.warnings.length ? (
        <CardFoot>
          <p>
            <Icon name="info" size={14} /> {extraction.warnings.length} parsing{" "}
            {extraction.warnings.length === 1 ? "note" : "notes"} · the original
            remains available to staff.
          </p>
        </CardFoot>
      ) : null}
    </Card>
  );
}

function HousingPreview({
  selection,
}: {
  selection: HousingPreviewSelection | null;
}) {
  const loadHousing = useCallback(
    (signal: AbortSignal) => getStudentHousingPlan(signal),
    [],
  );
  const housing = useApiResource(loadHousing);
  const persistedPlan = housing.status === "ready" ? housing.data : null;
  const plan = selection ?? persistedPlan;
  const selected = persistedPlan?.residences.find(
    (option) => option.value === plan?.residenceOption,
  );
  const preferenceLabel = plan?.preference
    ? humanize(plan.preference)
    : "Choose your housing path";

  return (
    <Card aria-labelledby="housing-preview-title">
      <CardHead
        kind="status"
        icon="home"
        title="Your housing snapshot"
        titleId="housing-preview-title"
        note={selected ? selected.name : preferenceLabel}
      />
      {selected ? (
        <PlaceTile
          size="full"
          image={{ src: selected.imageUrl, alt: selected.imageAlt, caption: selected.attribution ?? undefined }}
          initials={selected.name.slice(0, 2)}
        />
      ) : null}
      <CardRows>
        <StatedField
          label={selected ? selected.name : "Your plan"}
          value={
            selected
              ? selected.description
              : plan?.preference === "on_campus"
                ? "On campus. A specific residence can be chosen later."
                : plan?.preference
                  ? `${preferenceLabel}. Additional details can be decided later.`
                  : "Choose a housing path to personalise this snapshot."
          }
          quiet={!plan?.preference}
        />
      </CardRows>
      {selected ? (
        <CardFoot>
          <p className="compact-meta">
            {selected.amenities.map((amenity) => (
              <span key={amenity}>{amenity}</span>
            ))}
          </p>
        </CardFoot>
      ) : null}
    </Card>
  );
}

type DepositWorkspaceData = {
  restricted: false;
  dashboard: Omit<StudentDashboard, "offer"> & {
    offer?: StudentDashboard["offer"];
  };
  payments: StudentPaymentList;
} | { restricted: true };

function DepositPaymentAction({
  dueAt,
  onPaid,
}: {
  dueAt: string | null;
  onPaid: () => void;
}) {
  const { tenant } = useTenant();
  const loadDeposit = useCallback(
    async (signal: AbortSignal): Promise<DepositWorkspaceData> => {
      const bootstrap = await getStudentBootstrap(signal);
      if (
        bootstrap.actor?.type === "delegate" &&
        !bootstrap.actor.scopes.some((scope) =>
          ["enrollment", "payments"].includes(scope),
        )
      ) {
        return { restricted: true };
      }
      const [dashboard, payments] = await Promise.all([
        getStudentDashboard(signal),
        getStudentPayments(signal),
      ]);
      return { restricted: false, dashboard, payments };
    },
    [],
  );
  const deposit = useApiResource(loadDeposit);
  const paymentIntentKey = useRef<string | null>(null);
  const pay = useApiAction(
    useCallback(
      (offerId: string, idempotencyKey: string) =>
        createDepositPayment({ offerId }, idempotencyKey),
      [],
    ),
  );

  if (deposit.status === "loading") {
    return <InlineLoading label="Loading your enrollment deposit…" />;
  }
  if (deposit.status === "error") {
    return <InlineError message={deposit.error} onRetry={deposit.reload} />;
  }

  if (deposit.data.restricted) {
    return (
      <Notice tone="quiet" icon="lock" title="Not in your access">
        This payment step is not included in the delegated access the student granted.
      </Notice>
    );
  }

  const offer = deposit.data.dashboard.offer;
  if (!offer) {
    return (
      <Notice tone="quiet" icon="info" title="Offer details unavailable">
        The enrollment offer details needed for this payment are unavailable right now.
      </Notice>
    );
  }

  const successfulPayment = deposit.data.payments.items.find(
    (payment) =>
      payment.type === "enrollment_deposit" && payment.status === "succeeded",
  );
  const submitPayment = async () => {
    const key =
      paymentIntentKey.current ??
      (paymentIntentKey.current = crypto.randomUUID());
    try {
      await pay.run(offer.id, key);
      paymentIntentKey.current = null;
      deposit.refresh();
      onPaid();
    } catch {
      // Keep the same key so retrying cannot create a second deposit.
    }
  };
  const amount = formatTenantMoney(offer.depositAmountCents, tenant);

  return (
    <div className="external-panel">
      <div className="external-destination">
        <span className="org-tile" aria-hidden="true">
          {tenant.mark}
        </span>
        <div>
          <strong>{tenant.name} enrollment deposit</strong>
          <span>
            {amount} · due {formatDueDate(dueAt, tenant)}
          </span>
        </div>
        <Icon name="shield" size={19} />
      </div>
      <p>
        The deposit confirms your intent to attend {tenant.shortName} and is applied
        to first-semester tuition and fees. It unlocks housing assignment and
        course-registration preparation, and this checklist updates the moment it is
        recorded.
      </p>
      <ActionResult
        status={pay.status}
        error={pay.message}
        success="Your enrollment deposit is recorded and the checklist has been refreshed."
      />
      {successfulPayment ? (
        <Notice tone="done" icon="check" title="Deposit received">
          Reference {successfulPayment.processorReference}.
        </Notice>
      ) : (
        <Button
          kind="primary"
          icon="card"
          full
          pending={pay.status === "loading"}
          onClick={() => void submitPayment()}
        >
          {pay.status === "error" ? "Try the deposit again" : `Pay the ${amount} deposit`}
        </Button>
      )}
      <small className="prototype-note">
        Secure development payment: the current processor records a result without
        collecting or charging card details.
      </small>
    </div>
  );
}

function RequirementAction({
  requirement,
  unlocks,
  onRecordChanged,
  onDocumentMutated,
  onDocumentSelected,
  activeDocument,
  activeDocumentProjection,
  onHousingPreviewChange,
  prerequisite,
}: {
  requirement: StudentRequirementDetail;
  unlocks: StudentRequirementSummary[];
  onRecordChanged: () => void;
  onDocumentMutated?: (document: StudentDocument) => void;
  onDocumentSelected?: (document: StudentDocument | null) => void;
  activeDocument?: StudentDocument | null;
  activeDocumentProjection?: DocumentExtractionProjectionState | null;
  onHousingPreviewChange?: (selection: HousingPreviewSelection) => void;
  prerequisite?: Pick<StudentRequirementDetail, "slug" | "title"> | null;
}) {
  const { tenant, href } = useTenant();
  const isTranscript = requirement.documentCategory === "transcript";
  if (requirement.status === "blocked") {
    return (
      <div className="document-route">
        <p>
          This one opens on its own once the step before it is done
          {prerequisite ? `: “${prerequisite.title}”.` : "."}
        </p>
        <a
          className="primary-button"
          href={href(prerequisite ? requirementPath(prerequisite.slug) : "/enrollment")}
        >
          {prerequisite ? `Open ${prerequisite.title}` : "Back to My Enrollment"}{" "}
          <Icon name="arrow" size={17} />
        </a>
      </div>
    );
  }
  if (requirement.interactionType === "ferpa") {
    return (
      <FerpaAccessCenter
        mode="task"
        requirementId={requirement.id}
        onSaved={onRecordChanged}
      />
    );
  }
  if (
    requirement.code === "profile_verification" &&
    requirement.interactionType === "form"
  ) {
    return <ProfileAction requirementId={requirement.id} onSaved={onRecordChanged} />;
  }
  if (
    requirement.code === "housing_preference" &&
    ["form", "selection_flow"].includes(requirement.interactionType)
  ) {
    return (
      <HousingAction
        onSaved={onRecordChanged}
        onPreviewChange={onHousingPreviewChange ?? (() => undefined)}
      />
    );
  }
  if (
    requirement.submissionType === "document" &&
    requirement.interactionType === "upload_file"
  ) {
    return (
      <DocumentAction
        requirement={requirement}
        unlocks={unlocks}
        onUploaded={() => onRecordChanged()}
        onDocumentMutated={isTranscript ? onDocumentMutated : undefined}
        onDocumentSelected={isTranscript ? onDocumentSelected : undefined}
        documentOverride={isTranscript ? activeDocument : undefined}
        documentOverrideProjection={isTranscript ? activeDocumentProjection : undefined}
      />
    );
  }
  if (
    requirement.code === "enrollment_deposit" &&
    requirement.submissionType === "payment" &&
    requirement.interactionType === "payment"
  ) {
    return (
      <DepositPaymentAction
        dueAt={requirement.dueAt}
        onPaid={onRecordChanged}
      />
    );
  }
  if (
    [
      "information",
      "approval",
      "form",
      "single_select",
      "multiple_select",
      "selection_flow",
      "signature",
      "scheduling",
    ].includes(requirement.interactionType)
  ) {
    return (
      <RequirementResponseAction
        requirement={requirement}
        onSaved={onRecordChanged}
      />
    );
  }
  return (
    <Notice
      tone="quiet"
      icon="help"
      title={`This step needs a hand from ${tenant.shortName}`}
      action={{ label: "Get enrollment help", href: href("/help") }}
    >
      Your enrollment advisor can explain the next action and record any required
      exception.
    </Notice>
  );
}

/** What to expect — the reference "How it works" tab, from what the platform
 *  actually does with this kind of step rather than a script per task. */
function howSteps(
  requirement: StudentRequirementDetail,
  kind: RequirementKind,
  tenant: TenantConfig,
): string[] {
  const office = requirement.responsibleOffice;
  if (requirement.submissionType === "document") {
    const category = requirement.documentCategory;
    return [
      "Choose the file or files — PDF, JPG or PNG, up to 10 MB each — and send them together.",
      category === "transcript"
        ? "Edward reads the transcript, builds your course record and starts advisory course matching."
        : category === "identity"
          ? "Edward identifies the document and locates the portrait for your student-ID preview."
          : category === "financial_aid"
            ? "Edward checks that each file is the right kind of document. Nothing else is read from it."
            : "The originals are stored securely and routed straight to staff.",
      `${office} reviews the original. This step updates on your checklist when they decide.`,
    ];
  }
  if (requirement.submissionType === "payment") {
    return [
      "Check the amount and the deadline shown on the step.",
      `Pay here. ${tenant.shortName}’s processor records the result.`,
      "Your checklist updates as soon as the payment is recorded, usually within a minute.",
    ];
  }
  if (requirement.submissionType === "appointment" || kind === "meeting") {
    return [
      "Choose a time, or attach an appointment you already have.",
      `${office} holds the slot and it lands in your Appointments.`,
      "This step completes when the appointment is attached.",
    ];
  }
  if (requirement.interactionType === "ferpa") {
    return [
      "Decide who may see your record, and which parts.",
      `${tenant.shortName} records your choice with today’s date. You can change it later.`,
      "This step completes as soon as your decision is saved.",
    ];
  }
  if (requirement.interactionType === "signature") {
    return [
      "Read what you are signing.",
      "Type your legal name and confirm the electronic signature represents you.",
      `${office} keeps the signed record with the date.`,
    ];
  }
  return [
    "Answer the questions on the step. Most take a minute or two.",
    `Save. ${tenant.shortName} records your answer with the date.`,
    `${office} confirms it and the step completes on your checklist.`,
  ];
}

export default function RequirementDetailPage() {
  const { tenant, href } = useTenant();
  const router = useRouter();
  const params = useParams<{ slug: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [helpState, setHelpState] = useState({
    slug,
    requested: false,
  });
  const helpRequested = helpState.slug === slug && helpState.requested;
  const setCurrentHelpRequested = useCallback(
    (requested: boolean) => setHelpState({ slug, requested }),
    [slug],
  );
  const [tab, setTab] = useState<"action" | "how" | "history">("action");
  const [pointsModal, setPointsModal] = useState(false);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [transcriptDocumentProjection, setTranscriptDocumentProjection] =
    useState<DocumentExtractionProjectionState | null>(null);
  const transcriptDocument = transcriptDocumentProjection?.document ?? null;
  const [housingSelection, setHousingSelection] =
    useState<HousingPreviewSelection | null>(null);
  const loadRequirement = useCallback(
    (signal: AbortSignal) => getStudentRequirement(slug, signal),
    [slug],
  );
  const requirement = useApiResource(loadRequirement);
  const loadBootstrap = useCallback(
    (signal: AbortSignal) => getStudentBootstrap(signal),
    [],
  );
  const bootstrap = useApiResource(loadBootstrap);
  const loadRequirements = useCallback(
    (signal: AbortSignal) => getStudentRequirements(signal),
    [],
  );
  const requirements = useApiResource(loadRequirements);
  const kind = useMemo(
    () => (requirement.status === "ready" ? requirementKind(requirement.data) : null),
    [requirement.data, requirement.status],
  );
  const delegateScopes =
    bootstrap.status === "ready" && bootstrap.data.actor?.type === "delegate"
      ? bootstrap.data.actor.scopes
      : null;
  const actorKnown = bootstrap.status === "ready";
  const canUseRequirementHelp =
    actorKnown && (delegateScopes === null || delegateScopes.includes("help"));
  const canViewProfilePhoto =
    actorKnown &&
    (delegateScopes === null ||
      delegateScopes.includes("documents") ||
      delegateScopes.includes("profile"));
  const rewards = bootstrap.status === "ready" ? bootstrap.data.rewards ?? null : null;
  const refreshAfterRecordChange = useCallback(() => {
    setPreviewRefreshKey((current) => current + 1);
    requirement.refresh();
    requirements.refresh();
  }, [requirement, requirements]);
  const refreshAfterTranscriptChange = useCallback(
    (document: StudentDocument) => {
      setTranscriptDocumentProjection((current) =>
        beginDocumentExtractionProjection(document, current?.document),
      );
      refreshAfterRecordChange();
    },
    [refreshAfterRecordChange],
  );
  const reconcileTranscriptServerProjection = useCallback(
    (document: StudentDocument | null) => {
      if (!document) return;
      setTranscriptDocumentProjection((current) => {
        if (!current) return beginDocumentExtractionProjection(document);
        if (current.document === document) return current;
        return reconcileDocumentExtractionProjection(current, document);
      });
    },
    [],
  );
  const goBack = useCallback(() => {
    router.push(href("/enrollment"));
  }, [href, router]);

  const relatedRequirements = requirements.status === "ready"
    ? requirements.data.items
    : [];
  const requirementByCode = new Map(
    relatedRequirements.map((item) => [item.code, item]),
  );
  const prerequisites = requirement.status === "ready"
    ? requirement.data.dependencyCodes.map((code) => ({
        code,
        requirement: requirementByCode.get(code) ?? null,
      }))
    : [];
  const firstPrerequisiteRecord =
    prerequisites.find(
      (item) =>
        item.requirement &&
        !terminalRequirementStatuses.has(item.requirement.status),
    ) ?? prerequisites.find((item) => !item.requirement);
  const firstPrerequisite = firstPrerequisiteRecord
    ? firstPrerequisiteRecord.requirement ?? {
        slug: studentRequirementSlug(firstPrerequisiteRecord.code),
        title: humanize(firstPrerequisiteRecord.code),
      }
    : null;
  const successors = requirement.status === "ready"
    ? relatedRequirements.filter((item) =>
        item.dependencyCodes.includes(requirement.data.code),
      )
    : [];

  const heroTitle =
    requirement.status === "ready" ? requirement.data.title : "One step from your checklist";
  const hero = {
    kicker: `${tenant.name} · My Enrollment`,
    title: heroTitle,
    lede: `Finish it here. Your checklist updates as soon as ${tenant.shortName} receives it.`,
  };

  if (requirement.status === "loading") {
    return (
      <PortalShell active="enrollment" hero={hero}>
        <PageSkeleton label="this step" />
      </PortalShell>
    );
  }

  if (requirement.status === "error") {
    const missing = requirement.errorStatus === 400 || requirement.errorStatus === 404;
    return (
      <PortalShell active="enrollment" hero={hero}>
        {missing ? (
          <StateCard
            variant="empty"
            size="page"
            icon="checklist"
            title="We couldn’t find that step"
            action={{ label: "Back to My Enrollment", icon: "back", onClick: goBack }}
          >
            It may have been renamed or removed from your checklist. Everything that is
            still yours to do is on My Enrollment.
          </StateCard>
        ) : (
          <PageError label="this step" onRetry={requirement.reload} />
        )}
      </PortalShell>
    );
  }

  const item = requirement.data;
  const office = item.responsibleOffice;
  const due = shortDue(item.dueAt, tenant);
  const pill = helpRequested
    ? null
    : statusPill(item.status, office);
  const done = terminalRequirementStatuses.has(item.status);
  const reward = item.reward ?? null;
  const isTranscript = item.documentCategory === "transcript";
  const isIdentity = item.documentCategory === "identity";
  const isHousing = item.code === "housing_preference";
  const why: ReactNode[] = [];
  if (done) {
    why.push(`${office} has this on record. Nothing more is needed from you.`);
  } else {
    if (item.blocking) {
      why.push(`It is required — your enrollment can’t be completed without it.`);
    }
    if (item.dueAt) {
      why.push(`${office} needs it by ${formatDueDate(item.dueAt, tenant)}.`);
    }
    if (successors.length === 1) {
      why.push(`Finishing it unlocks “${successors[0].title}”.`);
    } else if (successors.length > 1) {
      why.push(`Finishing it unlocks ${successors.length} more steps.`);
    }
    if (why.length === 0) {
      why.push(`${office} confirms this before it becomes part of your enrollment record.`);
    }
  }
  const edwardAsk = () =>
    openEdward({
      question: due
        ? `What exactly do I need to do for “${item.title}”, and what happens if I miss ${due}?`
        : `What exactly do I need to do for “${item.title}”?`,
      context: {
        label: `My Enrollment · ${item.title}`,
        intent: "task",
        taskId: item.id,
        office,
        topic: null,
      },
    });
  const steps = howSteps(item, kind ?? "review", tenant);

  return (
    <PortalShell
      active="enrollment"
      hero={hero}
      rail={
        <>
          <AnchorCard variant="deadline" label="This step" figure={`${item.progressPercent}%`}>
            <p>{statusSentence(item, tenant)}</p>
          </AnchorCard>

          <Card aria-labelledby="about-step-title">
            <CardHead
              kind="status"
              icon="info"
              title="About this step"
              titleId="about-step-title"
              note={office}
            />
            <CardRows>
              <StatedField label="Managed by" value={office} />
              <StatedField label="Due" value={formatDueDate(item.dueAt, tenant)} quiet={!item.dueAt} />
              <StatedField label="Progress" value={`${item.progressPercent}%`} />
              <StatedField label="Requirement" value={item.blocking ? "Required" : "Optional"} />
              {reward ? (
                <StatedField
                  label="Points"
                  value={reward.earned ? `${reward.points} earned` : `+${reward.points} on completion`}
                />
              ) : null}
            </CardRows>
            <CardFoot>
              <EdwardAsk mark="E" onClick={edwardAsk} />
            </CardFoot>
          </Card>

          {item.status === "blocked" && item.dependencyCodes.length > 0 ? (
            <Card aria-labelledby="prerequisites-title">
              <CardHead
                kind="status"
                icon="lock"
                title="Complete first"
                titleId="prerequisites-title"
                note="Before this step"
                count={prerequisites.length}
              />
              {requirements.status === "error" ? (
                <Notice
                  tone="quiet"
                  icon="info"
                  action={{ label: "Check again", icon: "refresh", onClick: requirements.reload }}
                >
                  Live statuses are unavailable right now; the links still work.
                </Notice>
              ) : null}
              <CardRows>
                {prerequisites.map(({ code, requirement: dependency }) => (
                  <EntryRow
                    key={code}
                    icon={dependency ? kindIcon(requirementKind(dependency)) : "file"}
                    title={dependency ? dependency.title : humanize(code)}
                    note={dependency ? humanize(dependency.status) : "Status unavailable"}
                    where="Open"
                    href={href(
                      requirementPath(dependency ? dependency.slug : studentRequirementSlug(code)),
                    )}
                  />
                ))}
              </CardRows>
            </Card>
          ) : null}

          {successors.length > 0 ? (
            <Card aria-labelledby="unlocks-title">
              <CardHead
                kind="status"
                icon="checklist"
                title="What this unlocks"
                titleId="unlocks-title"
                note="Next connected steps"
                count={successors.length}
              />
              <CardRows>
                {successors.map((successor) => (
                  <EntryRow
                    key={successor.id}
                    icon={kindIcon(requirementKind(successor))}
                    title={successor.title}
                    note={humanize(successor.status)}
                    where="Open"
                    href={href(requirementPath(successor.slug))}
                  />
                ))}
              </CardRows>
            </Card>
          ) : null}

          {isIdentity ? (
            <IdentityPreview
              canViewProfilePhoto={canViewProfilePhoto}
              key={`identity-${previewRefreshKey}`}
            />
          ) : null}
          {isTranscript ? (
            <>
              <TranscriptPreview
                key={`transcript-${previewRefreshKey}-${transcriptDocument?.id ?? "empty"}-${transcriptDocument?.status ?? "none"}`}
                document={transcriptDocument}
                refreshKey={previewRefreshKey}
              />
              <TranscriptRecordPanel document={transcriptDocument} />
            </>
          ) : null}
          {isHousing ? (
            <HousingPreview key={`housing-${previewRefreshKey}`} selection={housingSelection} />
          ) : null}
        </>
      }
    >
      <Card className="requirement-page-card" aria-labelledby="requirement-title">
        <div className="card-heading requirement-page-head">
          <IconButton name="back" label="Back to My Enrollment" tip="My Enrollment" onClick={goBack} />
          <div className="drawer-label">
            <span>{office}</span>
            {due ? <span>Due {due}</span> : null}
          </div>
          {helpRequested ? (
            <RequirementHelpRequestedStatus />
          ) : pill ? (
            <StatusPill tone={pill.tone} pulse={pill.pulse}>
              {pill.label}
            </StatusPill>
          ) : null}
        </div>

        <div className="requirement-body">
          <div className={`drawer-icon ${kind ?? "review"}`}>
            <Icon name={kindIcon(kind ?? "review")} size={25} weight="duotone" />
          </div>
          <h2 id="requirement-title">{item.title}</h2>
          <p className="drawer-description">{item.description}</p>

          {reward && rewards ? (
            <div className="drawer-reward">
              <div>
                <Icon name="spark" size={18} />
                <span>
                  <strong>
                    {reward.earned
                      ? `You earned ${reward.points} ${rewards.pointName}`
                      : `Earn ${reward.points} ${rewards.pointName} for this step`}
                  </strong>
                  <small>
                    {reward.earned
                      ? `Already counted in your ${rewards.lifetimePoints.toLocaleString()}`
                      : `Added when ${office} records it`}
                  </small>
                </span>
              </div>
              <Tooltip tip="How points work">
                <button type="button" onClick={() => setPointsModal(true)} aria-label="Learn how points work">
                  <Icon name="info" size={17} />
                </button>
              </Tooltip>
            </div>
          ) : null}

          <div className="drawer-tabs" role="tablist">
            <button
              type="button"
              className={tab === "action" ? "active" : ""}
              onClick={() => setTab("action")}
              role="tab"
              aria-selected={tab === "action"}
            >
              Do it now
            </button>
            <button
              type="button"
              className={tab === "how" ? "active" : ""}
              onClick={() => setTab("how")}
              role="tab"
              aria-selected={tab === "how"}
            >
              How it works
            </button>
            <button
              type="button"
              className={tab === "history" ? "active" : ""}
              onClick={() => setTab("history")}
              role="tab"
              aria-selected={tab === "history"}
            >
              History{item.history?.length ? ` (${item.history.length})` : ""}
            </button>
          </div>

          {tab === "how" ? (
            <div className="how-panel" role="tabpanel">
              <h3>Here’s what to expect</h3>
              <ol>
                {steps.map((step, index) => (
                  <li key={step}>
                    <span>{index + 1}</span>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
              <div className="help-note">
                <Icon name="help" size={18} />
                <p>
                  <strong>Still unsure?</strong> Edward knows this step and what
                  {" "}{office} needs from it.{" "}
                  <EdwardAsk mark="E" onClick={edwardAsk} />
                </p>
              </div>
              <button className="primary-button full" type="button" onClick={() => setTab("action")}>
                Continue to the step <Icon name="arrow" size={17} />
              </button>
            </div>
          ) : tab === "history" ? (
            <div className="requirement-history-panel" role="tabpanel">
              <div className="requirement-history-panel__heading">
                <h3>This step&apos;s history</h3>
                <p>
                  Uploads, decisions, status changes, and help activity stay together here.
                  Private staff notes are never included.
                </p>
              </div>
              {(item.history?.length ?? 0) === 0 ? (
                <StateCard variant="empty" icon="clock" title="No activity recorded yet">
                  The first action on this enrollment step will appear here.
                </StateCard>
              ) : (
                <ol className="requirement-history-list">
                  {item.history?.map((event) => (
                    <li key={event.id}>
                      <span className="requirement-history-list__mark" aria-hidden="true">
                        <Icon name={event.kind === "document_reviewed" ? "file" : "clock"} size={16} />
                      </span>
                      <div>
                        <div className="requirement-history-list__title">
                          <strong>{event.title}</strong>
                          {event.status ? <span>{humanize(event.status)}</span> : null}
                        </div>
                        {event.detail ? <p>{event.detail}</p> : null}
                        <time dateTime={event.occurredAt}>
                          {formatTenantDate(event.occurredAt, tenant, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                        {event.documentId ? (
                          <Link href={`/profile?section=documents&document=${encodeURIComponent(event.documentId)}`}>
                            Open document record
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : (
            <div className="action-panel" role="tabpanel">
              <div className="why-card">
                <span>
                  <Icon name="spark" size={17} />
                </span>
                <div>
                  <strong>{done ? "Why this is done" : "Why this matters now"}</strong>
                  <p>{why.join(" ")}</p>
                </div>
              </div>
              <RequirementAction
                requirement={item}
                unlocks={successors}
                onRecordChanged={refreshAfterRecordChange}
                onDocumentMutated={refreshAfterTranscriptChange}
                onDocumentSelected={reconcileTranscriptServerProjection}
                activeDocument={transcriptDocument}
                activeDocumentProjection={transcriptDocumentProjection}
                onHousingPreviewChange={setHousingSelection}
                prerequisite={firstPrerequisite}
              />
            </div>
          )}
        </div>

        {canUseRequirementHelp ? (
          <CardFoot>
            <RequirementHelpRequest
              key={item.id}
              requirement={item}
              onHelpStateChange={setCurrentHelpRequested}
            />
          </CardFoot>
        ) : null}
      </Card>

      {pointsModal && rewards ? (
        <PointsInfoModal rewards={rewards} onClose={() => setPointsModal(false)} />
      ) : null}
    </PortalShell>
  );
}
