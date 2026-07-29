import type { APIRequestContext, BrowserContext } from "@playwright/test";

export const demoApiBaseUrl =
  process.env.E2E_API_BASE_URL?.trim().replace(/\/+$/, "") ||
  `http://localhost:${process.env.E2E_API_PORT?.trim() || "41817"}`;

const sessionCookie = "demo-session-v2";

export async function resetDemoStudent(request: APIRequestContext) {
  const response = await request.post(
    `${demoApiBaseUrl}/v1/auth/demo/start-guided-onboarding`,
    { data: {} },
  );
  if (!response.ok()) {
    throw new Error(
      `Could not reset the deterministic student fixture (${response.status()})`,
    );
  }
}

export async function authenticateDemoStudent(
  context: BrowserContext,
  baseURL: string | undefined,
) {
  if (!baseURL) throw new Error("Playwright baseURL is required");
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: "vv_demo_session",
      value: sessionCookie,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: url.protocol === "https:",
    },
  ]);
}

export async function resetAndAuthenticateDemoStudent({
  request,
  context,
  baseURL,
}: {
  request: APIRequestContext;
  context: BrowserContext;
  baseURL: string | undefined;
}) {
  await resetDemoStudent(request);
  await authenticateDemoStudent(context, baseURL);
}
