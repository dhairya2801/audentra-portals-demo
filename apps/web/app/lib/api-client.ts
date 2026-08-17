import type {
  AcceptOfferResponse,
  ActivityEventInput,
  AskEdwardInput,
  AskEdwardResponse,
  AskStaffEdwardInput,
  AskStaffEdwardResponse,
  StaffAssistantConversation,
  AssistantConversation,
  AssistantConversationMessagesResponse,
  AssistantVoiceSessionCredentials,
  CreateAssistantConversationInput,
  CreateAssistantVoiceSessionInput,
  CampusEventRegistration,
  CampusLifeFeed,
  CatalogCourse,
  ApiErrorResponse,
  CompleteStudentOnboardingInput,
  CompleteStaffInteractionInput,
  ConfirmStudentDocumentExtractionInput,
  CreateStaffActionRuleInput,
  CreateDepositPaymentInput,
  CreateStaffWorkItemInput,
  CreateStaffWorkCommentInput,
  CreateStaffClubInput,
  CreateStaffCorePlayInput,
  CreateStaffKnowledgeCardInput,
  CreateStudentHelpRequestInput,
  CreateStudentInquiryMessageInput,
  CreateStudentAppointmentInput,
  CreateStudentDocumentInput,
  DeferStudentExperienceUpdatesInput,
  DeferStudentExperienceUpdatesResult,
  DecideStudentExperienceUpdateInput,
  StudentAppointment,
  StudentAppointmentList,
  StudentAcademics,
  StudentBootstrap,
  StudentDashboard,
  StudentDocument,
  StudentDocumentList,
  StudentExperienceUpdateDecision,
  StudentHelp,
  StudentHelpRequest,
  StudentHousingPlan,
  StudentFinancials,
  StudentMessage,
  StudentMessageList,
  StudentOnboarding,
  StudentPayment,
  StudentPaymentList,
  StudentProfile,
  StudentRequirementDetail,
  StudentRequirementList,
  TenantBootstrap,
  ReviewStaffDocumentInput,
  RecordStaffCommunicationInput,
  RegisterCampusEventInput,
  RequestStaffAiRefreshInput,
  RetryStaffCallTranscriptionInput,
  StaffActionCenter,
  StaffActionRule,
  StaffActionRuleList,
  StaffCorePlay,
  StaffDocumentDecisionResult,
  StaffEdwardPreview,
  StaffEdwardPreviewInput,
  StaffEdwardConfigurationDraft,
  StaffEdwardConfigurationDraftInput,
  StaffInquiry,
  StaffInquiryThread,
  StaffKnowledgeCard,
  StaffManagedConfiguration,
  StaffManagedConfigurationKind,
  StaffMorningBrew,
  StaffNotificationList,
  StaffNotificationReadResult,
  StaffOperationsWorkspace,
  StaffOutreachRun,
  StaffPortalMediaUpload,
  StaffSession,
  StaffSignInInput,
  StaffSignUpInput,
  StaffStudentRecord,
  StaffWorkItem,
  StaffWorkItemDetail,
  StartStaffInteractionInput,
  SubmitStudentRequirementResponseInput,
  SubmitStudentRequirementResponseResult,
  StudentClub,
  SimulateStaffOutreachInput,
  UpdateStaffClubInput,
  UpdateStaffActionRuleInput,
  UpdateStaffCorePlayInput,
  UpdateStaffInquiryInput,
  UpdateStaffKnowledgeCardInput,
  UpdateStaffManagedConfigurationInput,
  UpdateStaffStudentPreferencesInput,
  UpdateStaffWorkItemInput,
  UpdateStudentOnboardingInput,
  UpdateStudentHousingPlanInput,
  UpdateStudentProfileInput,
} from "@vv/contracts";
import { currentTenantSlug } from "./tenant";

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

// A relative fallback is safe in previews and production. Real deployments
// should set NEXT_PUBLIC_API_BASE_URL to the public Audentra API origin.
export const API_BASE_URL = (configuredApiBaseUrl || "").replace(/\/+$/, "");

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(
    message: string,
    options: { status: number; code: string; requestId?: string },
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
  }
}

export interface CredentialAuthSession {
  authenticated: true;
  mode: "credentials";
  actorType: "student";
  student: {
    id: string;
    preferredName: string | null;
    email: string;
    phone: string;
    emailVerified: boolean;
    phoneVerified: boolean;
  };
  notice: string;
}

async function parseError(response: Response): Promise<ApiClientError> {
  let payload: ApiErrorResponse | undefined;

  try {
    payload = (await response.json()) as ApiErrorResponse;
  } catch {
    // The status-based fallback below still gives the student a safe message.
  }

  return new ApiClientError(
    payload?.error.message || "We couldn’t complete that request. Please try again.",
    {
      status: response.status,
      code: payload?.error.code || "request_failed",
      requestId:
        payload?.error.requestId || response.headers.get("x-request-id") || undefined,
    },
  );
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: {
    notifyStudentRecordChanged?: boolean;
    tenantSlug?: string;
  } = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "X-Tenant-Slug": options.tenantSlug ?? currentTenantSlug(),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const result = (await response.json()) as T;
  if (
    typeof window !== "undefined" &&
    (init.method ?? "GET").toUpperCase() !== "GET" &&
    options.notifyStudentRecordChanged !== false
  ) {
    window.dispatchEvent(new Event("vv:student-record-changed"));
  }
  return result;
}

export function getTenantBootstrap(slug: string, signal?: AbortSignal) {
  return request<TenantBootstrap>(
    `/v1/tenants/${encodeURIComponent(slug)}/bootstrap`,
    { signal },
    { tenantSlug: slug },
  );
}

export function getStudentBootstrap(signal?: AbortSignal) {
  return request<StudentBootstrap>("/v1/student/bootstrap", {
    method: "GET",
    signal,
  });
}

export function decideStudentExperienceUpdate(
  updateId: string,
  input: DecideStudentExperienceUpdateInput,
) {
  return request<StudentExperienceUpdateDecision>(
    `/v1/student/experience-updates/${encodeURIComponent(updateId)}/decision`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export function signUpStudent(input: {
  email: string;
  phone: string;
  password: string;
}) {
  return request<CredentialAuthSession>("/v1/auth/sign-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function signInStudent(input: {
  email: string;
  password: string;
}) {
  return request<CredentialAuthSession>("/v1/auth/sign-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function signOutStudent() {
  return request<{ authenticated: false; mode: "credentials" }>(
    "/v1/auth/sign-out",
    { method: "POST" },
  );
}

export interface DemoAuthSession {
  authenticated: true;
  mode: "demo";
  actorType: "student";
  student: {
    id: string;
    preferredName: string;
    externalRef: string | null;
  };
  notice: string;
}

/**
 * Opens a named demo student's portal.
 *
 * Development and preview only: the platform returns 404 for this route in
 * production, and rejects any reference that does not resolve inside the
 * requested tenant. Signing in reads that student's stored state — it never
 * resets it.
 */
export function signInDemoStudent(input: { studentRef: string }) {
  return request<DemoAuthSession>("/v1/auth/demo/sign-in-as", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function signOutDemoStudent() {
  return request<{ authenticated: false; mode: "demo" }>(
    "/v1/auth/demo/sign-out",
    { method: "POST" },
  );
}

export function getStudentDashboard(signal?: AbortSignal) {
  return request<StudentDashboard>("/v1/student/dashboard", {
    method: "GET",
    signal,
  });
}

export function getStudentAcademics(signal?: AbortSignal) {
  return request<StudentAcademics>("/v1/student/academics", {
    method: "GET",
    signal,
  });
}

export function searchCatalogCourses(query = "", signal?: AbortSignal) {
  return request<{
    items: CatalogCourse[];
    total: number;
    catalogVersion: string;
  }>(`/v1/catalog/courses?query=${encodeURIComponent(query)}`, {
    method: "GET",
    signal,
  });
}

export function getStudentFinancials(signal?: AbortSignal) {
  return request<StudentFinancials>("/v1/student/financials", {
    method: "GET",
    signal,
  });
}

export function selectFinancialPaymentPlan(
  planId: string,
  idempotencyKey: string,
) {
  return request<{ planId: string; status: "enrolled" }>(
    "/v1/student/financials/payment-plan",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ planId }),
    },
  );
}

export function getCampusLife(signal?: AbortSignal) {
  return request<CampusLifeFeed>("/v1/student/campus-life", {
    method: "GET",
    signal,
  });
}

export function getStudentOnboarding(signal?: AbortSignal) {
  return request<StudentOnboarding>("/v1/student/onboarding", {
    method: "GET",
    signal,
  });
}

export function updateStudentOnboarding(input: UpdateStudentOnboardingInput) {
  return request<StudentOnboarding>("/v1/student/onboarding", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function completeStudentOnboarding(
  input: CompleteStudentOnboardingInput,
  idempotencyKey: string,
) {
  return request<StudentOnboarding>("/v1/student/onboarding/complete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(input),
  });
}

export function getStudentHousingPlan(signal?: AbortSignal) {
  return request<StudentHousingPlan>("/v1/student/housing-plan", {
    method: "GET",
    signal,
  });
}

export function updateStudentHousingPlan(
  input: UpdateStudentHousingPlanInput,
) {
  return request<StudentHousingPlan>("/v1/student/housing-plan", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function getStudentRequirements(signal?: AbortSignal) {
  return request<StudentRequirementList>("/v1/student/requirements", {
    method: "GET",
    signal,
  });
}

export function getStudentRequirement(id: string, signal?: AbortSignal) {
  return request<StudentRequirementDetail>(
    `/v1/student/requirements/${encodeURIComponent(id)}`,
    { method: "GET", signal },
  );
}

export function submitStudentRequirementResponse(
  requirementId: string,
  input: SubmitStudentRequirementResponseInput,
  idempotencyKey: string,
) {
  return request<SubmitStudentRequirementResponseResult>(
    `/v1/student/requirements/${encodeURIComponent(requirementId)}/responses`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(input),
    },
  );
}

export function getStudentMessages(signal?: AbortSignal) {
  return request<StudentMessageList>("/v1/student/messages", {
    method: "GET",
    signal,
  });
}

export function markStudentMessageRead(id: string) {
  return request<StudentMessage>(
    `/v1/student/messages/${encodeURIComponent(id)}/read`,
    { method: "POST" },
  );
}

export function getStudentDocuments(signal?: AbortSignal) {
  return request<StudentDocumentList>("/v1/student/documents", {
    method: "GET",
    signal,
  });
}

export function createStudentDocument(
  input: CreateStudentDocumentInput,
  idempotencyKey: string,
) {
  return request<StudentDocument>("/v1/student/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(input),
  });
}

export async function uploadStudentDocument(
  file: File,
  context: {
    categoryHint?: StudentDocument["category"];
    requirementId?: string;
    uploadBundleId?: string;
  },
  idempotencyKey: string,
  signal: AbortSignal = AbortSignal.timeout(120_000),
) {
  const form = new FormData();
  form.set("file", file);
  if (context.categoryHint) {
    form.set("category", context.categoryHint);
  }
  if (context.requirementId) {
    form.set("requirementId", context.requirementId);
  }
  if (context.uploadBundleId) {
    form.set("uploadBundleId", context.uploadBundleId);
  }
  return request<StudentDocument>("/v1/student/documents/upload", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: form,
    signal,
  });
}

/**
 * The document API deliberately accepts one file per request so each original
 * file has its own audit trail, extraction result, and idempotency boundary.
 * This helper keeps that server contract while allowing the UI to submit a
 * related set of files (for example, the front and back of an identity card)
 * as one sequential upload bundle.
 */
export type StudentDocumentUploadBundleEntry = {
  file: File;
  idempotencyKey: string;
};

export type StudentDocumentUploadBundleResult =
  | {
      status: "uploaded";
      file: File;
      idempotencyKey: string;
      document: StudentDocument;
    }
  | {
      status: "error";
      file: File;
      idempotencyKey: string;
      error: unknown;
    };

export async function uploadStudentDocumentBundle(
  entries: readonly StudentDocumentUploadBundleEntry[],
  context: {
    categoryHint?: StudentDocument["category"];
    requirementId?: string;
  },
  callbacks: {
    onFileStart?: (entry: StudentDocumentUploadBundleEntry) => void;
    onFileSettled?: (result: StudentDocumentUploadBundleResult) => void;
  } = {},
): Promise<StudentDocumentUploadBundleResult[]> {
  const results: StudentDocumentUploadBundleResult[] = [];
  const uploadBundleId = crypto.randomUUID();
  const bundleDeadline = AbortSignal.timeout(300_000);

  for (const entry of entries) {
    callbacks.onFileStart?.(entry);
    try {
      const document = await uploadStudentDocument(
        entry.file,
        { ...context, uploadBundleId },
        entry.idempotencyKey,
        AbortSignal.any([bundleDeadline, AbortSignal.timeout(120_000)]),
      );
      const result: StudentDocumentUploadBundleResult = {
        status: "uploaded",
        file: entry.file,
        idempotencyKey: entry.idempotencyKey,
        document,
      };
      results.push(result);
      callbacks.onFileSettled?.(result);
    } catch (error) {
      const result: StudentDocumentUploadBundleResult = {
        status: "error",
        file: entry.file,
        idempotencyKey: entry.idempotencyKey,
        error,
      };
      results.push(result);
      callbacks.onFileSettled?.(result);
    }
  }

  return results;
}

export function confirmStudentDocumentExtraction(
  documentId: string,
  input: ConfirmStudentDocumentExtractionInput,
  idempotencyKey: string,
) {
  return request<StudentDocument>(
    `/v1/student/documents/${encodeURIComponent(documentId)}/confirm-extraction`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(input),
    },
  );
}

/**
 * Reuses the privately stored original. A student never has to upload the
 * same document again just because an external parsing attempt was transient.
 */
export function retryStudentDocumentExtraction(
  documentId: string,
  idempotencyKey: string,
) {
  return request<StudentDocument>(
    `/v1/student/documents/${encodeURIComponent(documentId)}/retry-extraction`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      // The local demo API intentionally validates an empty JSON object here.
      // Send the same explicit body to production for a uniform retry contract.
      body: JSON.stringify({}),
    },
  );
}

export function getStudentDocumentContentUrl(document: StudentDocument) {
  if (!document.contentUrl) return null;
  return tenantAwareDocumentUrl(document.contentUrl);
}

export function getStudentDocumentProfilePhotoUrl(documentId: string) {
  return tenantAwareDocumentUrl(
    `/v1/student/documents/${encodeURIComponent(documentId)}/profile-photo`,
  );
}

export function signInStaff(input: StaffSignInInput) {
  return request<StaffSession>("/v1/auth/staff/sign-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function signUpStaff(input: StaffSignUpInput) {
  return request<StaffSession>("/v1/auth/staff/sign-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function signOutStaff() {
  return request<{
    authenticated: false;
    mode: "credentials";
    actorType: "staff";
  }>(
    "/v1/auth/staff/sign-out",
    { method: "POST" },
  );
}

const staffHeaders = {
  "X-Demo-Actor-Type": "staff",
} as const;

export function getStaffActionCenter(signal?: AbortSignal) {
  return request<StaffActionCenter>("/v1/staff/action-center", {
    method: "GET",
    headers: staffHeaders,
    signal,
  });
}

export function registerCampusEvent(
  eventId: string,
  input: RegisterCampusEventInput,
  idempotencyKey: string,
) {
  return request<CampusEventRegistration>(
    `/v1/student/campus-life/events/${encodeURIComponent(eventId)}/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(input),
    },
  );
}

export function deferStudentExperienceUpdates(
  input: DeferStudentExperienceUpdatesInput,
) {
  return request<DeferStudentExperienceUpdatesResult>(
    "/v1/student/experience-updates/defer",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export function getStaffWorkItemDetail(
  workItemId: string,
  signal?: AbortSignal,
) {
  return request<StaffWorkItemDetail>(
    `/v1/staff/work-items/${encodeURIComponent(workItemId)}`,
    {
      method: "GET",
      headers: staffHeaders,
      signal,
    },
  );
}

export function getStaffOperationsWorkspace(signal?: AbortSignal) {
  return request<StaffOperationsWorkspace>("/v1/staff/workspace", {
    method: "GET",
    headers: staffHeaders,
    signal,
  });
}

/**
 * The Morning Brew briefing. Kept separate from the workspace read because the
 * briefing is an aggregate over the whole tenant, not the staff member's own
 * queue, and because it must be able to fail on its own without taking the
 * workspace shell down with it.
 */
export function getStaffMorningBrew(signal?: AbortSignal) {
  return request<StaffMorningBrew>("/v1/staff/morning-brew", {
    method: "GET",
    headers: staffHeaders,
    signal,
  });
}

export function getStaffManagedConfiguration(
  kind: StaffManagedConfigurationKind,
  signal?: AbortSignal,
) {
  return request<StaffManagedConfiguration>(
    `/v1/staff/configurations/${kind}`,
    {
      method: "GET",
      headers: staffHeaders,
      signal,
    },
  );
}

export function updateStaffManagedConfiguration(
  kind: StaffManagedConfigurationKind,
  input: UpdateStaffManagedConfigurationInput,
) {
  return request<StaffManagedConfiguration>(
    `/v1/staff/configurations/${kind}`,
    {
      method: "PUT",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: true },
  );
}

export function uploadStaffPortalMedia(file: File) {
  const body = new FormData();
  body.set("file", file);
  return request<StaffPortalMediaUpload>(
    "/v1/staff/media",
    {
      method: "POST",
      headers: staffHeaders,
      body,
    },
    { notifyStudentRecordChanged: false },
  );
}

export function draftStaffConfigurationWithEdward(
  input: StaffEdwardConfigurationDraftInput,
) {
  return request<StaffEdwardConfigurationDraft>(
    "/v1/staff/edward/configuration-draft",
    {
      method: "POST",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function updateStaffKnowledgeCard(
  cardId: string,
  input: UpdateStaffKnowledgeCardInput,
) {
  return request<StaffKnowledgeCard>(
    `/v1/staff/knowledge-base/${encodeURIComponent(cardId)}`,
    {
      method: "PATCH",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function createStaffKnowledgeCard(input: CreateStaffKnowledgeCardInput) {
  return request<StaffKnowledgeCard>(
    "/v1/staff/knowledge-base",
    {
      method: "POST",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function updateStaffCorePlay(
  playId: string,
  input: UpdateStaffCorePlayInput,
) {
  return request<StaffCorePlay>(
    `/v1/staff/core-plays/${encodeURIComponent(playId)}`,
    {
      method: "PATCH",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function createStaffCorePlay(input: CreateStaffCorePlayInput) {
  return request<StaffCorePlay>(
    "/v1/staff/core-plays",
    {
      method: "POST",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function updateStaffInquiry(
  inquiryId: string,
  input: UpdateStaffInquiryInput,
) {
  return request<StaffInquiry>(
    `/v1/staff/inquiries/${encodeURIComponent(inquiryId)}`,
    {
      method: "PATCH",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function updateStaffClub(
  clubId: string,
  input: UpdateStaffClubInput,
) {
  return request<StudentClub>(
    `/v1/staff/campus-life/clubs/${encodeURIComponent(clubId)}`,
    {
      method: "PATCH",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function createStaffClub(input: CreateStaffClubInput) {
  return request<StudentClub>(
    "/v1/staff/campus-life/clubs",
    {
      method: "POST",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function simulateStaffOutreach(input: SimulateStaffOutreachInput) {
  return request<StaffOutreachRun>("/v1/staff/outreach/simulate", {
    method: "POST",
    headers: {
      ...staffHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function previewStaffEdward(input: StaffEdwardPreviewInput) {
  return request<StaffEdwardPreview>("/v1/staff/edward/preview", {
    method: "POST",
    headers: {
      ...staffHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function updateStaffWorkItem(
  workItemId: string,
  input: UpdateStaffWorkItemInput,
) {
  return request<StaffWorkItem>(
    `/v1/staff/work-items/${encodeURIComponent(workItemId)}`,
    {
      method: "PATCH",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function getStaffInquiryThread(inquiryId: string, signal?: AbortSignal) {
  return request<StaffInquiryThread>(
    `/v1/staff/inquiries/${encodeURIComponent(inquiryId)}/thread`,
    {
      headers: staffHeaders,
      signal,
    },
    { notifyStudentRecordChanged: false },
  );
}

export function createStaffWorkItem(
  input: CreateStaffWorkItemInput,
  idempotencyKey: string,
) {
  return request<StaffWorkItem>(
    "/v1/staff/work-items",
    {
      method: "POST",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function createStaffWorkComment(
  workItemId: string,
  input: CreateStaffWorkCommentInput,
  idempotencyKey: string,
) {
  return request<StaffWorkItemDetail>(
    `/v1/staff/work-items/${encodeURIComponent(workItemId)}/comments`,
    {
      method: "POST",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function startStaffInteraction(
  workItemId: string,
  input: StartStaffInteractionInput,
  idempotencyKey: string,
) {
  return request<StaffWorkItemDetail>(
    `/v1/staff/work-items/${encodeURIComponent(workItemId)}/interactions`,
    {
      method: "POST",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function recordStaffCommunication(
  interactionId: string,
  input: RecordStaffCommunicationInput,
  idempotencyKey: string,
) {
  return request<StaffWorkItemDetail>(
    `/v1/staff/interactions/${encodeURIComponent(interactionId)}/communications`,
    {
      method: "POST",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function completeStaffInteraction(
  interactionId: string,
  input: CompleteStaffInteractionInput,
) {
  return request<StaffWorkItemDetail>(
    `/v1/staff/interactions/${encodeURIComponent(interactionId)}/complete`,
    {
      method: "POST",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function requestStaffAiRefresh(
  workItemId: string,
  input: RequestStaffAiRefreshInput,
) {
  return request<StaffWorkItemDetail>(
    `/v1/staff/work-items/${encodeURIComponent(workItemId)}/ai-refresh`,
    {
      method: "POST",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function uploadStaffCallRecording(
  interactionId: string,
  file: File,
  consentConfirmed: boolean,
  idempotencyKey: string,
) {
  const body = new FormData();
  body.set("file", file);
  body.set("consentConfirmed", String(consentConfirmed));
  return request<StaffWorkItemDetail>(
    `/v1/staff/interactions/${encodeURIComponent(interactionId)}/recordings`,
    {
      method: "POST",
      headers: {
        ...staffHeaders,
        "Idempotency-Key": idempotencyKey,
      },
      body,
    },
    { notifyStudentRecordChanged: false },
  );
}

export function retryStaffCallTranscription(
  recordingId: string,
  input: RetryStaffCallTranscriptionInput,
) {
  return request<StaffWorkItemDetail>(
    `/v1/staff/call-recordings/${encodeURIComponent(recordingId)}/retry`,
    {
      method: "POST",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export async function getStaffCallRecordingContent(
  recordingId: string,
  signal?: AbortSignal,
) {
  const response = await fetch(
    `${API_BASE_URL}/v1/staff/call-recordings/${encodeURIComponent(recordingId)}/content`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "audio/*,video/*",
        ...staffHeaders,
        "X-Tenant-Slug": currentTenantSlug(),
      },
      signal,
    },
  );
  if (!response.ok) throw await parseError(response);
  return response.blob();
}

export function getStaffActionRules(signal?: AbortSignal) {
  return request<StaffActionRuleList>("/v1/staff/action-rules", {
    method: "GET",
    headers: staffHeaders,
    signal,
  });
}

export function getStaffNotifications(signal?: AbortSignal) {
  return request<StaffNotificationList>("/v1/staff/notifications", {
    method: "GET",
    headers: staffHeaders,
    signal,
  });
}

export function markStaffNotificationRead(notificationId: string) {
  return request<StaffNotificationReadResult>(
    `/v1/staff/notifications/${encodeURIComponent(notificationId)}/read`,
    {
      method: "POST",
      headers: staffHeaders,
    },
    { notifyStudentRecordChanged: false },
  );
}

export function createStaffActionRule(input: CreateStaffActionRuleInput) {
  return request<StaffActionRule>(
    "/v1/staff/action-rules",
    {
      method: "POST",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function updateStaffActionRule(
  ruleId: string,
  input: UpdateStaffActionRuleInput,
) {
  return request<StaffActionRule>(
    `/v1/staff/action-rules/${encodeURIComponent(ruleId)}`,
    {
      method: "PATCH",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function getStaffStudentRecord(
  studentId: string,
  signal?: AbortSignal,
) {
  return request<StaffStudentRecord>(
    `/v1/staff/students/${encodeURIComponent(studentId)}`,
    {
      method: "GET",
      headers: staffHeaders,
      signal,
    },
  );
}

export function updateStaffStudentPreferences(
  studentId: string,
  input: UpdateStaffStudentPreferencesInput,
) {
  return request<StaffStudentRecord>(
    `/v1/staff/students/${encodeURIComponent(studentId)}/preferences`,
    {
      method: "PATCH",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function reviewStaffDocument(
  documentId: string,
  input: ReviewStaffDocumentInput,
) {
  return request<StaffDocumentDecisionResult>(
    `/v1/staff/documents/${encodeURIComponent(documentId)}/decision`,
    {
      method: "POST",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    { notifyStudentRecordChanged: false },
  );
}

export function getStaffDocumentContentUrl(path: string) {
  return tenantAwareDocumentUrl(path);
}

function tenantAwareDocumentUrl(path: string) {
  const url = new URL(path, `${API_BASE_URL}/`);
  url.searchParams.set("tenant", currentTenantSlug());
  return url.toString();
}

export function createAssistantConversation(
  input: CreateAssistantConversationInput,
) {
  return request<AssistantConversation>(
    "/v1/student/assistant/conversations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    {
      // Opening a conversation reads nothing from the record and refreshing
      // the shell would remount the panel that is mid-send.
      notifyStudentRecordChanged: false,
    },
  );
}

export function getAssistantConversationMessages(
  conversationId: string,
  signal?: AbortSignal,
) {
  return request<AssistantConversationMessagesResponse>(
    `/v1/student/assistant/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: "GET", signal },
  );
}

export function createAssistantVoiceSession(
  input: CreateAssistantVoiceSessionInput,
) {
  return request<AssistantVoiceSessionCredentials>(
    "/v1/student/assistant/voice-sessions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    {
      // Starting voice reads nothing from the record; refreshing the shell
      // would remount the panel while the room is connecting.
      notifyStudentRecordChanged: false,
    },
  );
}

export function refreshAssistantVoiceSessionToken(voiceSessionId: string) {
  return request<AssistantVoiceSessionCredentials>(
    `/v1/student/assistant/voice-sessions/${encodeURIComponent(voiceSessionId)}/token`,
    { method: "POST" },
    { notifyStudentRecordChanged: false },
  );
}

export function askEdward(input: AskEdwardInput, signal?: AbortSignal) {
  return request<AskEdwardResponse>(
    "/v1/student/assistant/messages",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    },
    {
      // Asking Edward reads the student record but does not mutate it.
      // Refreshing the portal shell here would remount the conversation
      // before the assistant response can render.
      notifyStudentRecordChanged: false,
    },
  );
}

export function createStaffAssistantConversation() {
  return request<StaffAssistantConversation>(
    "/v1/staff/assistant/conversations",
    {
      method: "POST",
      headers: staffHeaders,
    },
    {
      // Opening a conversation reads nothing from any record.
      notifyStudentRecordChanged: false,
    },
  );
}

export function askStaffEdward(input: AskStaffEdwardInput, signal?: AbortSignal) {
  return request<AskStaffEdwardResponse>(
    "/v1/staff/assistant/messages",
    {
      method: "POST",
      headers: {
        ...staffHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal,
    },
    {
      // Staff Edward is read-only; nothing on the student record changes.
      notifyStudentRecordChanged: false,
    },
  );
}

export function getStudentAppointments(signal?: AbortSignal) {
  return request<StudentAppointmentList>("/v1/student/appointments", {
    method: "GET",
    signal,
  });
}

export function createStudentAppointment(
  input: CreateStudentAppointmentInput,
  idempotencyKey: string,
) {
  return request<StudentAppointment>("/v1/student/appointments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(input),
  });
}

export function getStudentPayments(signal?: AbortSignal) {
  return request<StudentPaymentList>("/v1/student/payments", {
    method: "GET",
    signal,
  });
}

export function createDepositPayment(
  input: CreateDepositPaymentInput,
  idempotencyKey: string,
) {
  return request<StudentPayment>("/v1/student/payments/deposit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(input),
  });
}

export function getStudentProfile(signal?: AbortSignal) {
  return request<StudentProfile>("/v1/student/profile", {
    method: "GET",
    signal,
  });
}

export function updateStudentProfile(input: UpdateStudentProfileInput) {
  return request<StudentProfile>("/v1/student/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function getStudentHelp(signal?: AbortSignal) {
  return request<StudentHelp>("/v1/student/help", {
    method: "GET",
    signal,
  });
}

function postStudentHelpRequest(
  input: CreateStudentHelpRequestInput,
  idempotencyKey: string,
) {
  return request<StudentHelpRequest>("/v1/demo/help-requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(input),
  });
}

export async function createStudentHelpRequest(
  input: CreateStudentHelpRequestInput,
  idempotencyKey: string,
) {
  try {
    return await postStudentHelpRequest(input, idempotencyKey);
  } catch (error) {
    if (
      !input.requirementId ||
      !(error instanceof ApiClientError) ||
      error.status !== 400 ||
      error.code !== "VALIDATION_ERROR"
    ) {
      throw error;
    }

    // Compatibility during the backend rollout: older strict schemas reject
    // requirementId. The durable message still carries the exact requirement
    // reference, so retry once without the new field instead of losing the note.
    const legacyInput = { ...input };
    delete legacyInput.requirementId;
    return postStudentHelpRequest(legacyInput, idempotencyKey);
  }
}

export function createStudentInquiryMessage(
  inquiryId: string,
  input: CreateStudentInquiryMessageInput,
  idempotencyKey: string,
) {
  return request<StudentHelpRequest>(
    `/v1/student/help/requests/${encodeURIComponent(inquiryId)}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(input),
    },
  );
}

export function acceptAdmissionOffer(
  offerId: string,
  idempotencyKey: string,
) {
  return request<AcceptOfferResponse>(
    `/v1/admission-offers/${encodeURIComponent(offerId)}/accept`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({}),
    },
  );
}

export async function sendActivityEvents(
  events: ActivityEventInput[],
  options: { keepalive?: boolean } = {},
) {
  if (events.length === 0) return;

  await request<void>("/v1/activity-events/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
    keepalive: options.keepalive,
  });
}
