"use client";
import type {
  AdmissionOfferSummary,
  CompleteStudentFerpaInput,
  FerpaDelegateInput,
  HousingPreference,
  OnboardingEmergencyContact,
  OnboardingStep,
  StudentBootstrap,
  StudentDashboard,
  StudentDocument,
  StudentDocumentCategory,
  StudentDocumentList,
  StudentFerpaAuthorization,
  StudentFerpaDelegate,
  StudentHousingPlan,
  StudentHousingResidence,
  StudentOnboarding,
  StudentOnboardingData,
  StudentPaymentList,
  StudentProfile,
  UpdateStudentOnboardingInput,
} from "@vv/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "../design-system/Icon.jsx";
import Notice from "../design-system/patterns/Notice.jsx";
import PageHero from "../design-system/patterns/PageHero.jsx";
import StepRail from "../design-system/patterns/StepRail.jsx";
import { PortalMark } from "../components/portal-ui";
import { useTenant } from "../components/tenant-provider";
import { getApiErrorMessage, useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  ApiClientError,
  acceptAdmissionOffer,
  completeStudentFerpaAuthorization,
  completeStudentOnboarding,
  createDepositPayment,
  getCampusLife,
  getStudentBootstrap,
  getStudentDashboard,
  getStudentDocuments,
  getStudentFerpaAuthorization,
  getStudentHousingPlan,
  getStudentOnboarding,
  getStudentPayments,
  getStudentProfile,
  issueStudentFerpaDelegateLink,
  signOutStudent,
  updateStudentFerpaAccess,
  updateStudentOnboarding,
  updateStudentProfile,
} from "../lib/api-client";
import { latestDocumentForCategory } from "../lib/document-extraction-ui";
import { formatTenantDate, formatTenantMoney } from "../lib/tenant";
import { getPostAcceptanceRoute } from "./offer-acceptance";
import {
  CITIZENSHIP,
  type ContactDraft,
  type OnboardingDraft,
  type ScreenId,
  TOTAL_SCREENS,
  allResolved,
  contactProblem,
  emptyContact,
  emptyDraft,
  firstUnresolved,
  isReachable,
  isSkipped,
  LOCK_REASON,
  meter,
  normalizedPhone,
  progressLine,
  railSteps,
  readDraft,
  recordFrom,
  savedCount,
  screenById,
  screenNumber,
  screensFor,
  writeDraft,
} from "./flow";
import {
  coreFieldsOf,
  customFieldProblem,
  customPagesOf,
  type CustomValue,
} from "./steps/ConfiguredFields";
import { OfferStep } from "./steps/OfferStep";
import { DetailsStep, type DetailsProblems } from "./steps/DetailsStep";
import { ContactStep, type ContactProblems } from "./steps/ContactStep";
import { HousingStep } from "./steps/HousingStep";
import { HealthStep } from "./steps/HealthStep";
import { EmergencyStep } from "./steps/EmergencyStep";
import { PermissionsStep } from "./steps/PermissionsStep";
import { PhotoStep } from "./steps/PhotoStep";
import { ReviewStep, type SigningDocument } from "./steps/ReviewStep";
import { DepositStep } from "./steps/DepositStep";
import { StepActions } from "./steps/StepActions";
import { FinishCard } from "./steps/FinishCard";
import { ClosedOffer } from "./steps/ClosedOffer";
import { CelebrationModal } from "./overlays/CelebrationModal";
import { DeclineModal } from "./overlays/DeclineModal";
import { AuthorizeModal, emptyAuthorization, type AuthorizeDraft } from "./overlays/AuthorizeModal";
import { WaiverModal } from "./overlays/WaiverModal";
import { HallDrawer } from "./overlays/HallDrawer";
import { HelpLadder, rungsFor } from "./overlays/HelpLadder";

/**
 * The platform's eight onboarding steps, in the order it enforces them. The
 * ten screens of the flow (`./flow.ts`) map onto these; two screens share
 * `about_you`, and the photo screen writes a document rather than a step.
 *
 * `skippable` is platform policy. This flow offers no skip on those steps —
 * the deposit has a waiver instead, and the health step needs nothing that
 * cannot be answered — but a student who set one aside in an earlier version
 * still sees it read back as set aside.
 */
const onboardingSteps: ReadonlyArray<{ key: OnboardingStep; skippable?: boolean }> = [
  // Screen 1, Your offer: accepted through the admission-offer command first.
  { key: "offer" },
  // Screens 2 and 3, Confirm your details and How we reach you: one record,
  // written once from the second screen, edited from either afterwards.
  { key: "about_you" },
  // Screen 4, Where you will live: the preference and up to three ranked halls.
  { key: "housing" },
  // Screen 5, Health and accessibility: the accommodation interest; the
  // immunization record is a document, not step data.
  { key: "campus_life" },
  // Screen 6, Emergency contact: one to three people to call.
  { key: "emergency_contacts" },
  // Screen 7, Who can see your record: the FERPA authorization writes itself;
  // this step records that the question was answered.
  { key: "family_permissions" },
  // Screen 8, Your student photo, has no step. Screen 9, Review and sign.
  { key: "review_and_sign" },
  // Screen 10, Deposit: a payment first when paying now, then the choice.
  { key: "deposit", skippable: true },
];

/**
 * `skippedSteps` is server-managed progress metadata. It is returned with the
 * onboarding resource so the UI can label optional steps, but must never be
 * echoed back as editable step data.
 */
function editableOnboardingData(data: StudentOnboardingData) {
  const editableData = { ...data };
  delete editableData.skippedSteps;
  for (const legacyField of [
    "legalNameConfirmed",
    "contactInformationConfirmed",
    "homeAddressConfirmed",
    "emergencyContactConfirmed",
    "recordsConfirmed",
    "familyPermissionsReviewed",
    "signatureConfirmed",
    "depositAcknowledged",
  ]) {
    delete (editableData as Record<string, unknown>)[legacyField];
  }
  return editableData;
}

function realProfileName(value: string | null | undefined, placeholder: string) {
  const normalized = value?.trim();
  return normalized && normalized.toLowerCase() !== placeholder.toLowerCase()
    ? normalized
    : undefined;
}

const TENANT_DOCUMENT_ASSET_PREFIXES = new Set(["aster", "harvard"]);
const DEFAULT_DOCUMENT_ASSET_PREFIX = "aster";

/** Every institution reaches the signing step: a tenant without its own
 *  artwork falls back to the standard templates rather than losing the fields. */
function onboardingDocumentsForTenant(tenantSlug: string): SigningDocument[] {
  const assetPrefix = TENANT_DOCUMENT_ASSET_PREFIXES.has(tenantSlug)
    ? tenantSlug
    : DEFAULT_DOCUMENT_ASSET_PREFIX;
  return [
    {
      id: "enrollment_acknowledgment",
      title: "Enrollment Information Acknowledgment",
      pdf: `/documents/onboarding/${assetPrefix}-enrollment-acknowledgment.pdf`,
      preview: `/documents/onboarding/${assetPrefix}-enrollment-acknowledgment-page-1.png`,
      apart: null,
    },
  ];
}

function ferpaDocumentForTenant(tenantSlug: string, tenantShortName: string): SigningDocument {
  const assetPrefix = TENANT_DOCUMENT_ASSET_PREFIXES.has(tenantSlug)
    ? tenantSlug
    : DEFAULT_DOCUMENT_ASSET_PREFIX;
  return {
    id: "ferpa_release",
    title: `${tenantShortName} FERPA Information Release`,
    pdf: `/documents/onboarding/${assetPrefix}-ferpa-release.pdf`,
    preview: `/documents/onboarding/${assetPrefix}-ferpa-release-page-1.png`,
    apart:
      "This is the acknowledgment of the right itself. Who can see your record is where you name a person and choose what they may see.",
  };
}

type OnboardingPageData = {
  onboarding: StudentOnboarding;
  dashboard: StudentDashboard;
  payments: StudentPaymentList;
  profile: StudentProfile;
  housingPlan: StudentHousingPlan;
  documents: StudentDocumentList;
  ferpa: StudentFerpaAuthorization | null;
};

type Overlay =
  | { kind: "celebrate" }
  | { kind: "decline" }
  | { kind: "authorize" }
  | { kind: "waiver" }
  | { kind: "hall"; hall: StudentHousingResidence }
  | { kind: "help" };

type FlowNotice = { tone: "info" | "alert"; text: string };

const DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
const SHORT_DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

/** The one-time delegate links issued in this tab, kept across a remount. */
const oneTimeLinks = new Map<string, Record<string, string>>();

function identityPrefill(document: StudentDocument | null): Partial<StudentOnboardingData> {
  const extraction = document?.extraction;
  if (
    document?.status === "rejected" ||
    extraction?.status !== "completed" ||
    extraction.documentType !== "identity"
  ) {
    return {};
  }
  const values = new Map(
    extraction.fields.map((field) => [field.key, String(field.value ?? "").trim()]),
  );
  const fullName = extraction.studentName?.trim() ?? "";
  const parts = fullName.split(/\s+/).filter(Boolean);
  const candidate: Partial<StudentOnboardingData> = {
    firstName: values.get("first_name") || parts[0] || "",
    lastName: values.get("last_name") || (parts.length > 1 ? parts.slice(1).join(" ") : ""),
    streetAddress: values.get("street_address") || "",
    city: values.get("city") || "",
    stateOrProvince: values.get("state_or_province") || "",
    postalCode: values.get("postal_code") || "",
    country: values.get("country") || "",
  };
  return Object.fromEntries(Object.entries(candidate).filter(([, value]) => value));
}

function identityMessage(document: StudentDocument | null) {
  const extraction = document?.extraction;
  if (!document) return null;
  if (document.status === "rejected") return null;
  if (extraction?.status === "processing") {
    return "Your ID is stored. Any details it carries are filled in for you once it has been read.";
  }
  if (extraction?.status === "failed" || extraction?.status === "pending_configuration") {
    return "Your ID is stored, and it could not be read automatically. Type anything missing yourself; a person reviews the original.";
  }
  if (extraction?.status === "completed" && extraction.documentType === "identity") {
    return "Details from your ID were filled in where a field was empty. Check them before you carry on.";
  }
  if (extraction?.status === "completed") {
    return "The file is stored, but it was not recognised as an identity document. Send the ID itself, or ask for help.";
  }
  return null;
}

function OnboardingFlow({
  initial,
  dashboard,
  initialPayments,
  housingPlan,
  initialDocuments,
  initialFerpa,
  profile,
  reload,
}: {
  initial: StudentOnboarding;
  dashboard: StudentDashboard;
  initialPayments: StudentPaymentList;
  housingPlan: StudentHousingPlan;
  initialDocuments: StudentDocumentList;
  initialFerpa: StudentFerpaAuthorization | null;
  profile: StudentProfile;
  reload: () => void;
}) {
  const tenantRuntime = useTenant();
  const { tenant } = tenantRuntime;
  const institution = tenant.shortName;
  const admissionsContact = tenant.contacts.admissions ?? tenant.contacts.support;
  const admissionsHref = admissionsContact.url
    ? tenantRuntime.href(admissionsContact.url)
    : admissionsContact.email
      ? `mailto:${admissionsContact.email}`
      : null;

  const [onboarding, setOnboarding] = useState(initial);
  const [offer, setOffer] = useState<AdmissionOfferSummary>(dashboard.offer);
  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    typeof window === "undefined" ? emptyDraft() : readDraft(initial.studentId),
  );
  const [documents, setDocuments] = useState<StudentDocument[]>(initialDocuments.items);
  const [ferpa, setFerpa] = useState(initialFerpa);
  const [profileVersion, setProfileVersion] = useState(profile.version);
  const [depositPayment, setDepositPayment] = useState(() =>
    initialPayments.items.find((payment) => payment.status === "succeeded") ?? null,
  );

  const deadline = formatTenantDate(offer.responseDeadline, tenant, DATE);
  // A university may rename a built-in screen from the journey builder. The
  // configured label, title and description win over the flow's own words;
  // `about_you` is two screens, and its configuration names the first.
  const screenConfigurations = onboarding.screenConfigurations;
  const screens = useMemo(
    () =>
      screensFor({ institution, deadline }).map((candidate) => {
        if (!candidate.step || candidate.id === "contact") return candidate;
        const configured = screenConfigurations?.[candidate.step];
        if (!configured) return candidate;
        return {
          ...candidate,
          name: configured.label || candidate.name,
          question: tenantRuntime.copy(configured.title || candidate.question),
          lede: tenantRuntime.copy(configured.description || candidate.lede),
        };
      }),
    [institution, deadline, screenConfigurations, tenantRuntime],
  );
  const record = useMemo(() => recordFrom(onboarding, draft.local), [onboarding, draft.local]);
  const data = useMemo<StudentOnboardingData>(
    () => ({ ...onboarding.data, ...draft.data }),
    [onboarding.data, draft.data],
  );

  const [screenId, setScreenId] = useState<ScreenId>(() => firstUnresolved(screens, record));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<FlowNotice | null>(null);
  const [resumeShown, setResumeShown] = useState(true);
  const [attempted, setAttempted] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [authorizing, setAuthorizing] = useState<AuthorizeDraft | null>(null);
  const [authorizeError, setAuthorizeError] = useState<string | null>(null);
  const [ferpaBusy, setFerpaBusy] = useState(false);
  const [revealedLinks, setRevealedLinks] = useState<Record<string, string>>(
    () => (initialFerpa ? oneTimeLinks.get(initialFerpa.id) ?? {} : {}),
  );
  const [copied, setCopied] = useState<string | null>(null);
  const [helpReached, setHelpReached] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "" });
  const [signature, setSignature] = useState("");
  const [reviewScrolled, setReviewScrolled] = useState(0);

  const heading = useRef<HTMLElement>(null);
  const lastScreen = useRef<ScreenId | null>(null);
  const offerKey = useRef<string | null>(null);
  const depositKey = useRef<string | null>(null);
  const completeKey = useRef<string | null>(null);
  const ferpaKeys = useRef<Record<string, string>>({});
  const prefilledFrom = useRef<string | null>(null);

  const save = useApiAction(
    useCallback((input: UpdateStudentOnboardingInput) => updateStudentOnboarding(input), []),
  );
  const complete = useApiAction(
    useCallback(
      (expectedVersion: number, key: string) => completeStudentOnboarding({ expectedVersion }, key),
      [],
    ),
  );

  useEffect(() => {
    writeDraft(onboarding.studentId, draft);
  }, [draft, onboarding.studentId]);

  useEffect(() => {
    if (onboarding.status === "completed" && complete.status !== "success") {
      window.location.replace(tenantRuntime.href("/dashboard"));
    }
  }, [onboarding.status, complete.status, tenantRuntime]);

  useEffect(() => {
    if (lastScreen.current !== null && lastScreen.current !== screenId) heading.current?.focus();
    lastScreen.current = screenId;
  }, [screenId]);

  /* What the ID says fills in what is still empty, once per document. */
  const absorbIdentity = useCallback(
    (document: StudentDocument | null) => {
      if (!document || document.category !== "identity") return;
      if (prefilledFrom.current === document.id) return;
      if (document.extraction?.status !== "completed") return;
      prefilledFrom.current = document.id;
      const candidate = identityPrefill(document);
      setDraft((current) => {
        const merged = { ...onboarding.data, ...current.data };
        const patch: Partial<StudentOnboardingData> = {};
        for (const [key, value] of Object.entries(candidate) as Array<[keyof StudentOnboardingData, string]>) {
          if (!String(merged[key] ?? "").trim()) (patch as Record<string, unknown>)[key] = value;
        }
        return Object.keys(patch).length ? { ...current, data: { ...current.data, ...patch } } : current;
      });
    },
    [onboarding.data],
  );

  /* The platform opens the FERPA authorization when the journey reaches it,
     so the screens that read it ask again on arrival rather than trusting the
     copy loaded with the page. */
  useEffect(() => {
    if (screenId !== "permissions" && screenId !== "review") return undefined;
    let cancelled = false;
    getStudentFerpaAuthorization()
      .then((envelope) => {
        if (cancelled) return;
        setFerpa((current) => {
          const next = envelope.authorization;
          if (!next) return current;
          if (current && current.id === next.id && current.version > next.version) return current;
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [screenId]);

  /* Documents still being read are polled until they are not. */
  const processingIds = documents
    .filter((document) => document.extraction?.status === "processing")
    .map((document) => document.id)
    .join(",");
  useEffect(() => {
    if (!processingIds) return undefined;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (attempts > 30) {
        window.clearInterval(timer);
        return;
      }
      getStudentDocuments()
        .then((list) => {
          setDocuments(list.items);
          absorbIdentity(latestDocumentForCategory(list.items, "identity"));
        })
        .catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [processingIds, absorbIdentity]);

  const identityDocument = latestDocumentForCategory(documents, "identity");
  const residencyDocument = latestDocumentForCategory(documents, "residency");
  const immunizationDocument = latestDocumentForCategory(documents, "health");
  const photoDocument = latestDocumentForCategory(documents, "other");

  const sentOn = (document: StudentDocument | null) =>
    document ? formatTenantDate(document.createdAt, tenant, SHORT_DATE) : null;

  const screen = screenById(screens, screenId) ?? screens[0];
  const closed = offer.status === "declined" || offer.status === "expired";
  const finished = allResolved(screens, record);
  const preferred =
    data.preferredName?.trim() ||
    data.firstName?.trim() ||
    realProfileName(dashboard.student.preferredName, "Student") ||
    "there";
  const legalName = [data.firstName, data.lastName].filter((part) => part?.trim()).join(" ");
  const today = formatTenantDate(new Date(), tenant, DATE);
  const classYear = `Class of ${dashboard.student.classYear}`;

  const patch = (values: Partial<StudentOnboardingData>) =>
    setDraft((current) => ({ ...current, data: { ...current.data, ...values } }));
  const patchCustom = (id: string, value: CustomValue) =>
    setDraft((current) => ({
      ...current,
      data: {
        ...current.data,
        customFields: { ...(onboarding.data.customFields ?? {}), ...(current.data.customFields ?? {}), [id]: value },
      },
    }));

  const contacts: ContactDraft[] = useMemo(() => {
    if (draft.contacts?.length) return draft.contacts;
    const saved = onboarding.data.emergencyContacts ?? [];
    return saved.length
      ? saved.map((contact) => ({
          fullName: contact.fullName,
          relationship: contact.relationship,
          mobilePhone: contact.mobilePhone,
          email: contact.email ?? "",
        }))
      : [emptyContact()];
  }, [draft.contacts, onboarding.data.emergencyContacts]);
  const setContacts = (next: ContactDraft[]) =>
    setDraft((current) => ({ ...current, contacts: next }));

  const openHelp = () => {
    setHelpReached(0);
    setOverlay({ kind: "help" });
  };

  function goTo(id: ScreenId) {
    setNotice(null);
    setFailed(null);
    setProblem(null);
    setReviewScrolled(0);
    setAttempted(false);
    setScreenId(id);
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  function openScreen(id: ScreenId) {
    const target = screenById(screens, id);
    if (!target) return;
    const stepOrder = onboardingSteps.map((step) => step.key);
    const behindPlatform =
      !target.step || stepOrder.indexOf(target.step) <= stepOrder.indexOf(onboarding.currentStep);
    if (behindPlatform && isReachable(screens, target, record, screenId)) {
      goTo(id);
      return;
    }
    setNotice({
      tone: "alert",
      text:
        target.id !== "offer" && !record.offerAnswered
          ? `${target.name} isn’t open yet. It ${LOCK_REASON.replace(/^Opens/, "opens")}.`
          : `Finish the step you are on first. ${target.name} comes after it.`,
    });
  }

  const withScreenConfiguration = (result: StudentOnboarding): StudentOnboarding => ({
    ...result,
    configurationVersion: result.configurationVersion ?? onboarding.configurationVersion,
    screenConfigurations: result.screenConfigurations ?? onboarding.screenConfigurations,
  });

  /** The only path by which a platform step becomes saved. */
  async function putStep(step: OnboardingStep, values: Partial<StudentOnboardingData>) {
    const nextData = editableOnboardingData({ ...onboarding.data, ...values });
    const result = await save.run({
      expectedVersion: onboarding.version,
      currentStep: step,
      data: nextData,
    });
    const next = withScreenConfiguration(result);
    setOnboarding(next);
    return next;
  }

  /* ---- what each screen needs before it can be saved ------------------- */

  const aboutYouConfiguration = onboarding.screenConfigurations?.about_you;
  const coreFields = useMemo(() => coreFieldsOf(aboutYouConfiguration), [aboutYouConfiguration]);
  const customPages = useMemo(() => customPagesOf(aboutYouConfiguration), [aboutYouConfiguration]);
  const requiredCore = new Set<keyof StudentOnboardingData>(
    aboutYouConfiguration?.requiredFields ?? [
      "firstName",
      "lastName",
      "preferredName",
      "personalEmail",
      "mobilePhone",
      "citizenshipStatus",
    ],
  );
  for (const [column, field] of coreFields) if (field.required) requiredCore.add(column);

  const detailsProblems: DetailsProblems = {
    firstName: !data.firstName?.trim() ? "Add your first name." : undefined,
    lastName: !data.lastName?.trim() ? "Add your last name." : undefined,
    citizenshipStatus: !data.citizenshipStatus ? "Choose one. It decides which ID is accepted." : undefined,
  };
  const customProblems: Record<string, string | null> = {};
  for (const page of customPages) {
    for (const field of page.fields) {
      customProblems[field.id] = customFieldProblem(field, data.customFields?.[field.id]);
    }
  }
  const detailsValid =
    !Object.values(detailsProblems).some(Boolean) &&
    !Object.values(customProblems).some(Boolean);

  const domestic = data.citizenshipStatus ? CITIZENSHIP[data.citizenshipStatus].domestic : true;
  const contactProblems: ContactProblems = {
    personalEmail: !data.personalEmail?.includes("@") ? "Add an email address you read." : undefined,
    mobilePhone: !data.mobilePhone?.trim() ? "Add a mobile number." : undefined,
    streetAddress: requiredCore.has("streetAddress") && !data.streetAddress?.trim() ? "Add your street address." : undefined,
    city: requiredCore.has("city") && !data.city?.trim() ? "Add your city." : undefined,
    stateOrProvince: requiredCore.has("stateOrProvince") && !data.stateOrProvince?.trim() ? "Add your state or province." : undefined,
    postalCode: requiredCore.has("postalCode") && !data.postalCode?.trim() ? "Add your postal code." : undefined,
    country: requiredCore.has("country") && !data.country?.trim() ? "Choose your country." : undefined,
    residencyVerificationPath:
      domestic && !data.residencyVerificationPath ? "Choose how the Registrar confirms your address." : undefined,
  };
  const contactValid =
    !Object.values(contactProblems).some(Boolean) && Boolean(data.communicationPreference);

  const contactIssues = contacts.map((contact, index) => contactProblem(contact, index === 0));
  const emergencyValid = !contactIssues.some(Boolean);

  const signingDocuments: SigningDocument[] = useMemo(() => {
    const docs = [...onboardingDocumentsForTenant(tenant.slug)];
    if (
      ferpa &&
      ferpa.flowKind === "onboarding" &&
      ferpa.document.status !== "signed" &&
      ferpa.capabilities.canSign
    ) {
      docs.unshift(ferpaDocumentForTenant(tenant.slug, tenant.shortName));
    }
    return docs;
  }, [ferpa, tenant.slug, tenant.shortName]);
  const signatureMatches =
    signature.trim().length > 0 &&
    signature.trim().toLowerCase() === legalName.trim().toLowerCase();

  const depositPaid = Boolean(depositPayment);
  const depositValid =
    depositPaid ||
    (data.depositChoice === "pay_now"
      ? card.number.replace(/\s/g, "").length >= 12 && card.expiry.trim() && card.cvc.trim()
      : Boolean(data.depositChoice));

  function problemFor(id: ScreenId): string | null {
    switch (id) {
      case "details":
        return detailsValid ? null : "A field above still needs an answer.";
      case "contact":
        return contactValid
          ? null
          : !data.communicationPreference
            ? `Choose where ${institution} should write first.`
            : "A field above still needs an answer.";
      case "housing":
        return data.housingPreference ? null : "Choose where you will live. Every answer is a complete one.";
      case "emergency":
        return emergencyValid ? null : contactIssues.find(Boolean) ?? null;
      case "review":
        return signatureMatches
          ? null
          : reviewScrolled < signingDocuments.length
            ? `Scroll ${signingDocuments.length > 1 ? "both documents" : "the document"} to the end. The signature opens once ${signingDocuments.length > 1 ? "they have" : "it has"} been scrolled.`
            : signature.trim()
              ? `The signature has to match your legal name exactly: ${legalName}.`
              : "Type your full legal name in the signature field to sign.";
      case "deposit":
        return depositValid
          ? null
          : data.depositChoice === "pay_now"
            ? "Complete the card details, or choose another way to pay."
            : "Choose how you will pay the deposit.";
      default:
        return null;
    }
  }

  /* ---- writing ---------------------------------------------------------- */

  function aboutYouPayload(): Partial<StudentOnboardingData> {
    const customFields = { ...(onboarding.data.customFields ?? {}), ...(data.customFields ?? {}) };
    return {
      firstName: data.firstName?.trim(),
      lastName: data.lastName?.trim(),
      preferredName: data.preferredName?.trim() || data.firstName?.trim(),
      personalEmail: data.personalEmail?.trim().toLowerCase(),
      mobilePhone: normalizedPhone(data.mobilePhone ?? ""),
      citizenshipStatus: data.citizenshipStatus,
      communicationPreference: data.communicationPreference ?? "email",
      residencyStatus: data.citizenshipStatus === "international" ? "international" : "domestic",
      residencyVerificationPath: domestic ? data.residencyVerificationPath : undefined,
      streetAddress: data.streetAddress?.trim() || undefined,
      addressLine2: data.addressLine2?.trim() || undefined,
      city: data.city?.trim() || undefined,
      stateOrProvince: data.stateOrProvince?.trim() || undefined,
      postalCode: data.postalCode?.trim() || undefined,
      country: data.country?.trim() || undefined,
      customFields,
    };
  }

  async function savePronouns() {
    if (draft.pronouns === undefined || draft.pronouns === profile.pronouns) return;
    try {
      const updated = await updateStudentProfile({
        expectedVersion: profileVersion,
        pronouns: draft.pronouns,
      });
      setProfileVersion(updated.version);
    } catch {
      // Pronouns live on the profile and can be set there later; a refusal
      // here must not hold up the step that owns the record.
    }
  }

  function afterSave(next: StudentOnboarding, local = draft.local) {
    setDraft((current) => ({ ...current, data: {}, contacts: undefined, local }));
    setResumeShown(false);
    setNotice(null);
    setProblem(null);
    setAttempted(false);
    const following = firstUnresolved(screens, recordFrom(next, local));
    setScreenId(following);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function markLocal(kind: "done" | "skipped", id: ScreenId) {
    const local = {
      done: kind === "done" ? [...new Set([...draft.local.done, id])] : draft.local.done.filter((item) => item !== id),
      skipped: kind === "skipped" ? [...new Set([...draft.local.skipped, id])] : draft.local.skipped.filter((item) => item !== id),
    };
    setDraft((current) => ({ ...current, local }));
    setNotice(null);
    setAttempted(false);
    setScreenId(firstUnresolved(screens, recordFrom(onboarding, local)));
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function signFerpaWithoutDelegates() {
    if (!ferpa || ferpa.document.status === "signed" || !ferpa.capabilities.canSign) return;
    const key = ferpaKeys.current.review ||= crypto.randomUUID();
    const input: CompleteStudentFerpaInput = {
      expectedVersion: ferpa.version,
      signature: { accepted: true, signerName: signature.trim(), signatureMethod: "typed" },
      accessDecision: ferpa.delegates.length ? "grant" : "no_access",
      delegates: ferpa.delegates.map(delegateInput),
    };
    const result = await completeStudentFerpaAuthorization(ferpa.requirementId, input, key);
    ferpaKeys.current.review = "";
    if (result.authorization) setFerpa(result.authorization);
  }

  async function commit() {
    if (saving) return;
    setAttempted(true);
    const blocking = problemFor(screen.id);
    if (blocking) {
      setFailed(null);
      setProblem(blocking);
      return;
    }
    setProblem(null);
    setSaving(true);
    setFailed(null);
    setConflict(false);
    save.reset();
    try {
      switch (screen.id) {
        case "details": {
          if (onboarding.completedSteps.includes("about_you")) {
            await savePronouns();
            afterSave(await putStep("about_you", aboutYouPayload()));
          } else {
            markLocal("done", "details");
          }
          break;
        }
        case "contact": {
          await savePronouns();
          const next = await putStep("about_you", aboutYouPayload());
          afterSave(next, {
            ...draft.local,
            done: draft.local.done.filter((item) => item !== "details"),
          });
          break;
        }
        case "housing": {
          const preference = data.housingPreference as HousingPreference;
          const ranking = preference === "on_campus" ? data.housingResidencePreferences ?? [] : [];
          afterSave(
            await putStep("housing", {
              housingPreference: preference,
              housingResidencePreferences: ranking,
              housingResidenceOption: ranking[0] ?? null,
            }),
          );
          break;
        }
        case "health": {
          afterSave(
            await putStep("campus_life", {
              accommodationInterest: data.accommodationInterest ?? "not_now",
            }),
          );
          break;
        }
        case "emergency": {
          const emergencyContacts: OnboardingEmergencyContact[] = contacts
            .filter((contact) => contact.fullName.trim() && contact.relationship)
            .map((contact) => ({
              fullName: contact.fullName.trim(),
              relationship: contact.relationship as OnboardingEmergencyContact["relationship"],
              mobilePhone: normalizedPhone(contact.mobilePhone),
              ...(contact.email.trim() ? { email: contact.email.trim().toLowerCase() } : {}),
            }));
          afterSave(await putStep("emergency_contacts", { emergencyContacts }));
          break;
        }
        case "permissions": {
          afterSave(await putStep("family_permissions", {}));
          break;
        }
        case "photo": {
          markLocal("done", "photo");
          break;
        }
        case "review": {
          await signFerpaWithoutDelegates();
          afterSave(
            await putStep("review_and_sign", {
              signatureFullName: signature.trim(),
              signatureMethod: "typed",
              signatureConsent: true,
              signedDocumentIds: onboardingDocumentsForTenant(tenant.slug).map((doc) => doc.id),
            }),
          );
          break;
        }
        case "deposit": {
          const choice = depositPaid ? "pay_now" : data.depositChoice;
          if (choice === "pay_now" && !depositPaid) {
            const key = depositKey.current ?? (depositKey.current = crypto.randomUUID());
            const payment = await createDepositPayment({ offerId: offer.id }, key);
            depositKey.current = null;
            setDepositPayment(payment);
          }
          afterSave(await putStep("deposit", { depositChoice: choice }));
          break;
        }
        default:
          break;
      }
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.status === 409) setConflict(true);
      setFailed(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function acceptOffer() {
    if (accepting) return;
    setAccepting(true);
    setFailed(null);
    try {
      const wasOffered = offer.status === "offered";
      if (wasOffered) {
        const key = offerKey.current ?? (offerKey.current = crypto.randomUUID());
        const acceptance = await acceptAdmissionOffer(offer.id, key);
        offerKey.current = null;
        const postAcceptanceRoute = getPostAcceptanceRoute(acceptance);
        if (postAcceptanceRoute) {
          window.location.replace(tenantRuntime.href(postAcceptanceRoute));
          return;
        }
        setOffer((current) => ({ ...current, status: "accepted" }));
      }
      if (!onboarding.completedSteps.includes("offer")) {
        const next = await putStep("offer", {});
        setDraft((current) => ({ ...current, data: {} }));
        setResumeShown(false);
        if (wasOffered) {
          setOverlay({ kind: "celebrate" });
        } else {
          setScreenId(firstUnresolved(screens, recordFrom(next, draft.local)));
        }
      } else {
        goTo("details");
      }
    } catch (caught) {
      setFailed(getApiErrorMessage(caught));
    } finally {
      setAccepting(false);
    }
  }

  async function finish() {
    setFailed(null);
    complete.reset();
    const key = completeKey.current ?? (completeKey.current = crypto.randomUUID());
    try {
      const result = await complete.run(onboarding.version, key);
      completeKey.current = null;
      setOnboarding(withScreenConfiguration(result));
      window.location.replace(tenantRuntime.href("/dashboard"));
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.status === 409) setConflict(true);
      setFailed(getApiErrorMessage(caught));
    }
  }

  async function leave() {
    setLeaving(true);
    try {
      await signOutStudent();
      window.location.replace(tenantRuntime.href("/sign-in"));
    } catch (caught) {
      setLeaving(false);
      setFailed(getApiErrorMessage(caught));
    }
  }

  /* ---- record access ---------------------------------------------------- */

  function delegateInput(delegate: StudentFerpaDelegate): FerpaDelegateInput {
    return {
      id: delegate.id,
      fullName: delegate.fullName,
      relationship: delegate.relationship,
      email: delegate.email,
      scopes: delegate.scopes,
    };
  }

  const linkUrl = (token: string) =>
    `${window.location.origin}${tenantRuntime.href("/delegate")}#token=${encodeURIComponent(token)}`;

  async function issueLinks(authorization: StudentFerpaAuthorization) {
    let updated = authorization;
    const links: Record<string, string> = {};
    for (const delegate of authorization.delegates) {
      if (delegate.link.status !== "not_issued") continue;
      try {
        const key = ferpaKeys.current[delegate.id] ||= crypto.randomUUID();
        const result = await issueStudentFerpaDelegateLink(updated.id, delegate.id, updated.version, key);
        ferpaKeys.current[delegate.id] = "";
        updated = {
          ...updated,
          version: result.authorizationVersion,
          delegates: updated.delegates.map((item) =>
            item.id === delegate.id
              ? { ...item, link: { ...item.link, status: "active", issuedAt: result.issuedAt } }
              : item,
          ),
        };
        links[delegate.id] = linkUrl(result.token);
      } catch {
        // A link that could not be issued is issued later from the profile.
      }
    }
    if (Object.keys(links).length) {
      const remembered = { ...(oneTimeLinks.get(authorization.id) ?? {}), ...links };
      oneTimeLinks.set(authorization.id, remembered);
      setRevealedLinks((current) => ({ ...current, ...links }));
    }
    return updated;
  }

  async function writeDelegates(delegates: FerpaDelegateInput[], signerName?: string) {
    if (!ferpa) return;
    const accessDecision = delegates.length ? "grant" : "no_access";
    const result =
      ferpa.status === "completed"
        ? await updateStudentFerpaAccess(ferpa.id, {
            expectedVersion: ferpa.version,
            accessDecision,
            delegates,
          })
        : await completeStudentFerpaAuthorization(
            ferpa.requirementId,
            {
              expectedVersion: ferpa.version,
              signature:
                ferpa.document.status === "signed" || !signerName
                  ? undefined
                  : { accepted: true, signerName, signatureMethod: "typed" },
              accessDecision,
              delegates,
            },
            ferpaKeys.current.complete ||= crypto.randomUUID(),
          );
    ferpaKeys.current.complete = "";
    if (!result.authorization) throw new Error("The updated record was not returned.");
    const withLinks =
      result.authorization.status === "completed" && accessDecision === "grant"
        ? await issueLinks(result.authorization)
        : result.authorization;
    setFerpa(withLinks);
    return withLinks;
  }

  async function saveAuthorization() {
    if (!ferpa || !authorizing) return;
    setFerpaBusy(true);
    setAuthorizeError(null);
    try {
      const delegates = [
        ...ferpa.delegates.map(delegateInput),
        {
          fullName: authorizing.fullName.trim(),
          relationship: authorizing.relationship as StudentFerpaDelegate["relationship"],
          email: authorizing.email.trim().toLowerCase(),
          scopes: authorizing.scopes,
        },
      ];
      await writeDelegates(delegates, authorizing.signature.trim());
      const name = authorizing.fullName.trim();
      const count = authorizing.scopes.length;
      setAuthorizing(null);
      setOverlay(null);
      setNotice({
        tone: "info",
        text: `${name} can now see ${count} ${count === 1 ? "page" : "pages"} of your record, through their own link.`,
      });
    } catch (caught) {
      setAuthorizeError(getApiErrorMessage(caught));
    } finally {
      setFerpaBusy(false);
    }
  }

  async function removeGrant(delegate: StudentFerpaDelegate) {
    if (!ferpa) return;
    setFerpaBusy(true);
    try {
      await writeDelegates(ferpa.delegates.filter((item) => item.id !== delegate.id).map(delegateInput));
      setNotice({
        tone: "info",
        text: `${delegate.fullName.split(" ")[0]} can no longer see anything in your record.`,
      });
    } catch (caught) {
      setFailed(getApiErrorMessage(caught));
    } finally {
      setFerpaBusy(false);
    }
  }

  async function copyLink(delegate: StudentFerpaDelegate, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(delegate.id);
      window.setTimeout(() => setCopied((current) => (current === delegate.id ? null : current)), 2500);
    } catch {
      window.prompt(`Copy the link for ${delegate.fullName}`, url);
    }
  }

  /* ---- ranking ---------------------------------------------------------- */

  const shortlist = data.housingResidencePreferences ?? [];
  function rank(value: string) {
    if (shortlist.includes(value) || shortlist.length >= 3) return;
    patch({ housingResidencePreferences: [...shortlist, value] });
  }
  function dropRank(value: string) {
    patch({ housingResidencePreferences: shortlist.filter((item) => item !== value) });
  }
  function moveRank(value: string, by: number) {
    const list = [...shortlist];
    const from = list.indexOf(value);
    const to = from + by;
    if (from < 0 || to < 0 || to >= list.length) return;
    list.splice(to, 0, list.splice(from, 1)[0]);
    patch({ housingResidencePreferences: list });
  }

  const remember = (category: StudentDocumentCategory) => (document: StudentDocument) => {
    setDocuments((current) => [
      document,
      ...current.filter((item) => item.id !== document.id && !(category === "other" && item.category === "other")),
    ]);
    absorbIdentity(document);
  };

  /* ---- what the screen says --------------------------------------------- */

  const resume = useMemo(() => {
    if (!resumeShown || finished || !onboarding.completedSteps.length) return null;
    if (onboarding.status !== "in_progress") return null;
    const last = [...screens].reverse().find((item) => item.step && onboarding.completedSteps.includes(item.step));
    if (!last) return null;
    return `Welcome back, ${preferred}. You saved through ${last.name} on ${formatTenantDate(onboarding.updatedAt, tenant, DATE)}.`;
  }, [resumeShown, finished, onboarding, screens, preferred, tenant]);

  const rungs = useMemo(() => rungsFor(tenant.contacts, tenantRuntime.href), [tenant.contacts, tenantRuntime]);

  function body() {
    if (finished) {
      return (
        <FinishCard
          institution={institution}
          saved={savedCount(screens, record)}
          skippedScreens={screens.filter((item) => isSkipped(item, record))}
          pending={complete.status === "loading" || complete.status === "success"}
          href={tenantRuntime.href}
          onFinish={finish}
        />
      );
    }

    switch (screen.id) {
      case "offer":
        return (
          <OfferStep
            offer={offer}
            institution={institution}
            deposit={formatTenantMoney(offer.depositAmountCents, tenant)}
            accepting={accepting}
            onAccept={acceptOffer}
            onDecline={() => setOverlay({ kind: "decline" })}
          />
        );
      case "details":
        return (
          <DetailsStep
            institution={institution}
            data={data}
            pronouns={draft.pronouns === undefined ? profile.pronouns : draft.pronouns}
            coreFields={coreFields}
            customPages={customPages}
            customProblems={attempted ? customProblems : {}}
            problems={attempted ? detailsProblems : {}}
            identityDocument={identityDocument}
            identitySentOn={sentOn(identityDocument)}
            identityMessage={identityMessage(identityDocument)}
            onChange={patch}
            onPronouns={(value) => setDraft((current) => ({ ...current, pronouns: value }))}
            onCustomChange={patchCustom}
            onUploaded={remember("identity")}
            onAskHelp={openHelp}
          />
        );
      case "contact":
        return (
          <ContactStep
            institution={institution}
            data={data}
            coreFields={coreFields}
            problems={attempted ? contactProblems : {}}
            residencyDocument={residencyDocument}
            residencySentOn={sentOn(residencyDocument)}
            onChange={patch}
            onUploaded={remember("residency")}
          />
        );
      case "housing":
        return (
          <HousingStep
            plan={data.housingPreference}
            shortlist={shortlist}
            residences={housingPlan.residences}
            onChange={(housingPreference) => patch({ housingPreference })}
            onOpenHall={(hall) => setOverlay({ kind: "hall", hall })}
            onRank={rank}
            onMove={moveRank}
            onDrop={dropRank}
          />
        );
      case "health":
        return (
          <HealthStep
            institution={institution}
            value={data.accommodationInterest}
            immunization={immunizationDocument}
            immunizationSentOn={sentOn(immunizationDocument)}
            onChange={(accommodationInterest) => patch({ accommodationInterest })}
            onUploaded={remember("health")}
          />
        );
      case "emergency":
        return (
          <EmergencyStep
            contacts={contacts}
            institution={institution}
            problems={attempted ? contactIssues : []}
            onChangeContact={(index, next) => setContacts(contacts.map((item, i) => (i === index ? next : item)))}
            onAddContact={() => setContacts([...contacts, emptyContact()])}
            onRemoveContact={(index) => setContacts(contacts.filter((_, i) => i !== index))}
          />
        );
      case "permissions":
        return (
          <PermissionsStep
            institution={institution}
            authorization={ferpa}
            contactName={contacts[0]?.fullName.trim() ?? ""}
            draft={authorizing}
            revealedLinks={revealedLinks}
            copied={copied}
            busy={ferpaBusy}
            signedOn={
              ferpa?.document.status === "signed"
                ? formatTenantDate(ferpa.document.signedAt, tenant, DATE)
                : null
            }
            onAdd={() => {
              setAuthorizing((current) => current ?? emptyAuthorization());
              setAuthorizeError(null);
              setOverlay({ kind: "authorize" });
            }}
            onResume={() => setOverlay({ kind: "authorize" })}
            onDiscard={() => setAuthorizing(null)}
            onRemove={removeGrant}
            onCopyLink={copyLink}
          />
        );
      case "photo":
        return <PhotoStep photo={photoDocument} onUploaded={remember("other")} />;
      case "review":
        return (
          <ReviewStep
            institution={institution}
            offer={offer}
            data={data}
            pronouns={draft.pronouns === undefined ? profile.pronouns : draft.pronouns}
            identityDocument={identityDocument}
            immunizationDocument={immunizationDocument}
            photoDocument={photoDocument}
            residences={housingPlan.residences}
            delegates={ferpa?.delegates ?? []}
            documents={signingDocuments}
            legalName={legalName}
            signature={signature}
            signatureError={attempted && signature.trim() && !signatureMatches ? `Type it exactly as it appears above: ${legalName}.` : undefined}
            signedOn={today}
            onEdit={goTo}
            onSign={(value) => {
              setSignature(value);
              setProblem(null);
            }}
            onScrolled={setReviewScrolled}
          />
        );
      default:
        return (
          <DepositStep
            amount={formatTenantMoney(offer.depositAmountCents, tenant)}
            deadline={deadline}
            paid={depositPaid}
            paidOn={depositPayment ? formatTenantDate(depositPayment.createdAt, tenant, DATE) : null}
            value={data.depositChoice}
            card={card}
            onChange={(depositChoice) => patch({ depositChoice })}
            onCard={(values) => setCard((current) => ({ ...current, ...values }))}
            onWaiver={() => setOverlay({ kind: "waiver" })}
          />
        );
    }
  }

  const working = !finished && !closed;
  const panel = working && screen.id === "housing" && data.housingPreference === "on_campus" && shortlist.length > 0;

  if (closed) {
    return (
      <div className="onboarding closed">
        <main className="flow-page" id="onboarding-main">
          <header className="topbar flow-topbar">
            <div className="topbar-title" />
            <div className="topbar-actions">
              <button type="button" className="topbar-chip flow-leave" onClick={leave} disabled={leaving}>
                Sign out
              </button>
            </div>
          </header>
          <div className="flow-body">
            <div className="flow-measure">
              <ClosedOffer
                offer={offer}
                institution={institution}
                deadline={deadline}
                admissions={{ label: admissionsContact.label, href: admissionsHref }}
              />
            </div>
          </div>
        </main>
        {overlay?.kind === "help" && (
          <HelpLadder rungs={rungs} reached={helpReached} onDeeper={() => setHelpReached((n) => n + 1)} onClose={() => setOverlay(null)} />
        )}
      </div>
    );
  }

  return (
    <div className="onboarding">
      <StepRail
        brand={{
          mark: <PortalMark />,
          name: tenant.name,
          line: tenant.academicContext.academicYearLabel,
        }}
        greeting={finished ? `You’re all set, ${preferred}.` : `Let’s get you set up, ${preferred}.`}
        figure={`${savedCount(screens, record)} of ${TOTAL_SCREENS} saved`}
        note={progressLine(screens, record, institution)}
        meter={meter(screens, record)}
        meterLabel={`${savedCount(screens, record)} of ${TOTAL_SCREENS} steps saved`}
        steps={railSteps(screens, record, finished ? null : screenId)}
        currentName={finished ? "All ten resolved" : screen.name}
        help={{ label: "Stuck on something?", line: "A person at the office that can help.", onOpen: openHelp }}
        onOpen={openScreen}
      />

      <main className="flow-page" id="onboarding-main" aria-live="polite">
        <header className="topbar flow-topbar">
          <div className="topbar-title" />
          <div className="topbar-actions">
            <button type="button" className="topbar-chip flow-leave" onClick={leave} disabled={leaving}>
              {leaving ? "Signing out…" : "Save and finish later"}
            </button>
          </div>
        </header>

        <div className="flow-body">
          <div className="flow-measure">
            {!finished ? (
              <PageHero
                ref={heading}
                focusable
                kicker={`Step ${screenNumber(screens, screen.id)} of ${TOTAL_SCREENS}${screen.required ? "" : " · optional"}`}
                title={screen.question}
                lede={screen.lede}
                motif={screen.icon}
              />
            ) : (
              <PageHero
                kicker={`${TOTAL_SCREENS} of ${TOTAL_SCREENS} resolved`}
                title={`You’re all set, ${preferred}.`}
                lede={`${institution} has what it needs to open your record. From here, everything lives in the portal.`}
                motif="check"
              />
            )}

            {(notice || resume) && (
              <div className="page-notice">
                {notice ? (
                  <Notice
                    tone={notice.tone === "alert" ? "working" : "done"}
                    icon={notice.tone === "alert" ? "lock" : "check"}
                  >
                    {notice.text}
                  </Notice>
                ) : (
                  <Notice
                    tone="quiet"
                    icon="clock"
                    action={{ label: "Dismiss", icon: "close", onClick: () => setResumeShown(false) }}
                  >
                    {resume}
                  </Notice>
                )}
              </div>
            )}

            <div className={panel ? "flow-grid" : "flow-grid solo"}>
              <div className="flow-content">
                {body()}

                {failed && (
                  <p className="step-failed" role="alert">
                    <Icon name="alert" size={16} />
                    <span>
                      <strong>That didn’t reach {institution}.</strong>
                      {failed} Nothing was lost, and what you typed is still here.
                      {conflict ? (
                        <>
                          {" "}
                          <button type="button" className="text-button" onClick={reload}>
                            Reload latest saved progress
                          </button>
                        </>
                      ) : null}
                    </span>
                  </p>
                )}
              </div>

              {panel && (
                <aside className="flow-aside" aria-label="Your ranked halls" aria-live="off">
                  <RankPanel shortlist={shortlist} residences={housingPlan.residences} />
                </aside>
              )}

              {problem && (
                <p className="step-failed" role="alert">
                  <Icon name="alert" size={16} />
                  <span>
                    <strong>Not quite yet.</strong>
                    {problem}
                  </span>
                </p>
              )}

              {working && screen.id !== "offer" && (
                <StepActions
                  screen={screen}
                  first={screenNumber(screens, screen.id) === 1}
                  saving={saving}
                  saveLabel={failed ? "Try again" : "Save and continue"}
                  onBack={() => goTo(screens[screenNumber(screens, screen.id) - 2].id)}
                  onSkip={() => markLocal("skipped", screen.id)}
                  onSave={() => void commit()}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {overlay?.kind === "celebrate" && (
        <CelebrationModal
          name={preferred}
          institution={institution}
          classYear={classYear}
          term={offer.termName}
          siteUrl={typeof window === "undefined" ? "" : window.location.origin}
          onClose={() => {
            setOverlay(null);
            goTo("details");
          }}
          onContinue={() => {
            setOverlay(null);
            goTo("details");
          }}
        />
      )}

      {overlay?.kind === "decline" && (
        <DeclineModal
          institution={institution}
          admissions={{ label: admissionsContact.label, href: admissionsHref }}
          onClose={() => setOverlay(null)}
        />
      )}

      {overlay?.kind === "authorize" && ferpa && (
        <AuthorizeModal
          draft={authorizing ?? emptyAuthorization()}
          legalName={legalName}
          today={today}
          institution={institution}
          allowedScopes={ferpa.configuration.portalScopes}
          needsSignature={ferpa.document.status !== "signed"}
          saving={ferpaBusy}
          error={authorizeError}
          onChange={setAuthorizing}
          onSave={() => void saveAuthorization()}
          onClose={() => setOverlay(null)}
        />
      )}

      {overlay?.kind === "waiver" && (
        <WaiverModal
          onClose={() => setOverlay(null)}
          onSend={() => {
            patch({ depositChoice: "waiver_or_deferral" });
            setOverlay(null);
          }}
        />
      )}

      {overlay?.kind === "hall" && (
        <HallDrawer
          hall={overlay.hall}
          rank={shortlist.indexOf(overlay.hall.value) + 1}
          canAdd={shortlist.length < 3}
          onRank={(value) => {
            rank(value);
            setOverlay(null);
          }}
          onDrop={(value) => {
            dropRank(value);
            setOverlay(null);
          }}
          onClose={() => setOverlay(null)}
        />
      )}

      {overlay?.kind === "help" && (
        <HelpLadder
          rungs={rungs}
          reached={helpReached}
          onDeeper={() => setHelpReached((n) => n + 1)}
          onClose={() => setOverlay(null)}
        />
      )}
    </div>
  );
}

/** The one side panel the flow keeps: the ranking, read back in order. */
function RankPanel({
  shortlist,
  residences,
}: {
  shortlist: string[];
  residences: StudentHousingResidence[];
}) {
  const names = shortlist
    .map((value) => residences.find((hall) => hall.value === value)?.name)
    .filter((name): name is string => Boolean(name));
  const line =
    names.length === 3
      ? "Three ranked. This is a complete shortlist."
      : `${names.length} of 3 ranked. A partial shortlist is saved, and Residential Life reads it as partial.`;
  return (
    <section className="section-card step-panel">
      <div className="card-body">
        <p className="field-label field-group-label">Your ranked halls</p>
        <dl className="review-list">
          {names.map((name, index) => (
            <div key={name} className="review-row">
              <dt>{["1st choice", "2nd choice", "3rd choice"][index]}</dt>
              <dd>{name}</dd>
            </div>
          ))}
        </dl>
        <p className="field-foot">{line}</p>
      </div>
    </section>
  );
}

function OnboardingResource() {
  const tenantRuntime = useTenant();
  const { tenant } = tenantRuntime;
  const loadOnboarding = useCallback(
    async (signal: AbortSignal): Promise<OnboardingPageData> => {
      const [onboarding, dashboard, payments, profile, housingPlan, documents, ferpaEnvelope] =
        await Promise.all([
          getStudentOnboarding(signal),
          getStudentDashboard(signal),
          getStudentPayments(signal),
          getStudentProfile(signal),
          getStudentHousingPlan(signal),
          getStudentDocuments(signal),
          getStudentFerpaAuthorization(signal),
        ]);
      // Campus life is read so the platform's own cache of it is warm for the
      // checklist that follows; nothing in the flow renders it.
      void getCampusLife(signal).catch(() => undefined);
      return {
        onboarding: {
          ...onboarding,
          data: {
            ...onboarding.data,
            firstName: onboarding.data.firstName || realProfileName(profile.firstName, "Student"),
            lastName: onboarding.data.lastName || realProfileName(profile.lastName, "Account"),
            preferredName:
              onboarding.data.preferredName || realProfileName(profile.preferredName, "Student"),
            personalEmail: onboarding.data.personalEmail || profile.email || undefined,
            mobilePhone: onboarding.data.mobilePhone || profile.mobilePhone || undefined,
          },
        },
        dashboard,
        payments,
        profile,
        housingPlan,
        documents,
        ferpa: ferpaEnvelope.authorization,
      };
    },
    [],
  );
  const onboarding = useApiResource(loadOnboarding);

  if (onboarding.status === "loading") {
    return (
      <main className="load-state" aria-busy="true" aria-live="polite">
        <div className="load-state__card">
          <PortalMark />
          <p className="eyebrow">{tenant.name}</p>
          <h1>Resuming your onboarding</h1>
          <p>Opening your last saved step.</p>
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
          <p className="eyebrow">{tenant.name}</p>
          <h1>Your onboarding couldn’t open</h1>
          <p>{onboarding.error}</p>
          <button className="button button--primary" type="button" onClick={onboarding.reload}>
            Try again
          </button>
          {tenant.contacts.support.email || tenant.contacts.support.url ? (
            <a
              className="text-link"
              href={
                tenant.contacts.support.url
                  ? tenantRuntime.href(tenant.contacts.support.url)
                  : `mailto:${tenant.contacts.support.email}`
              }
            >
              Get help
            </a>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <OnboardingFlow
      initial={onboarding.data.onboarding}
      dashboard={onboarding.data.dashboard}
      initialPayments={onboarding.data.payments}
      housingPlan={onboarding.data.housingPlan}
      initialDocuments={onboarding.data.documents}
      initialFerpa={onboarding.data.ferpa}
      profile={onboarding.data.profile}
      reload={onboarding.reload}
    />
  );
}

export default function OnboardingPage() {
  const tenantRuntime = useTenant();
  const { tenant } = tenantRuntime;
  const loadBootstrap = useCallback((signal: AbortSignal) => getStudentBootstrap(signal), []);
  const bootstrap = useApiResource(loadBootstrap);
  const onboardingSummary = bootstrap.data?.onboarding;
  const isDelegate = (bootstrap.data as StudentBootstrap | null)?.actor?.type === "delegate";
  const alreadyComplete = !isDelegate && onboardingSummary?.status === "completed";
  const needsSignIn =
    bootstrap.status === "error" &&
    (bootstrap.errorStatus === 401 || bootstrap.errorStatus === 403);

  useEffect(() => {
    if (needsSignIn) {
      window.location.replace(tenantRuntime.href("/sign-in"));
    } else if (isDelegate) {
      // Parent and guardian access always uses the normal student portal.
      window.location.replace(tenantRuntime.href("/enrollment"));
    } else if (alreadyComplete) {
      window.location.replace(tenantRuntime.href("/dashboard"));
    }
  }, [alreadyComplete, isDelegate, needsSignIn, tenantRuntime]);

  if (bootstrap.status === "loading" || needsSignIn || isDelegate || alreadyComplete) {
    return (
      <main className="load-state" aria-busy="true" aria-live="polite">
        <div className="load-state__card">
          <PortalMark />
          <p className="eyebrow">{tenant.name}</p>
          <h1>Checking your onboarding</h1>
          <p>Opening the right place for your saved progress.</p>
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
          <p className="eyebrow">{tenant.name}</p>
          <h1>Your onboarding couldn’t be confirmed</h1>
          <p>{bootstrap.error}</p>
          <button className="button button--primary" type="button" onClick={bootstrap.reload}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  return <OnboardingResource />;
}
