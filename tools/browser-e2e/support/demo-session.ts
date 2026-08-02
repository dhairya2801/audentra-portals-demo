import type { APIRequestContext, BrowserContext } from "@playwright/test";

export const demoApiBaseUrl =
  process.env.E2E_API_BASE_URL?.trim().replace(/\/+$/, "") ||
  "http://localhost:4000";

const sessionCookie = "demo-session-v2";

export async function resetDemoStudent(request: APIRequestContext) {
  const response = await request.post(
    `${demoApiBaseUrl}/v1/auth/demo/start-guided-onboarding`,
    // Browser-regression pages need the deterministic student to have cleared
    // onboarding. The same development endpoint still defaults to a fresh
    // first-use journey when the real sign-in UI calls it with an empty body.
    { data: { completedOnboarding: true } },
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
  const portalUrl = new URL(baseURL);
  const apiUrl = new URL(demoApiBaseUrl);
  await context.addCookies([
    {
      name: "vv_demo_session",
      value: sessionCookie,
      domain: apiUrl.hostname,
      path: "/",
      httpOnly: true,
      sameSite:
        apiUrl.origin === portalUrl.origin || apiUrl.protocol !== "https:"
          ? "Lax"
          : "None",
      secure: apiUrl.protocol === "https:",
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
