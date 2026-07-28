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
  UpdateStudentHousingPlanInput,
  UpdateStudentProfileInput,
} from "@vv/contracts";
import Image from "next/image";
import { TenantLink as Link } from "../../../components/tenant-link";
import { useParams } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DocumentExtractionReview } from "../../../components/document-extraction-review";
import { DocumentUpload } from "../../../components/document-upload";
import { PortalShell } from "../../../components/portal-shell";
import {
  ActionFeedback,
  ErrorState,
  LoadingState,
  StatusPill,
} from "../../../components/portal-ui";
import { useApiAction, useApiResource } from "../../../hooks/use-api-resource";
import {
  getStudentAcademics,
  createDepositPayment,
  getStudentDashboard,
  getStudentHousingPlan,
  getStudentDocuments,
  getStudentDocumentProfilePhotoUrl,
  getStudentProfile,
  getStudentPayments,
  getStudentRequirement,
  updateStudentHousingPlan,
  updateStudentProfile,
} from "../../../lib/api-client";

type RequirementKind =
  | "profile"
  | "housing"
  | "identity"
  | "transcript"
  | "document"
  | "payment"
  | "other";

type ResidenceOption = Exclude<HousingResidenceOption, null>;

const housingChoices: Array<{
  value: HousingPreference;
  icon: string;
  title: string;
  description: string;
}> = [
  {
    value: "on_campus",
    icon: "⌂",
    title: "On campus",
    description: "Live in an Aster residence community.",
  },
  {
    value: "off_campus",
    icon: "⌁",
    title: "Off campus",
    description: "Arrange housing independently in the city.",
  },
  {
    value: "commuting",
    icon: "⇄",
    title: "Commuting",
    description: "Plan parking, transit, and time between classes.",
  },
  {
    value: "undecided",
    icon: "◌",
    title: "Still deciding",
    description: "Keep your plans open for now.",
  },
  {
    value: "family",
    icon: "⌂",
    title: "Family or dependent housing",
    description: "Connect with family-friendly housing guidance.",
  },
];

const residenceOptions: Array<{
  value: ResidenceOption;
  title: string;
  subtitle: string;
  description: string;
  amenities: string[];
  image: string;
  imageAlt: string;
}> = [
  {
    value: "aster_residence_hall",
    title: "Aster Residence Hall",
    subtitle: "Classic campus living",
    description: "A lively, central home minutes from classes and campus dining.",
    amenities: ["Dining hall", "High-speed Wi-Fi", "Study lounges"],
    image: "/media/housing/aster-residence-hall-room.jpg",
    imageAlt: "Bright shared room with two beds, wardrobes, and a window desk",
  },
  {
    value: "aster_apartments",
    title: "Aster Apartments",
    subtitle: "Independent living",
    description: "Apartment-style rooms with more privacy and in-unit routines.",
    amenities: ["In-unit laundry", "Kitchenette", "Fitness room"],
    image: "/media/housing/aster-apartments-room.jpg",
    imageAlt: "Bright furnished apartment with a kitchenette and living area",
  },
  {
    value: "student_village",
    title: "Student Village",
    subtitle: "A connected community",
    description: "Shared suites surrounded by green space and resident events.",
    amenities: ["Community kitchen", "Courtyard", "Bike storage"],
    image: "/media/housing/student-village-room.jpg",
    imageAlt: "Shared student room with bunk beds and large windows",
  },
];

type HousingPreviewSelection = {
  preference: HousingPreference;
  residenceOption: ResidenceOption | null;
};

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDueDate(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function initials(value: string | null | undefined) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "AS";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function requirementKind(requirement: StudentRequirementDetail): RequirementKind {
  const code = requirement.code.toLowerCase();
  if (code === "profile_verification") return "profile";
  if (code === "housing_preference") return "housing";
  if (requirement.documentCategory === "identity" || code.includes("identity")) {
    return "identity";
  }
  if (requirement.documentCategory === "transcript" || code.includes("transcript")) {
    return "transcript";
  }
  if (requirement.submissionType === "document") return "document";
  if (requirement.submissionType === "payment") return "payment";
  return "other";
}

function InlineResourceState({
  label,
  message,
  onRetry,
}: {
  label: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="requirement-inline-state" role={message ? "alert" : undefined}>
      <p>{message || label}</p>
      {onRetry ? (
        <button className="button button--secondary" type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

function ProfileActionForm({
  profile,
  onSaved,
}: {
  profile: StudentProfile;
  onSaved: (profile: StudentProfile) => void;
}) {
  const [preferredName, setPreferredName] = useState(profile.preferredName);
  const [pronouns, setPronouns] = useState(profile.pronouns || "");
  const [mobilePhone, setMobilePhone] = useState(profile.mobilePhone || "");
  const [communicationPreference, setCommunicationPreference] = useState<
    "email" | "sms"
  >(profile.communicationPreference);
  const [version, setVersion] = useState(profile.version);
  const saveProfile = useApiAction(
    useCallback(
      (input: UpdateStudentProfileInput) => updateStudentProfile(input),
      [],
    ),
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    <form className="requirement-inline-form" onSubmit={submit}>
      <div className="requirement-action-intro">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>Confirm the information Aster can update here.</strong>
          <p>
            Legal identity and academic records remain protected; your preferred
            details and contact choices are yours to manage.
          </p>
        </div>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Preferred name</span>
          <input
            value={preferredName}
            onChange={(event) => setPreferredName(event.target.value)}
            autoComplete="nickname"
            required
            maxLength={120}
          />
        </label>
        <label className="field">
          <span>
            Pronouns <small>Optional</small>
          </span>
          <input
            value={pronouns}
            onChange={(event) => setPronouns(event.target.value)}
            placeholder="For example: she/her"
            maxLength={80}
          />
        </label>
        <label className="field">
          <span>
            Mobile phone <small>Optional</small>
          </span>
          <input
            value={mobilePhone}
            onChange={(event) => setMobilePhone(event.target.value)}
            type="tel"
            autoComplete="tel"
            maxLength={30}
          />
        </label>
        <label className="field">
          <span>Preferred communication</span>
          <select
            value={communicationPreference}
            onChange={(event) =>
              setCommunicationPreference(event.target.value as "email" | "sms")
            }
          >
            <option value="email">Email</option>
            <option value="sms">Text message</option>
          </select>
        </label>
      </div>
      <ActionFeedback
        status={saveProfile.status}
        error={saveProfile.message}
        success="Your profile details are saved and this enrollment task is updated."
      />
      <div className="form-actions">
        <button
          className="button button--accent"
          type="submit"
          disabled={saveProfile.status === "loading"}
        >
          {saveProfile.status === "loading" ? "Saving details…" : "Save and verify"}
        </button>
      </div>
    </form>
  );
}

function ProfileAction({ onSaved }: { onSaved: (profile: StudentProfile) => void }) {
  const loadProfile = useCallback(
    (signal: AbortSignal) => getStudentProfile(signal),
    [],
  );
  const profile = useApiResource(loadProfile);

  if (profile.status === "loading") {
    return <InlineResourceState label="Loading your editable profile…" />;
  }
  if (profile.status === "error") {
    return (
      <InlineResourceState
        label=""
        message={profile.error}
        onRetry={profile.reload}
      />
    );
  }

  return <ProfileActionForm key={profile.data.version} profile={profile.data} onSaved={onSaved} />;
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
  const [preference, setPreference] = useState<HousingPreference | null>(
    plan.preference,
  );
  const [residenceOption, setResidenceOption] = useState<ResidenceOption | null>(
    plan.residenceOption,
  );
  const [version, setVersion] = useState(plan.version);
  const saveHousing = useApiAction(
    useCallback(
      (input: UpdateStudentHousingPlanInput) => updateStudentHousingPlan(input),
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

    try {
      const saved = await saveHousing.run({
        expectedVersion: version,
        preference,
        ...(preference === "on_campus" && residenceOption
          ? { residenceOption }
          : {}),
      });
      setVersion(saved.version);
      onSaved(saved);
    } catch {
      // Leave the selected choices intact so the student can retry.
    }
  };

  return (
    <form className="requirement-inline-form housing-plan-form" onSubmit={submit}>
      <div className="requirement-action-intro">
        <span aria-hidden="true">⌂</span>
        <div>
          <strong>Choose the plan that best matches your arrival.</strong>
          <p>
            Your housing path is required. Residence and room details can be
            decided later.
          </p>
        </div>
      </div>
      <fieldset className="housing-choice-fieldset">
        <legend>Where are you planning to live?</legend>
        <div className="housing-choice-grid">
          {housingChoices.map((choice) => {
            const selected = preference === choice.value;
            return (
              <label
                className={`housing-choice${selected ? " housing-choice--selected" : ""}`}
                key={choice.value}
              >
                <input
                  checked={selected}
                  name="housing-preference"
                  onChange={() => {
                    setPreference(choice.value);
                    if (choice.value !== "on_campus") {
                      setResidenceOption(null);
                    }
                  }}
                  required
                  type="radio"
                  value={choice.value}
                />
                <span className="housing-choice__icon" aria-hidden="true">
                  {choice.icon}
                </span>
                <strong>{choice.title}</strong>
                <small>{choice.description}</small>
              </label>
            );
          })}
        </div>
      </fieldset>
      {preference === "on_campus" ? (
        <fieldset className="housing-choice-fieldset housing-choice-fieldset--residence">
          <legend>Pick a residence style</legend>
          <p>
            Optional — leave every residence unselected to save your
            on-campus plan and decide later.
          </p>
          {residenceOption ? (
            <button
              className="text-button"
              type="button"
              onClick={() => setResidenceOption(null)}
            >
              Clear residence selection and decide later
            </button>
          ) : (
            <p className="optional-field-note">
              On-campus housing selected · residence not selected yet.
            </p>
          )}
          <div className="residence-option-grid">
            {residenceOptions.map((option) => {
              const selected = residenceOption === option.value;
              return (
                <label
                  className={`residence-option${selected ? " residence-option--selected" : ""}`}
                  key={option.value}
                >
                  <input
                    checked={selected}
                    name="residence-option"
                    onChange={() => setResidenceOption(option.value)}
                    type="radio"
                    value={option.value}
                  />
                  <Image
                    className="residence-option__photo"
                    src={option.image}
                    alt={option.imageAlt}
                    height={220}
                    unoptimized
                    width={320}
                  />
                  <span className="residence-option__content">
                    <strong>{option.title}</strong>
                    <small>{option.subtitle}</small>
                    <em>{option.description}</em>
                    <span className="residence-option__amenities">
                      {option.amenities.map((amenity) => (
                        <b key={amenity}>{amenity}</b>
                      ))}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      <ActionFeedback
        status={saveHousing.status}
        error={saveHousing.message}
        success="Your housing plan is saved and reflected in your enrollment record."
      />
      <div className="form-actions">
        <button
          className="button button--accent"
          disabled={
            !preference ||
            saveHousing.status === "loading"
          }
          type="submit"
        >
          {saveHousing.status === "loading" ? "Saving housing plan…" : "Save housing plan"}
        </button>
      </div>
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
    return <InlineResourceState label="Loading your housing choices…" />;
  }
  if (housing.status === "error") {
    return (
      <InlineResourceState
        label=""
        message={housing.error}
        onRetry={housing.reload}
      />
    );
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
  onUploaded,
  reviewPlacement = "inline",
  onDocumentSelected,
}: {
  requirement: StudentRequirementDetail;
  onUploaded: (document: StudentDocument) => void;
  reviewPlacement?: "inline" | "context";
  onDocumentSelected?: (document: StudentDocument | null) => void;
}) {
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
  const expectedLabel = requirement.title
    .replace(/^Submit your /i, "")
    .replace(/^Provide /i, "");
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
  const selectedDocument =
    recentDocument?.requirementId === requirement.id
      ? recentDocument
      : latestStoredDocument;
  const extraction = selectedDocument?.extraction;
  const extractionMismatch =
    extraction?.status === "completed" &&
    requirement.documentCategory &&
    extraction.documentType !==
      {
        consent: "ferpa",
        financial_aid: "financial_aid",
        health: "immunization",
        identity: "identity",
        other: "other",
        residency: "residency",
        transcript: "transcript",
      }[requirement.documentCategory];
  const refreshDocuments = documents.refresh;

  useEffect(() => {
    onDocumentSelected?.(selectedDocument);
  }, [onDocumentSelected, selectedDocument]);

  // A document job survives navigation and process restarts. Resume polling
  // from the server record too—not only from files uploaded during the current
  // React component lifetime—so refreshing this route cannot freeze a stale
  // "processing" snapshot.
  useEffect(() => {
    // A file selected in this mounted uploader is already polled by the
    // uploader so its per-file status can update. This route-level poll is the
    // recovery path for a refreshed/reopened page.
    if (
      extraction?.status !== "processing" ||
      recentDocument?.id === selectedDocument?.id
    ) {
      return;
    }
    let attempts = 0;
    let timer: number | undefined;
    const deadline = Date.parse(extraction.processingDeadlineAt ?? "");
    const stopPollingAt = Number.isFinite(deadline)
      ? deadline + 10_000
      : Date.now() + 100_000;
    const poll = () => {
      refreshDocuments();
      attempts += 1;
      if (Date.now() >= stopPollingAt) return;
      timer = window.setTimeout(
        poll,
        Math.min(5_000, 1_000 + attempts * 500),
      );
    };
    timer = window.setTimeout(poll, 1_000);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [
    extraction?.status,
    extraction?.processingDeadlineAt,
    recentDocument?.id,
    refreshDocuments,
    selectedDocument?.id,
  ]);

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

  const resultTone =
    extraction?.status === "completed" && !extractionMismatch
      ? "success"
      : extraction?.status === "processing"
        ? "pending"
        : "warning";
  const resultIcon = resultTone === "success" ? "✓" : resultTone === "pending" ? "…" : "!";
  const rememberDocument = (document: StudentDocument) => {
    if (document.extraction?.status !== "processing") {
      notifiedTerminalDocuments.current.add(
        `${document.id}:${document.extraction?.status ?? "none"}:${document.extraction?.processedAt ?? ""}`,
      );
    }
    setRecentDocument(document);
    onDocumentSelected?.(document);
    documents.refresh();
    onUploadedRef.current(document);
  };
  const isTranscript = requirement.documentCategory === "transcript";
  const isIdentity = requirement.documentCategory === "identity";

  return (
    <div className="requirement-upload requirement-upload--workspace">
      <div className="requirement-upload__heading">
        <p className="eyebrow">Your documents</p>
        <h2>
          {isTranscript
            ? "Add your transcript files"
            : "Add everything that supports this task"}
        </h2>
        <p>
          {isTranscript
            ? "Upload one or more transcript files. Edward identifies the academic record, extracts its courses, and starts advisory course matching automatically."
            : isIdentity
              ? "Drop every side of your identity document together. Edward identifies the document, locates its portrait, and prepares your private student-ID preview."
              : "Drop every file that supports this requirement together. The originals are stored securely and routed to the responsible office for review."}
        </p>
      </div>
      {requirement.immunizationPolicy ? (
        <section className="immunization-policy" aria-labelledby="immunization-policy-title">
          <div>
            <p className="eyebrow">Active health policy</p>
            <h3 id="immunization-policy-title">
              {requirement.immunizationPolicy.name}
            </h3>
            <p>
              Edward compares the uploaded evidence with policy{" "}
              {requirement.immunizationPolicy.code}, version{" "}
              {requirement.immunizationPolicy.version}. Health Services makes
              the final determination.
            </p>
          </div>
          <ul>
            {requirement.immunizationPolicy.requirements.map((item) => (
              <li key={item.id}>
                <span aria-hidden="true">◇</span>
                <div>
                  <strong>
                    {item.name}
                    {item.required ? (
                      <b className="required-asterisk" aria-label="required">
                        *
                      </b>
                    ) : null}
                  </strong>
                  <p>{item.description}</p>
                  {item.doseCount ? (
                    <small>
                      {item.doseCount} documented{" "}
                      {item.doseCount === 1 ? "dose" : "doses"}
                    </small>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <DocumentUpload
        requirementId={requirement.id}
        categoryHint={requirement.documentCategory ?? undefined}
        expectedLabel={expectedLabel}
        activeDocument={selectedDocument}
        onUploaded={rememberDocument}
      />
      {extraction ? (
        <>
          <div
            className={`requirement-upload__result requirement-upload__result--${resultTone}`}
            role={resultTone === "warning" ? "alert" : "status"}
          >
            <span aria-hidden="true">{resultIcon}</span>
            <div>
              <strong>
                {extraction.status === "completed"
                  ? `Identified as ${humanize(extraction.documentType)}`
                  : extraction.status === "pending_configuration"
                    ? "Document stored; parsing is not configured"
                    : extraction.status === "failed"
                      ? "Document stored; parsing needs attention"
                      : "Document parsing is in progress"}
              </strong>
              <p>{extraction.summary}</p>
              {extraction.warnings.length ? (
                <ul>
                  {extraction.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          {selectedDocument &&
          selectedDocument.processingMode === "agentic" &&
          reviewPlacement === "inline" ? (
            <DocumentExtractionReview
              key={`${selectedDocument.id}:${selectedDocument.extraction?.status ?? "none"}:${selectedDocument.extraction?.processedAt ?? ""}`}
              document={selectedDocument}
              onDocumentChanged={rememberDocument}
            />
          ) : null}
          {extraction.immunizationCompliance ? (
            <section
              className="immunization-results"
              aria-labelledby="immunization-results-title"
            >
              <div>
                <p className="eyebrow">Policy check</p>
                <h3 id="immunization-results-title">
                  Requirements found in this record
                </h3>
                <p>
                  Checked with{" "}
                  {extraction.immunizationCompliance.policyVersion}.
                </p>
              </div>
              <ul>
                {extraction.immunizationCompliance.requirements.map((item) => (
                  <li
                    key={item.ruleId}
                    className={`immunization-results__item immunization-results__item--${item.status}`}
                  >
                    <span aria-hidden="true">
                      {item.status === "met"
                        ? "✓"
                        : item.status === "missing"
                          ? "!"
                          : "?"}
                    </span>
                    <div>
                      <strong>{item.name}</strong>
                      <small>{humanize(item.status)}</small>
                      <p>{item.rationale}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function IdentityPreview() {
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
  const maskedId = student?.studentId ? student.studentId.slice(-4) : "4821";

  return (
    <section className="requirement-preview requirement-preview--identity">
      <div className="requirement-preview__topline">
        <span>Live ID preview</span>
        <span aria-hidden="true">✦</span>
      </div>
      <div className="student-id-card" aria-label="Student ID preview">
        <div className="student-id-card__brand">
          <span>A</span>
          <strong>Aster University</strong>
        </div>
        <div className="student-id-card__body">
          <span className="student-id-card__avatar">
            {photoDocument ? (
              <Image
                alt="Profile photo extracted from your identity document"
                height={120}
                src={getStudentDocumentProfilePhotoUrl(photoDocument.id)}
                unoptimized
                width={96}
              />
            ) : (
              <span aria-hidden="true">{initials(student?.preferredName)}</span>
            )}
          </span>
          <div>
            <small>Student</small>
            <strong>{student?.preferredName || "Your name"}</strong>
            <span>Incoming class · 2027</span>
          </div>
        </div>
        <div className="student-id-card__footer">
          <span>ASTER ID •••• {maskedId}</span>
          <span>STUDENT</span>
        </div>
      </div>
      <p>
        {photoDocument
          ? "Your ID photo was located from the uploaded identity document. Staff review is still required before an official university ID is issued."
          : "After identity parsing locates a portrait, it will appear here for staff review before an official university ID is issued."}
      </p>
    </section>
  );
}

function TranscriptPreview({
  document,
  refreshKey,
}: {
  document: StudentDocument | null;
  refreshKey: number;
}) {
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
    <section
      className="requirement-preview requirement-preview--transcript"
      data-refresh-key={refreshKey}
    >
      <div className="requirement-preview__topline">
        <span>Academic insight</span>
        <span aria-hidden="true">↗</span>
      </div>
      {leadingRecommendation ? (
        <div className="transcript-insight transcript-insight--match">
          <span className="transcript-insight__label">Potential match</span>
          <div className="transcript-insight__route">
            <div>
              <small>Transcript evidence</small>
              <strong>{sourceCredit?.sourceCode ?? sourceCredit?.title}</strong>
              <span>
                {sourceCredit?.gradeOrScore
                  ? `Score / grade ${sourceCredit.gradeOrScore}`
                  : "Reviewed course evidence"}
              </span>
            </div>
            <b aria-hidden="true">→</b>
            <div>
              <small>Aster equivalent</small>
              <strong>{leadingRecommendation.targetCourseCode}</strong>
              <span>{leadingRecommendation.targetCourseTitle}</span>
            </div>
          </div>
          <p>{leadingRecommendation.rationale}</p>
          <div className="transcript-insight__notice">
            <span aria-hidden="true">◇</span>
            Prediction only · Registrar approval required
          </div>
        </div>
      ) : extraction?.status === "completed" ? (
        <div className="transcript-insight">
          <span className="transcript-insight__label">
            {academics.status === "loading"
              ? "Generating insight"
              : "Automatic insight generated"}
          </span>
          <strong>
            {academics.status === "loading"
              ? `Checking ${courses.length} ${courses.length === 1 ? "course" : "courses"} against Aster rules`
              : extraction?.courseExemptionEvaluation
                ? "No policy-backed equivalency matched yet"
                : "Course mapping needs advisor review"}
          </strong>
          <p>
            {academics.status === "loading"
              ? "The transcript was parsed successfully. Potential matches will appear here automatically."
              : extraction?.courseExemptionEvaluation
                ? `${courses.length} extracted ${courses.length === 1 ? "course was" : "courses were"} evaluated using the tenant's active ${academics.status === "ready" ? academics.data.catalogVersion : "catalog"}, program, prerequisites, equivalency rules, and versioned mapping prompt. An advisor can review every unmatched course.`
                : "Your extracted courses are preserved. The active tenant policy context was not available for an automatic recommendation, so an advisor will review them."}
          </p>
          <div className="transcript-insight__notice">
            <span aria-hidden="true">◇</span>
            Prompted recommendations never grant academic credit
          </div>
        </div>
      ) : (
        <div className="transcript-preview__paper">
          <div className="transcript-preview__paper-heading">
            <span>Academic record</span>
            <b>ASTER</b>
          </div>
          <div className="transcript-preview__lines" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="transcript-preview__match">
            <span>Course matching</span>
            <strong>
              {extraction?.status === "processing"
                ? "Reading your transcript"
                : extraction?.status === "failed"
                  ? "Paused until retry"
                  : "Begins after upload"}
            </strong>
          </div>
        </div>
      )}
      {!leadingRecommendation && extraction?.status !== "completed" ? (
        <p>
          Edward extracts every course and grade, then a tenant-versioned
          prompt evaluates the current catalog, program requirements,
          prerequisites, and equivalency rules for staff review.
        </p>
      ) : null}
    </section>
  );
}

function TranscriptRecordPanel({
  document,
  onDocumentChanged,
}: {
  document: StudentDocument | null;
  onDocumentChanged: (document: StudentDocument) => void;
}) {
  return (
    <section className="requirement-context-card transcript-review-panel">
      <p className="eyebrow">Parsed transcript</p>
      {!document ? (
        <>
          <h2>Your transcript view</h2>
          <div className="transcript-review-panel__empty">
            <span aria-hidden="true">↥</span>
            <p>
              A compact transcript summary will appear here after the original
              file is safely stored.
            </p>
          </div>
        </>
      ) : document.extraction?.status !== "completed" ? (
        <DocumentExtractionReview
          key={`${document.id}:${document.extraction?.status ?? "none"}:${document.extraction?.processedAt ?? ""}`}
          document={document}
          onDocumentChanged={onDocumentChanged}
        />
      ) : (
        <div className="transcript-record">
          <div className="transcript-record__heading">
            <div>
              <h2>Your transcript view</h2>
              <p>{document.fileName}</p>
            </div>
            <span>
              <i aria-hidden="true">✓</i> Parsed
            </span>
          </div>
          <dl className="transcript-record__facts">
            <div>
              <dt>Institution</dt>
              <dd>{document.extraction.institutionName ?? "Not identified"}</dd>
            </div>
            <div>
              <dt>Academic term</dt>
              <dd>{document.extraction.academicTerm ?? "Multiple terms"}</dd>
            </div>
            <div>
              <dt>Courses found</dt>
              <dd>{document.extraction.courses?.length ?? 0}</dd>
            </div>
          </dl>
          {document.extraction.courses?.length ? (
            <>
              <ul className="transcript-record__course-preview">
                {document.extraction.courses.slice(0, 3).map((course, index) => (
                  <li key={`${course.sourceCode ?? course.title}-${index}`}>
                    <span>{course.sourceCode ?? "Course"}</span>
                    <strong>{course.title}</strong>
                    <small>{course.grade ?? course.score ?? "Recorded"}</small>
                  </li>
                ))}
              </ul>
              {document.extraction.courses.length > 3 ? (
                <details className="transcript-record__more">
                  <summary>
                    View all {document.extraction.courses.length} parsed courses
                  </summary>
                  <ul>
                    {document.extraction.courses.slice(3).map((course, index) => (
                      <li key={`${course.sourceCode ?? course.title}-${index + 3}`}>
                        <span>{course.sourceCode ?? "Course"}</span>
                        {course.title}
                        {course.grade || course.score
                          ? ` · ${course.grade ?? course.score}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          ) : (
            <p className="transcript-record__empty">
              No course rows were readable. The original remains available for
              registrar review.
            </p>
          )}
          {document.extraction.warnings.length ? (
            <p className="transcript-record__warning">
              {document.extraction.warnings.length} parsing{" "}
              {document.extraction.warnings.length === 1 ? "note" : "notes"} ·
              the original remains available to staff.
            </p>
          ) : null}
        </div>
      )}
    </section>
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
  const selected = residenceOptions.find(
    (option) => option.value === plan?.residenceOption,
  );
  const preferenceLabel = plan?.preference
    ? humanize(plan.preference)
    : "Choose your housing path";

  return (
    <section className="requirement-preview requirement-preview--housing">
      <div className="requirement-preview__topline">
        <span>Your housing snapshot</span>
        <span aria-hidden="true">⌂</span>
      </div>
      <Image
        className="housing-preview__photo"
        height={420}
        src={
          selected?.image ??
          (plan?.preference === "off_campus"
            ? "/media/housing/aster-apartments-room.jpg"
            : "/media/housing/aster-residence-hall-room.jpg")
        }
        alt={
          selected?.imageAlt ??
          (plan?.preference === "off_campus"
            ? "Sample independent apartment living space"
            : "Sample Aster campus residence")
        }
        unoptimized
        width={960}
      />
      <strong>{selected?.title || preferenceLabel}</strong>
      <p>
        {selected
          ? selected.description
          : plan?.preference === "on_campus"
            ? "Your on-campus plan is selected. A specific residence can be chosen later."
            : plan?.preference
              ? "Your housing path is selected. Additional details can be decided later."
              : "Choose a housing path on the left to personalize this preview."}
      </p>
      {selected ? (
        <div className="housing-preview__amenities">
          {selected.amenities.map((amenity) => (
            <span key={amenity}>{amenity}</span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function GeneralPreview({ requirement }: { requirement: StudentRequirementDetail }) {
  const isComplete = ["completed", "waived", "not_applicable"].includes(
    requirement.status,
  );
  return (
    <section className="requirement-preview requirement-preview--general">
      <div className="requirement-preview__topline">
        <span>Your enrollment path</span>
        <span aria-hidden="true">✦</span>
      </div>
      <div className="general-preview__route" aria-hidden="true">
        <span className="general-preview__node general-preview__node--complete">✓</span>
        <span className="general-preview__line" />
        <span className="general-preview__node">{isComplete ? "✓" : ""}</span>
        <span className="general-preview__line" />
        <span className="general-preview__node">◌</span>
      </div>
      <strong>{isComplete ? "This step is recorded" : "One clear action at a time"}</strong>
      <p>
        {isComplete
          ? "You can return here at any time to review this completed enrollment task."
          : "Complete this step and Aster will refresh the next eligible tasks in your enrollment path."}
      </p>
    </section>
  );
}

type DepositWorkspaceData = {
  dashboard: StudentDashboard;
  payments: StudentPaymentList;
};

function DepositPaymentAction({
  dueAt,
  onPaid,
}: {
  dueAt: string | null;
  onPaid: () => void;
}) {
  const loadDeposit = useCallback(
    async (signal: AbortSignal): Promise<DepositWorkspaceData> => {
      const [dashboard, payments] = await Promise.all([
        getStudentDashboard(signal),
        getStudentPayments(signal),
      ]);
      return { dashboard, payments };
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
    return <InlineResourceState label="Loading your enrollment deposit…" />;
  }
  if (deposit.status === "error") {
    return (
      <InlineResourceState
        label=""
        message={deposit.error}
        onRetry={deposit.reload}
      />
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
      await pay.run(deposit.data.dashboard.offer.id, key);
      paymentIntentKey.current = null;
      deposit.refresh();
      onPaid();
    } catch {
      // Keep the same key so retrying cannot create a second deposit.
    }
  };

  return (
    <section className="deposit-inline-card" aria-label="Enrollment deposit payment">
      <div className="deposit-inline-card__heading">
        <span aria-hidden="true">$</span>
        <div>
          <p className="eyebrow">Enrollment deposit</p>
          <h3>Secure your place for the upcoming semester.</h3>
        </div>
        <StatusPill value={successfulPayment ? "succeeded" : "pending"} />
      </div>
      <dl className="deposit-inline-card__summary">
        <div>
          <dt>Deposit amount</dt>
          <dd>{formatMoney(deposit.data.dashboard.offer.depositAmountCents)}</dd>
          <small>Applied to first-semester tuition and fees.</small>
        </div>
        <div>
          <dt>Payment deadline</dt>
          <dd>{formatDueDate(dueAt)}</dd>
          <small>Your enrollment checklist updates immediately.</small>
        </div>
      </dl>
      <div className="deposit-inline-card__about">
        <strong>About this step</strong>
        <p>
          The deposit confirms your intent to attend Aster and unlocks housing
          assignment and course-registration preparation.
        </p>
      </div>
      <div className="deposit-inline-card__secure">
        <span aria-hidden="true">◇</span>
        <p>
          <strong>Secure development payment</strong>
          The current dummy processor records a payment result without
          collecting or charging card details.
        </p>
      </div>
      <ActionFeedback
        status={pay.status}
        error={pay.message}
        success="Your enrollment deposit is recorded and the checklist has been refreshed."
      />
      {successfulPayment ? (
        <p className="confirmed-line" role="status">
          <span aria-hidden="true">✓</span>
          Deposit received · {successfulPayment.processorReference}
        </p>
      ) : (
        <button
          className="button button--accent deposit-inline-card__pay"
          type="button"
          disabled={pay.status === "loading"}
          onClick={() => void submitPayment()}
        >
          {pay.status === "loading"
            ? "Processing deposit…"
            : pay.status === "error"
              ? "Retry deposit payment"
              : `Pay ${formatMoney(deposit.data.dashboard.offer.depositAmountCents)} deposit`}
        </button>
      )}
    </section>
  );
}

function RequirementPreview({
  requirement,
  kind,
  refreshKey,
  transcriptDocument,
  housingSelection,
}: {
  requirement: StudentRequirementDetail;
  kind: RequirementKind;
  refreshKey: number;
  transcriptDocument?: StudentDocument | null;
  housingSelection?: HousingPreviewSelection | null;
}) {
  if (kind === "identity") return <IdentityPreview key={`identity-${refreshKey}`} />;
  if (kind === "transcript") {
    return (
      <TranscriptPreview
        key={`transcript-${refreshKey}-${transcriptDocument?.id ?? "empty"}-${transcriptDocument?.status ?? "none"}`}
        document={transcriptDocument ?? null}
        refreshKey={refreshKey}
      />
    );
  }
  if (kind === "housing") {
    return (
      <HousingPreview
        key={`housing-${refreshKey}`}
        selection={housingSelection ?? null}
      />
    );
  }
  return <GeneralPreview requirement={requirement} />;
}

function RequirementAction({
  requirement,
  kind,
  onRecordChanged,
  onDocumentSelected,
  onHousingPreviewChange,
}: {
  requirement: StudentRequirementDetail;
  kind: RequirementKind;
  onRecordChanged: () => void;
  onDocumentSelected?: (document: StudentDocument | null) => void;
  onHousingPreviewChange?: (selection: HousingPreviewSelection) => void;
}) {
  if (requirement.status === "blocked") {
    return (
      <div className="requirement-next-action" role="status">
        <span aria-hidden="true">→</span>
        <div>
          <strong>Complete the prerequisite task first.</strong>
          <p>
            This action will unlock automatically when the earlier enrollment
            requirement is complete.
          </p>
          <Link className="button button--secondary" href="/enrollment">
            Back to enrollment <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    );
  }
  if (kind === "profile") {
    return <ProfileAction onSaved={onRecordChanged} />;
  }
  if (kind === "housing") {
    return (
      <HousingAction
        onSaved={onRecordChanged}
        onPreviewChange={onHousingPreviewChange ?? (() => undefined)}
      />
    );
  }
  if (requirement.submissionType === "document") {
    return (
      <DocumentAction
        requirement={requirement}
        onUploaded={() => onRecordChanged()}
        reviewPlacement={kind === "transcript" ? "context" : "inline"}
        onDocumentSelected={
          kind === "transcript" ? onDocumentSelected : undefined
        }
      />
    );
  }
  if (kind === "payment") {
    return (
      <DepositPaymentAction
        dueAt={requirement.dueAt}
        onPaid={onRecordChanged}
      />
    );
  }
  return (
    <div className="requirement-next-action">
      <span aria-hidden="true">?</span>
      <div>
        <strong>This step needs assistance from Aster.</strong>
        <p>
          Your enrollment advisor can explain the next action and record any
          required exception.
        </p>
        <Link className="button button--secondary" href="/help">
          Get enrollment help <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

export default function RequirementDetailPage() {
  const params = useParams<{ slug: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [transcriptDocument, setTranscriptDocument] =
    useState<StudentDocument | null>(null);
  const [housingSelection, setHousingSelection] =
    useState<HousingPreviewSelection | null>(null);
  const loadRequirement = useCallback(
    (signal: AbortSignal) => getStudentRequirement(slug, signal),
    [slug],
  );
  const requirement = useApiResource(loadRequirement);
  const kind = useMemo(
    () => (requirement.status === "ready" ? requirementKind(requirement.data) : null),
    [requirement.data, requirement.status],
  );
  const refreshAfterRecordChange = useCallback(() => {
    setPreviewRefreshKey((current) => current + 1);
    requirement.refresh();
  }, [requirement]);
  const refreshAfterTranscriptChange = useCallback(
    (document: StudentDocument) => {
      setTranscriptDocument(document);
      refreshAfterRecordChange();
    },
    [refreshAfterRecordChange],
  );

  const pageDescription =
    kind === "transcript"
      ? "Upload your transcript to discover potential course exemptions and unlock AI-powered course and career planning."
      : "Complete this step here. Your enrollment record will update as soon as Aster receives the change.";

  return (
    <PortalShell
      active="enrollment"
      eyebrow="Enrollment task"
      title={requirement.data?.title || "Requirement details"}
      description={pageDescription}
      actions={
        <Link className="button button--secondary" href="/enrollment">
          ← Back to enrollment
        </Link>
      }
    >
      {requirement.status === "loading" ? (
        <LoadingState label="Loading your enrollment task" />
      ) : requirement.status === "error" ? (
        <ErrorState
          message={
            requirement.errorStatus === 400 || requirement.errorStatus === 404
              ? "We couldn’t find that enrollment task."
              : requirement.error
          }
          onRetry={requirement.reload}
        />
      ) : (
        <div className="requirement-workspace">
          <section className="card requirement-workspace__action">
            <div className="requirement-workspace__action-heading">
              <div>
                <p className="eyebrow">Your action</p>
                <h2>{requirement.data.title}</h2>
              </div>
              <StatusPill value={requirement.data.status} />
            </div>
            <p className="requirement-workspace__description">
              {requirement.data.description}
            </p>
            <RequirementAction
              requirement={requirement.data}
              kind={kind ?? "other"}
              onRecordChanged={refreshAfterRecordChange}
              onDocumentSelected={setTranscriptDocument}
              onHousingPreviewChange={setHousingSelection}
            />
          </section>
          <aside className="requirement-workspace__context">
            <RequirementPreview
              requirement={requirement.data}
              kind={kind ?? "other"}
              refreshKey={previewRefreshKey}
              transcriptDocument={transcriptDocument}
              housingSelection={housingSelection}
            />
            {kind === "transcript" ? (
              <TranscriptRecordPanel
                document={transcriptDocument}
                onDocumentChanged={refreshAfterTranscriptChange}
              />
            ) : (
              <section className="requirement-context-card">
                <p className="eyebrow">Why we ask</p>
                <h2>One protected step toward your place at Aster.</h2>
                <p>
                  {requirement.data.responsibleOffice} confirms this information
                  before it becomes part of your enrollment record.
                </p>
                <dl className="requirement-context-card__details">
                  <div>
                    <dt>Managed by</dt>
                    <dd>{requirement.data.responsibleOffice}</dd>
                  </div>
                  <div>
                    <dt>Due</dt>
                    <dd>{formatDueDate(requirement.data.dueAt)}</dd>
                  </div>
                  <div>
                    <dt>Task progress</dt>
                    <dd>{requirement.data.progressPercent}%</dd>
                  </div>
                  <div>
                    <dt>Requirement</dt>
                    <dd>{requirement.data.blocking ? "Required" : "Optional"}</dd>
                  </div>
                </dl>
              </section>
            )}
            {requirement.data.status === "blocked" &&
            requirement.data.dependencyCodes.length > 0 ? (
              <section className="requirement-context-card requirement-context-card--dependency">
                <p className="eyebrow">Complete first</p>
                <h2>Before this task</h2>
                <ul>
                  {requirement.data.dependencyCodes.map((code) => (
                    <li key={code}>
                      <span aria-hidden="true">→</span>
                      {humanize(code)}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
      )}
    </PortalShell>
  );
}
