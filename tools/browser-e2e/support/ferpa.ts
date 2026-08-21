import type {
  APIRequestContext,
  APIResponse,
  Page,
} from "@playwright/test";
import type {
  FerpaDelegateInput,
  FerpaDelegateLinkIssueResult,
  StudentFerpaAuthorization,
  StudentFerpaAuthorizationEnvelope,
} from "@vv/contracts";
import { demoApiBaseUrl } from "./demo-session";

const demoStudentHeaders = {
  Cookie: "vv_demo_session=demo-session-v2",
  "X-Tenant-Slug": "aster",
};

async function responseJson<T>(response: APIResponse, operation: string) {
  const body = await response.text();
  if (!response.ok()) {
    throw new Error(`${operation} returned ${response.status()}: ${body}`);
  }
  return JSON.parse(body) as T;
}

export async function currentFerpaAuthorization(
  request: APIRequestContext,
) {
  const response = await request.get(
    `${demoApiBaseUrl}/v1/student/ferpa-authorizations/current`,
    { headers: demoStudentHeaders },
  );
  const result = await responseJson<StudentFerpaAuthorizationEnvelope>(
    response,
    "loading the FERPA fixture",
  );
  if (!result.authorization) {
    throw new Error(
      "The deterministic student has no FERPA authorization. Ensure the FERPA journey is published before running this scenario.",
    );
  }
  return result.authorization;
}

export async function completeFerpaThroughApi({
  request,
  delegates = [],
  accessDecision = delegates.length > 0 ? "grant" : "no_access",
}: {
  request: APIRequestContext;
  delegates?: FerpaDelegateInput[];
  accessDecision?: "grant" | "no_access";
}) {
  const current = await currentFerpaAuthorization(request);
  const response = await request.post(
    `${demoApiBaseUrl}/v1/student/requirements/${encodeURIComponent(current.requirementId)}/ferpa/complete`,
    {
      headers: {
        ...demoStudentHeaders,
        "Content-Type": "application/json",
        "Idempotency-Key": `browser-ferpa-complete-${crypto.randomUUID()}`,
      },
      data: {
        expectedVersion: current.version,
        signature: {
          accepted: true,
          signerName: "Maya Chen",
          signatureMethod: "typed",
        },
        accessDecision,
        delegates,
      },
    },
  );
  const result = await responseJson<StudentFerpaAuthorizationEnvelope>(
    response,
    "completing the FERPA fixture",
  );
  if (!result.authorization) {
    throw new Error("FERPA completion did not return an authorization");
  }
  return result.authorization;
}

export async function updateFerpaAccessThroughApi({
  request,
  authorization,
  delegates,
  accessDecision = delegates.length > 0 ? "grant" : "no_access",
}: {
  request: APIRequestContext;
  authorization: StudentFerpaAuthorization;
  delegates: FerpaDelegateInput[];
  accessDecision?: "grant" | "no_access";
}) {
  const response = await request.patch(
    `${demoApiBaseUrl}/v1/student/ferpa-authorizations/${encodeURIComponent(authorization.id)}/access`,
    {
      headers: {
        ...demoStudentHeaders,
        "Content-Type": "application/json",
      },
      data: {
        expectedVersion: authorization.version,
        accessDecision,
        delegates,
      },
    },
  );
  const result = await responseJson<StudentFerpaAuthorizationEnvelope>(
    response,
    "updating FERPA access",
  );
  if (!result.authorization) {
    throw new Error("FERPA access update did not return an authorization");
  }
  return result.authorization;
}

export async function issueFerpaDelegateLink({
  request,
  authorization,
  delegateId,
}: {
  request: APIRequestContext;
  authorization: StudentFerpaAuthorization;
  delegateId: string;
}) {
  const response = await request.post(
    `${demoApiBaseUrl}/v1/student/ferpa-authorizations/${encodeURIComponent(authorization.id)}/delegates/${encodeURIComponent(delegateId)}/link`,
    {
      headers: {
        ...demoStudentHeaders,
        "Content-Type": "application/json",
        "Idempotency-Key": `browser-ferpa-link-${crypto.randomUUID()}`,
      },
      data: { expectedVersion: authorization.version },
    },
  );
  return responseJson<FerpaDelegateLinkIssueResult>(
    response,
    "issuing a FERPA delegate link",
  );
}

export async function revokeFerpaDelegateLink({
  request,
  authorization,
  delegateId,
}: {
  request: APIRequestContext;
  authorization: StudentFerpaAuthorization;
  delegateId: string;
}) {
  const response = await request.post(
    `${demoApiBaseUrl}/v1/student/ferpa-authorizations/${encodeURIComponent(authorization.id)}/delegates/${encodeURIComponent(delegateId)}/link/revoke`,
    {
      headers: {
        ...demoStudentHeaders,
        "Content-Type": "application/json",
      },
      data: { expectedVersion: authorization.version },
    },
  );
  const result = await responseJson<StudentFerpaAuthorizationEnvelope>(
    response,
    "revoking a FERPA delegate link",
  );
  if (!result.authorization) {
    throw new Error("FERPA link revocation did not return an authorization");
  }
  return result.authorization;
}

export function delegatePortalUrl(
  baseURL: string | undefined,
  result: FerpaDelegateLinkIssueResult,
) {
  if (!baseURL) throw new Error("Playwright baseURL is required");
  return new URL(
    `/delegate#token=${encodeURIComponent(result.token)}`,
    baseURL,
  ).toString();
}

export async function delegateApiFetch(
  page: Page,
  path: string,
  init: {
    method?: string;
    body?: unknown;
    idempotencyKey?: string;
  } = {},
) {
  return page.evaluate(
    async ({ apiBaseUrl, requestPath, requestInit }) => {
      const response = await fetch(`${apiBaseUrl}${requestPath}`, {
        method: requestInit.method ?? "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Audentra-Session-Mode": "delegate",
          ...(requestInit.idempotencyKey
            ? { "Idempotency-Key": requestInit.idempotencyKey }
            : {}),
        },
        body:
          requestInit.body === undefined
            ? undefined
            : JSON.stringify(requestInit.body),
      });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { status: response.status, body };
    },
    {
      apiBaseUrl: demoApiBaseUrl,
      requestPath: path,
      requestInit: init,
    },
  );
}

export async function exchangeDelegateToken(page: Page, token: string) {
  const result = await delegateApiFetch(page, "/v1/auth/delegate/exchange", {
    method: "POST",
    body: { token },
  });
  if (result.status !== 200) {
    throw new Error(
      `Delegate link exchange returned ${result.status}: ${JSON.stringify(result.body)}`,
    );
  }
  return result.body;
}

export function apiErrorCode(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const error = "error" in body ? body.error : null;
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

export const twoFerpaDelegates: FerpaDelegateInput[] = [
  {
    fullName: "Daniel Chen",
    relationship: "parent",
    email: "daniel.chen@example.test",
    scopes: ["dashboard", "enrollment", "financials", "profile"],
  },
  {
    fullName: "Elena Chen",
    relationship: "guardian",
    email: "elena.chen@example.test",
    scopes: ["dashboard", "documents", "messages"],
  },
];
