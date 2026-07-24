import type {
  AcceptOfferResponse,
  ActivityEventInput,
  ApiErrorResponse,
  CompleteStudentOnboardingInput,
  CreateDepositPaymentInput,
  CreateStudentAppointmentInput,
  CreateStudentDocumentInput,
  StudentAppointment,
  StudentAppointmentList,
  StudentBootstrap,
  StudentDashboard,
  StudentDocument,
  StudentDocumentList,
  StudentHelp,
  StudentMessage,
  StudentMessageList,
  StudentOnboarding,
  StudentPayment,
  StudentPaymentList,
  StudentProfile,
  StudentRequirementDetail,
  StudentRequirementList,
  UpdateStudentOnboardingInput,
  UpdateStudentProfileInput,
} from "@vv/contracts";

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

export const API_BASE_URL = (
  configuredApiBaseUrl || "http://localhost:4000"
).replace(/\/+$/, "");

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

export interface DemoAuthSession {
  authenticated: true;
  mode: "demo";
  actorType: "student";
  student: {
    id: string;
    preferredName: string;
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
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as T;
}

export function getStudentBootstrap(signal?: AbortSignal) {
  return request<StudentBootstrap>("/v1/student/bootstrap", {
    method: "GET",
    signal,
  });
}

export function signInDemoStudent() {
  return request<DemoAuthSession>("/v1/auth/demo/sign-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
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
