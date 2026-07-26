"use client";

import type {
  AdmissionOfferSummary,
  OnboardingStep,
  StudentDashboard,
  StudentOnboarding,
  StudentOnboardingData,
  StudentPaymentList,
  UpdateStudentOnboardingInput,
} from "@vv/contracts";
import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { PortalMark } from "../components/portal-ui";
import {
  getApiErrorMessage,
  useApiAction,
  useApiResource,
} from "../hooks/use-api-resource";
import {
  acceptAdmissionOffer,
  completeStudentOnboarding,
  createDepositPayment,
  getStudentDashboard,
  getStudentBootstrap,
  getStudentOnboarding,
  getStudentPayments,
  updateStudentOnboarding,
} from "../lib/api-client";

const onboardingSteps: {
  key: OnboardingStep;
  label: string;
  title: string;
  subtitle: string;
  skippable?: boolean;
}[] = [
  {
    key: "offer",
    label: "Offer",
    title: "Your place at Aster",
    subtitle: "Begin by confirming the admission decision that brought you here.",
  },
  {
    key: "about_you",
    label: "About you",
    title: "Identity & home address",
    subtitle: "Confirm the details Aster uses to protect your student record.",
  },
  {
    key: "housing",
    label: "Housing",
    title: "One personalized story",
    subtitle: "Tell us where you imagine starting your Aster experience.",
    skippable: true,
  },
  {
    key: "campus_life",
    label: "Campus life",
    title: "Clubs, people & support",
    subtitle: "Choose the communities and support you want to hear about.",
    skippable: true,
  },
  {
    key: "emergency_contacts",
    label: "Emergency contacts",
    title: "People in your corner",
    subtitle: "Confirm that Aster has the emergency contact information you trust.",
  },
  {
    key: "other_records",
    label: "Other records",
    title: "ID, health & access",
    subtitle: "Review the records that keep services safe and accessible.",
  },
  {
    key: "family_permissions",
    label: "Family permissions",
    title: "FERPA access by person",
    subtitle: "Review who may receive information about your student record.",
  },
  {
    key: "review_and_sign",
    label: "Review & sign",
    title: "Your document packet",
    subtitle: "Review your choices and provide your electronic confirmation.",
  },
  {
    key: "deposit",
    label: "Deposit",
    title: "Secure your place",
    subtitle: "Acknowledge the enrollment deposit and finish your onboarding.",
  },
];

const campusInterestOptions = [
  ["student_organizations", "Student organizations"],
  ["arts_and_culture", "Arts & culture"],
  ["athletics_and_wellness", "Athletics & wellness"],
  ["community_service", "Community service"],
  ["career_network", "Career network"],
] as const;

const supportNeedOptions = [
  ["academic_advising", "Academic advising"],
  ["accessibility_services", "Accessibility services"],
  ["financial_guidance", "Financial guidance"],
  ["wellbeing_support", "Wellbeing support"],
] as const;

/**
 * `skippedSteps` is server-managed progress metadata. It is returned with the
 * onboarding resource so the UI can label optional steps, but must never be
 * echoed back as editable step data. Keeping that boundary here prevents a
 * later optional step from being rejected after an earlier one was skipped.
 */
function editableOnboardingData(data: StudentOnboardingData) {
  const editableData = { ...data };
  delete editableData.skippedSteps;
  return editableData;
}

type OnboardingPageData = {
  onboarding: StudentOnboarding;
  dashboard: StudentDashboard;
  payments: StudentPaymentList;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function OnboardingProgress({
  current,
  completed,
  skipped,
}: {
  current: OnboardingStep;
  completed: OnboardingStep[];
  skipped: OnboardingStep[];
}) {
  const currentIndex = onboardingSteps.findIndex((step) => step.key === current);

  return (
    <aside className="onboarding-progress" aria-label="Onboarding progress">
      <Link className="brand onboarding-brand" href="/onboarding">
        <PortalMark />
        <span>
          <strong>Aster</strong>
          <small>University</small>
        </span>
      </Link>
      <div className="onboarding-progress__heading">
        <p className="eyebrow">Getting started</p>
        <h2>Your path to Aster</h2>
        <p>{completed.length} of {onboardingSteps.length} steps saved</p>
      </div>
      <ol>
        {onboardingSteps.map((step, index) => {
          const isComplete = completed.includes(step.key);
          const isCurrent = step.key === current;
          const wasSkipped = skipped.includes(step.key);
          return (
            <li
              className={`${isComplete ? "onboarding-step--complete " : ""}${isCurrent ? "onboarding-step--current" : ""}`}
              aria-current={isCurrent ? "step" : undefined}
              key={step.key}
            >
              <span aria-hidden="true">{isComplete ? "✓" : index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <small>
                  {isComplete
                    ? wasSkipped
                      ? "Skipped for now"
                      : "Saved"
                    : isCurrent
                      ? "In progress"
                      : index > currentIndex
                        ? "Upcoming"
                        : "Ready"}
                </small>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="onboarding-resume">
        <span aria-hidden="true">↻</span>
        <p>
          <strong>Safe to pause</strong>
          Your last server-confirmed step is saved.
        </p>
      </div>
    </aside>
  );
}

function Choice({
  name,
  value,
  label,
  defaultChecked,
  type = "checkbox",
  required,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
  type?: "checkbox" | "radio";
  required?: boolean;
}) {
  return (
    <label className="choice-card">
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        required={required}
      />
      <span aria-hidden="true" />
      <strong>{label}</strong>
    </label>
  );
}

function StepFields({
  step,
  data,
  offer,
  depositPaid,
}: {
  step: OnboardingStep;
  data: StudentOnboardingData;
  offer: AdmissionOfferSummary;
  depositPaid: boolean;
}) {
  switch (step) {
    case "offer":
      return (
        <>
          <div className="onboarding-offer">
            <p className="eyebrow">Admission offer</p>
            <h3>{offer.programName}</h3>
            <p>{offer.termName} · {offer.campusName}</p>
            <dl>
              <div>
                <dt>Respond by</dt>
                <dd>
                  {new Intl.DateTimeFormat("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(offer.responseDeadline))}
                </dd>
              </div>
              <div>
                <dt>Deposit</dt>
                <dd>{formatMoney(offer.depositAmountCents)}</dd>
              </div>
            </dl>
          </div>
          {offer.status === "offered" ? (
            <label className="confirmation-check">
              <input name="offerAccepted" type="checkbox" required />
              <span>
                <strong>I accept my offer of admission to Aster University.</strong>
                I understand this decision will be recorded in my official
                admissions record.
              </span>
            </label>
          ) : (
            <p className="confirmed-line">
              <span aria-hidden="true">✓</span>
              Your admission offer is {offer.status}.
            </p>
          )}
        </>
      );
    case "about_you":
      return (
        <>
          <fieldset className="form-section">
            <legend>Create your student profile</legend>
            <div className="form-grid">
              <label className="field">
                <span>First name</span>
                <input
                  name="firstName"
                  required
                  maxLength={120}
                  autoComplete="given-name"
                  defaultValue={data.firstName ?? ""}
                />
              </label>
              <label className="field">
                <span>Last name</span>
                <input
                  name="lastName"
                  required
                  maxLength={120}
                  autoComplete="family-name"
                  defaultValue={data.lastName ?? ""}
                />
              </label>
              <label className="field">
                <span>Preferred name</span>
                <input
                  name="preferredName"
                  required
                  maxLength={120}
                  autoComplete="nickname"
                  defaultValue={data.preferredName ?? ""}
                />
              </label>
              <label className="field">
                <span>Mobile phone</span>
                <input
                  name="mobilePhone"
                  type="tel"
                  required
                  maxLength={32}
                  autoComplete="tel"
                  defaultValue={data.mobilePhone ?? ""}
                />
              </label>
            </div>
          </fieldset>
          <fieldset className="form-section">
            <legend>Confirm your student record</legend>
            <label className="confirmation-check">
              <input
                name="legalNameConfirmed"
                type="checkbox"
                defaultChecked={data.legalNameConfirmed}
                required
              />
              <span>
                <strong>My legal identity is correct</strong>
                I reviewed the legal name associated with my student record.
              </span>
            </label>
            <label className="confirmation-check">
              <input
                name="contactInformationConfirmed"
                type="checkbox"
                defaultChecked={data.contactInformationConfirmed}
                required
              />
              <span>
                <strong>My contact details are current</strong>
                Aster can use my confirmed contact information for enrollment.
              </span>
            </label>
            <label className="confirmation-check">
              <input
                name="homeAddressConfirmed"
                type="checkbox"
                defaultChecked={data.homeAddressConfirmed}
                required
              />
              <span>
                <strong>My home address is current</strong>
                I reviewed the address held in my official record.
              </span>
            </label>
          </fieldset>
          <fieldset className="form-section">
            <legend>Residency status</legend>
            <div className="choice-grid">
              <Choice
                type="radio"
                name="residencyStatus"
                value="domestic"
                label="Domestic student"
                defaultChecked={data.residencyStatus === "domestic"}
                required
              />
              <Choice
                type="radio"
                name="residencyStatus"
                value="international"
                label="International student"
                defaultChecked={data.residencyStatus === "international"}
                required
              />
            </div>
          </fieldset>
          <fieldset className="form-section">
            <legend>Preferred communication</legend>
            <div className="choice-grid">
              <Choice
                type="radio"
                name="communicationPreference"
                value="email"
                label="Email"
                defaultChecked={data.communicationPreference === "email"}
                required
              />
              <Choice
                type="radio"
                name="communicationPreference"
                value="sms"
                label="SMS"
                defaultChecked={data.communicationPreference === "sms"}
                required
              />
            </div>
          </fieldset>
        </>
      );
    case "housing":
      return (
        <fieldset className="form-section">
          <legend>Where are you planning to live?</legend>
          <p>Your answer helps tailor housing guidance. It is not a housing contract.</p>
          <div className="choice-grid">
            <Choice
              type="radio"
              name="housingPreference"
              value="on_campus"
              label="On campus"
              defaultChecked={data.housingPreference === "on_campus"}
              required
            />
            <Choice
              type="radio"
              name="housingPreference"
              value="off_campus"
              label="Off campus"
              defaultChecked={data.housingPreference === "off_campus"}
              required
            />
            <Choice
              type="radio"
              name="housingPreference"
              value="undecided"
              label="Still deciding"
              defaultChecked={data.housingPreference === "undecided"}
              required
            />
          </div>
        </fieldset>
      );
    case "campus_life":
      return (
        <>
          <fieldset className="form-section">
            <legend>What would you like to explore?</legend>
            <p>Choose any communities you want Aster to introduce.</p>
            <div className="choice-grid choice-grid--multi">
              {campusInterestOptions.map(([value, label]) => (
                <Choice
                  name="campusInterests"
                  value={value}
                  label={label}
                  defaultChecked={data.campusInterests?.includes(value)}
                  key={value}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="form-section">
            <legend>Support you may want</legend>
            <div className="choice-grid choice-grid--multi">
              {supportNeedOptions.map(([value, label]) => (
                <Choice
                  name="supportNeeds"
                  value={value}
                  label={label}
                  defaultChecked={data.supportNeeds?.includes(value)}
                  key={value}
                />
              ))}
            </div>
          </fieldset>
        </>
      );
    case "emergency_contacts":
      return (
        <label className="confirmation-check confirmation-check--large">
          <input
            name="emergencyContactConfirmed"
            type="checkbox"
            defaultChecked={data.emergencyContactConfirmed}
            required
          />
          <span>
            <strong>I reviewed my emergency contact information</strong>
            The people listed in my official record are the right people for
            Aster to contact in an urgent situation.
          </span>
        </label>
      );
    case "other_records":
      return (
        <label className="confirmation-check confirmation-check--large">
          <input
            name="recordsConfirmed"
            type="checkbox"
            defaultChecked={data.recordsConfirmed}
            required
          />
          <span>
            <strong>I reviewed my ID, health, and access records</strong>
            I understand Aster may request verified documents separately, and
            this confirmation does not replace those requirements.
          </span>
        </label>
      );
    case "family_permissions":
      return (
        <label className="confirmation-check confirmation-check--large">
          <input
            name="familyPermissionsReviewed"
            type="checkbox"
            defaultChecked={data.familyPermissionsReviewed}
            required
          />
          <span>
            <strong>I reviewed family and delegate access</strong>
            FERPA permissions are granted to specific people and scopes. No one
            receives access just because they are a family member.
          </span>
        </label>
      );
    case "review_and_sign":
      return (
        <>
          <div className="review-summary">
            <h3>Your saved choices</h3>
            <dl>
              <div>
                <dt>Residency</dt>
                <dd>{data.residencyStatus?.replace("_", " ") || "Not provided"}</dd>
              </div>
              <div>
                <dt>Housing</dt>
                <dd>{data.housingPreference?.replace("_", " ") || "Not provided"}</dd>
              </div>
              <div>
                <dt>Communication</dt>
                <dd>{data.communicationPreference || "Not provided"}</dd>
              </div>
              <div>
                <dt>Campus interests</dt>
                <dd>{data.campusInterests?.length || 0} selected</dd>
              </div>
            </dl>
          </div>
          <label className="confirmation-check">
            <input
              name="signatureConfirmed"
              type="checkbox"
              defaultChecked={data.signatureConfirmed}
              required
            />
            <span>
              <strong>This is my electronic confirmation</strong>
              I reviewed this onboarding packet and confirm my responses are
              accurate to the best of my knowledge.
            </span>
          </label>
        </>
      );
    case "deposit":
      return (
        <>
          <div className="deposit-callout">
            <span>Enrollment deposit</span>
            <strong>{formatMoney(offer.depositAmountCents)}</strong>
            <p>
              {depositPaid
                ? "Payment received through Aster’s secure processor."
                : "The amount is set by your admission offer and will be processed when you continue."}
            </p>
          </div>
          <label className="confirmation-check">
            <input
              name="depositAcknowledged"
              type="checkbox"
              defaultChecked={data.depositAcknowledged}
              required
            />
            <span>
              <strong>I understand the enrollment deposit</strong>
              {depositPaid
                ? "My payment is recorded and I acknowledge the deposit terms."
                : "Continuing will record the deposit through the development payment processor."}
            </span>
          </label>
        </>
      );
  }
}

function dataFromForm(
  step: OnboardingStep,
  form: HTMLFormElement,
  current: StudentOnboardingData,
): StudentOnboardingData {
  const values = new FormData(form);
  const next = { ...current };

  switch (step) {
    case "offer":
      return next;
    case "about_you":
      return {
        ...next,
        firstName: String(values.get("firstName") ?? "").trim(),
        lastName: String(values.get("lastName") ?? "").trim(),
        preferredName: String(values.get("preferredName") ?? "").trim(),
        mobilePhone: String(values.get("mobilePhone") ?? "").trim(),
        legalNameConfirmed: values.get("legalNameConfirmed") === "on",
        contactInformationConfirmed:
          values.get("contactInformationConfirmed") === "on",
        homeAddressConfirmed: values.get("homeAddressConfirmed") === "on",
        communicationPreference: values.get(
          "communicationPreference",
        ) as StudentOnboardingData["communicationPreference"],
        residencyStatus: values.get(
          "residencyStatus",
        ) as StudentOnboardingData["residencyStatus"],
      };
    case "housing":
      return {
        ...next,
        housingPreference: values.get(
          "housingPreference",
        ) as StudentOnboardingData["housingPreference"],
      };
    case "campus_life":
      return {
        ...next,
        campusInterests: values.getAll("campusInterests").map(String),
        supportNeeds: values.getAll("supportNeeds").map(String),
      };
    case "emergency_contacts":
      return {
        ...next,
        emergencyContactConfirmed:
          values.get("emergencyContactConfirmed") === "on",
      };
    case "other_records":
      return {
        ...next,
        recordsConfirmed: values.get("recordsConfirmed") === "on",
      };
    case "family_permissions":
      return {
        ...next,
        familyPermissionsReviewed:
          values.get("familyPermissionsReviewed") === "on",
      };
    case "review_and_sign":
      return {
        ...next,
        signatureConfirmed: values.get("signatureConfirmed") === "on",
      };
    case "deposit":
      return {
        ...next,
        depositAcknowledged: values.get("depositAcknowledged") === "on",
      };
  }
}

function OnboardingFlow({
  initial,
  dashboard,
  initialPayments,
  reload,
}: {
  initial: StudentOnboarding;
  dashboard: StudentDashboard;
  initialPayments: StudentPaymentList;
  reload: () => void;
}) {
  const [onboarding, setOnboarding] = useState(initial);
  const [offer, setOffer] = useState(dashboard.offer);
  const [depositPaid, setDepositPaid] = useState(
    initialPayments.items.some((payment) => payment.status === "succeeded"),
  );
  const [error, setError] = useState<string | null>(null);
  const completeKey = useRef<string | null>(null);
  const offerKey = useRef<string | null>(null);
  const depositKey = useRef<string | null>(null);
  const saveAction = useCallback(
    (input: UpdateStudentOnboardingInput) => updateStudentOnboarding(input),
    [],
  );
  const save = useApiAction(saveAction);
  const completeAction = useCallback(
    (expectedVersion: number, key: string) =>
      completeStudentOnboarding({ expectedVersion }, key),
    [],
  );
  const complete = useApiAction(completeAction);
  const stepIndex = onboardingSteps.findIndex(
    (step) => step.key === onboarding.currentStep,
  );
  const step = onboardingSteps[stepIndex] || onboardingSteps[0];
  const allStepsSaved = onboardingSteps.every(({ key }) =>
    onboarding.completedSteps.includes(key),
  );
  const offerCannotAdvance =
    onboarding.currentStep === "offer" &&
    offer.status !== "offered" &&
    offer.status !== "accepted";

  useEffect(() => {
    if (onboarding.status === "completed") {
      window.location.replace("/dashboard");
    }
  }, [onboarding.status]);

  const submitStep = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    save.reset();
    const nextData = editableOnboardingData(
      dataFromForm(
        onboarding.currentStep,
        event.currentTarget,
        onboarding.data,
      ),
    );

    if (
      onboarding.currentStep === "campus_life" &&
      (!nextData.campusInterests || nextData.campusInterests.length === 0)
    ) {
      setError("Choose at least one campus interest to continue.");
      return;
    }

    try {
      if (onboarding.currentStep === "offer" && offer.status === "offered") {
        const key = offerKey.current ?? (offerKey.current = crypto.randomUUID());
        await acceptAdmissionOffer(offer.id, key);
        offerKey.current = null;
        setOffer((current) => ({ ...current, status: "accepted" }));
      }
      if (onboarding.currentStep === "deposit" && !depositPaid) {
        const key =
          depositKey.current ?? (depositKey.current = crypto.randomUUID());
        await createDepositPayment({ offerId: offer.id }, key);
        depositKey.current = null;
        setDepositPaid(true);
      }
      const result = await save.run({
        expectedVersion: onboarding.version,
        currentStep: onboarding.currentStep,
        data: nextData,
      });
      setOnboarding(result);
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    }
  };

  const finish = async () => {
    setError(null);
    complete.reset();
    const key =
      completeKey.current ?? (completeKey.current = crypto.randomUUID());
    try {
      const result = await complete.run(onboarding.version, key);
      completeKey.current = null;
      setOnboarding(result);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    }
  };

  const skipStep = async () => {
    setError(null);
    save.reset();
    try {
      const result = await save.run({
        expectedVersion: onboarding.version,
        currentStep: onboarding.currentStep,
        data: editableOnboardingData(onboarding.data),
        skip: true,
      });
      setOnboarding(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    }
  };

  return (
    <div className="onboarding-shell">
      <OnboardingProgress
        current={onboarding.currentStep}
        completed={onboarding.completedSteps}
        skipped={onboarding.data.skippedSteps ?? []}
      />
      <main className="onboarding-main">
        <header className="onboarding-mobile-header">
          <Link className="brand" href="/onboarding">
            <PortalMark />
            <span>
              <strong>Aster</strong>
              <small>University</small>
            </span>
          </Link>
          <span>{onboarding.completedSteps.length}/{onboardingSteps.length} saved</span>
        </header>
        <div className="onboarding-stage">
          <header className="onboarding-title">
            <div className="onboarding-title__count">
              <span>Step</span>
              <strong>{stepIndex + 1}</strong>
              <small>of {onboardingSteps.length}</small>
            </div>
            <div>
              <p className="eyebrow">{step.label}</p>
              <h1>{step.title}</h1>
              <p>{step.subtitle}</p>
            </div>
          </header>

          <form
            className="onboarding-form"
            key={`${onboarding.currentStep}-${onboarding.version}`}
            onSubmit={submitStep}
          >
            <StepFields
              step={onboarding.currentStep}
              data={onboarding.data}
              offer={offer}
              depositPaid={depositPaid}
            />
            {error || save.message || complete.message ? (
              <p className="field-error" role="alert">
                {error || save.message || complete.message}
              </p>
            ) : null}
            <div className="onboarding-actions">
              <p>
                <span aria-hidden="true">✓</span>
                Saved progress is available on any signed-in device.
              </p>
              {offerCannotAdvance ? (
                <a className="button button--primary" href="mailto:admissions@aster.edu">
                  Get help with this offer <span aria-hidden="true">→</span>
                </a>
              ) : allStepsSaved ? (
                <button
                  className="button button--primary"
                  type="button"
                  disabled={complete.status === "loading"}
                  onClick={() => void finish()}
                >
                  {complete.status === "loading"
                    ? "Finishing onboarding…"
                    : complete.status === "error"
                      ? "Retry completion"
                      : "Finish onboarding"}
                  <span aria-hidden="true">→</span>
                </button>
              ) : (
                <div className="onboarding-actions__controls">
                  {step.skippable ? (
                    <button
                      className="text-button"
                      type="button"
                      disabled={save.status === "loading"}
                      onClick={() => void skipStep()}
                    >
                      Skip for now
                    </button>
                  ) : null}
                  <button
                    className="button button--primary"
                    type="submit"
                    disabled={save.status === "loading"}
                  >
                    {save.status === "loading"
                      ? onboarding.currentStep === "offer" &&
                        offer.status === "offered"
                        ? "Accepting offer…"
                        : onboarding.currentStep === "deposit" && !depositPaid
                          ? "Processing deposit…"
                        : "Saving step…"
                      : save.status === "error"
                        ? "Retry step"
                        : onboarding.currentStep === "offer" &&
                            offer.status === "offered"
                          ? "Accept and continue"
                          : onboarding.currentStep === "deposit" && !depositPaid
                            ? `Pay ${formatMoney(offer.depositAmountCents)} and continue`
                            : "Save and continue"}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}
            </div>
            {save.status === "error" || complete.status === "error" ? (
              <button
                className="text-button"
                type="button"
                onClick={reload}
              >
                Reload latest saved progress
              </button>
            ) : null}
          </form>

          <aside className="why-card">
            <span aria-hidden="true">i</span>
            <div>
              <strong>Why we ask</strong>
              <p>
                Aster uses this information only to prepare your student record,
                personalize support, and meet university obligations. Official
                changes are always confirmed by the server.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function OnboardingResource() {
  const loadOnboarding = useCallback(
    async (signal: AbortSignal): Promise<OnboardingPageData> => {
      const [onboarding, dashboard, payments] = await Promise.all([
        getStudentOnboarding(signal),
        getStudentDashboard(signal),
        getStudentPayments(signal),
      ]);
      return { onboarding, dashboard, payments };
    },
    [],
  );
  const onboarding = useApiResource(loadOnboarding);

  if (onboarding.status === "loading") {
    return (
      <main className="load-state" aria-busy="true" aria-live="polite">
        <div className="load-state__card">
          <PortalMark />
          <p className="eyebrow">Aster University</p>
          <h1>Resuming your onboarding</h1>
          <p>We’re opening your last server-confirmed step.</p>
          <span className="loader" aria-hidden="true" />
        </div>
      </main>
    );
  }

  if (onboarding.status === "error") {
    return (
      <main className="load-state">
        <div className="load-state__card" role="alert">
          <PortalMark />
          <p className="eyebrow">Aster University</p>
          <h1>Your onboarding couldn’t open</h1>
          <p>{onboarding.error}</p>
          <button
            className="button button--primary"
            type="button"
            onClick={onboarding.reload}
          >
            Try again
          </button>
          <a className="text-link" href="mailto:enrollment@aster.edu">
            Get help
          </a>
        </div>
      </main>
    );
  }

  return (
    <OnboardingFlow
      initial={onboarding.data.onboarding}
      dashboard={onboarding.data.dashboard}
      initialPayments={onboarding.data.payments}
      reload={onboarding.reload}
      key={onboarding.data.onboarding.version}
    />
  );
}

export default function OnboardingPage() {
  const loadBootstrap = useCallback(
    (signal: AbortSignal) => getStudentBootstrap(signal),
    [],
  );
  const bootstrap = useApiResource(loadBootstrap);
  const alreadyComplete =
    bootstrap.data?.onboarding.status === "completed" ||
    bootstrap.data?.onboarding.required === false;
  const needsSignIn =
    bootstrap.status === "error" &&
    (bootstrap.errorStatus === 401 || bootstrap.errorStatus === 403);

  useEffect(() => {
    if (needsSignIn) {
      window.location.replace("/sign-in");
    } else if (alreadyComplete) {
      window.location.replace("/dashboard");
    }
  }, [alreadyComplete, needsSignIn]);

  if (bootstrap.status === "loading" || needsSignIn || alreadyComplete) {
    return (
      <main className="load-state" aria-busy="true" aria-live="polite">
        <div className="load-state__card">
          <PortalMark />
          <p className="eyebrow">Aster University</p>
          <h1>Checking your onboarding</h1>
          <p>We’re opening the right place for your saved progress.</p>
          <span className="loader" aria-hidden="true" />
        </div>
      </main>
    );
  }

  if (bootstrap.status === "error") {
    return (
      <main className="load-state">
        <div className="load-state__card" role="alert">
          <PortalMark />
          <p className="eyebrow">Aster University</p>
          <h1>We couldn’t confirm your onboarding</h1>
          <p>{bootstrap.error}</p>
          <button
            className="button button--primary"
            type="button"
            onClick={bootstrap.reload}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return <OnboardingResource />;
}
