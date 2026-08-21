import { expect, test } from "@playwright/test";
import type { FerpaDelegateInput } from "@vv/contracts";
import {
  apiErrorCode,
  completeFerpaThroughApi,
  currentFerpaAuthorization,
  delegateApiFetch,
  delegatePortalUrl,
  exchangeDelegateToken,
  issueFerpaDelegateLink,
  revokeFerpaDelegateLink,
} from "../support/ferpa";
import { resetDemoStudent } from "../support/demo-session";

const delegateDraft: FerpaDelegateInput = {
  fullName: "Daniel Chen",
  relationship: "parent",
  email: "daniel.chen@example.test",
  scopes: ["profile"],
};

function requiredToken(token: string | undefined) {
  if (!token) throw new Error("Delegate link issuance did not return a token");
  return token;
}

test.describe("FERPA delegate boundaries", () => {
  test.beforeEach(async ({ request }) => {
    await resetDemoStudent(request);
  });

  test("reuses a permanent link and invalidates it on rotation and revocation", async ({
    request,
    browser,
    baseURL,
  }) => {
    const completed = await completeFerpaThroughApi({
      request,
      delegates: [delegateDraft],
    });
    const delegate = completed.delegates[0];
    expect(delegate).toBeTruthy();

    const firstLink = await issueFerpaDelegateLink({
      request,
      authorization: completed,
      delegateId: delegate.id,
    });
    const firstToken = requiredToken(firstLink.token);

    const firstContext = await browser.newContext({ baseURL });
    const firstPage = await firstContext.newPage();
    await firstPage.goto(delegatePortalUrl(baseURL, firstLink));
    await expect(firstPage.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
    await expect(
      firstPage.getByText(/Viewing .* as parent/i).first(),
    ).toBeVisible();
    await firstContext.close();

    const reusedContext = await browser.newContext({ baseURL });
    const reusedPage = await reusedContext.newPage();
    await reusedPage.goto(delegatePortalUrl(baseURL, firstLink));
    await expect(reusedPage.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();

    const beforeRotation = await currentFerpaAuthorization(request);
    const rotatedLink = await issueFerpaDelegateLink({
      request,
      authorization: beforeRotation,
      delegateId: delegate.id,
    });
    const rotatedToken = requiredToken(rotatedLink.token);
    expect(rotatedToken).not.toBe(firstToken);

    const invalidatedSession = await delegateApiFetch(
      reusedPage,
      "/v1/student/profile",
    );
    expect(invalidatedSession.status).not.toBe(200);
    await reusedContext.close();

    const staleLinkContext = await browser.newContext({ baseURL });
    const staleLinkPage = await staleLinkContext.newPage();
    await staleLinkPage.goto(delegatePortalUrl(baseURL, firstLink));
    await expect(
      staleLinkPage.getByRole("heading", { name: "This link could not open" }),
    ).toBeVisible();
    await staleLinkContext.close();

    const rotatedContext = await browser.newContext({ baseURL });
    const rotatedPage = await rotatedContext.newPage();
    await rotatedPage.goto(delegatePortalUrl(baseURL, rotatedLink));
    await expect(rotatedPage.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();

    const beforeRevocation = await currentFerpaAuthorization(request);
    await revokeFerpaDelegateLink({
      request,
      authorization: beforeRevocation,
      delegateId: delegate.id,
    });
    const revokedSession = await delegateApiFetch(
      rotatedPage,
      "/v1/student/profile",
    );
    expect(revokedSession.status).not.toBe(200);
    await rotatedContext.close();

    const revokedLinkContext = await browser.newContext({ baseURL });
    const revokedLinkPage = await revokedLinkContext.newPage();
    await revokedLinkPage.goto(delegatePortalUrl(baseURL, rotatedLink));
    await expect(
      revokedLinkPage.getByRole("heading", { name: "This link could not open" }),
    ).toBeVisible();
    await revokedLinkContext.close();
  });

  test("allows granted profile work but blocks ungranted pages and every FERPA mutation", async ({
    request,
    browser,
    baseURL,
  }) => {
    const completed = await completeFerpaThroughApi({
      request,
      delegates: [delegateDraft],
    });
    const delegate = completed.delegates[0];
    const link = await issueFerpaDelegateLink({
      request,
      authorization: completed,
      delegateId: delegate.id,
    });

    const delegateContext = await browser.newContext({ baseURL });
    const page = await delegateContext.newPage();
    await page.goto("/sign-in");
    await exchangeDelegateToken(page, requiredToken(link.token));
    await page.goto("/profile");

    await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
    await expect(page.getByText("Managed by the student", { exact: true })).toBeVisible();
    const delegateNavigation = page.getByRole("navigation", {
      name: "Student portal sections",
    });
    await expect(delegateNavigation.getByRole("link", { name: "Profile" })).toBeVisible();
    await expect(
      delegateNavigation.getByRole("link", { name: "My Enrollment" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: /Save access|Complete FERPA|Add parent or guardian|Rotate link|Revoke access/,
      }),
    ).toHaveCount(0);
    const preferredName = page.getByLabel("Preferred name");
    await preferredName.fill("Maya Delegate Test");
    const profileResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/v1/student/profile" &&
        response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save changes" }).click();
    expect((await profileResponse).status()).toBe(200);
    await expect(page.getByText("Your profile changes are saved.")).toBeVisible();

    const ungrantedRequirements = await delegateApiFetch(
      page,
      "/v1/student/requirements",
    );
    expect(ungrantedRequirements.status).toBe(403);
    expect(apiErrorCode(ungrantedRequirements.body)).toBe(
      "DELEGATE_SCOPE_REQUIRED",
    );

    await page.goto("/enrollment");
    await expect(
      page.getByRole("heading", { name: "This page is not shared" }),
    ).toBeVisible();

    const current = await currentFerpaAuthorization(request);
    const forgedAccess = await delegateApiFetch(
      page,
      `/v1/student/ferpa-authorizations/${encodeURIComponent(current.id)}/access`,
      {
        method: "PATCH",
        body: {
          expectedVersion: current.version,
          accessDecision: "no_access",
          delegates: [],
        },
      },
    );
    expect(forgedAccess.status).toBe(403);
    expect(apiErrorCode(forgedAccess.body)).toBe(
      "FERPA_STUDENT_CONTROL_REQUIRED",
    );

    const forgedCompletion = await delegateApiFetch(
      page,
      `/v1/student/requirements/${encodeURIComponent(current.requirementId)}/ferpa/complete`,
      {
        method: "POST",
        idempotencyKey: `forged-ferpa-${crypto.randomUUID()}`,
        body: {
          expectedVersion: current.version,
          signature: {
            accepted: true,
            signerName: "Forged Parent",
            signatureMethod: "typed",
          },
          accessDecision: "no_access",
          delegates: [],
        },
      },
    );
    expect(forgedCompletion.status).toBe(403);
    expect(apiErrorCode(forgedCompletion.body)).toBe(
      "FERPA_STUDENT_CONTROL_REQUIRED",
    );

    const genericBypass = await delegateApiFetch(
      page,
      `/v1/student/requirements/${encodeURIComponent(current.requirementId)}/responses`,
      {
        method: "POST",
        idempotencyKey: `forged-generic-${crypto.randomUUID()}`,
        body: {
          expectedVersion: current.requirementVersion,
          response: { acknowledged: true },
        },
      },
    );
    expect(genericBypass.status).toBe(403);
    expect(apiErrorCode(genericBypass.body)).toBe(
      "FERPA_STUDENT_CONTROL_REQUIRED",
    );

    await delegateContext.close();
  });

  test("allows an ordinary enrollment action while keeping FERPA student-controlled", async ({
    request,
    browser,
    baseURL,
  }) => {
    const completed = await completeFerpaThroughApi({
      request,
      delegates: [
        {
          ...delegateDraft,
          scopes: ["enrollment"],
        },
      ],
    });
    const delegate = completed.delegates[0];
    const link = await issueFerpaDelegateLink({
      request,
      authorization: completed,
      delegateId: delegate.id,
    });

    const delegateContext = await browser.newContext({ baseURL });
    const page = await delegateContext.newPage();
    await page.goto("/sign-in");
    await exchangeDelegateToken(page, requiredToken(link.token));
    await page.goto("/enrollment");

    const delegateNavigation = page.getByRole("navigation", {
      name: "Student portal sections",
    });
    await expect(
      delegateNavigation.getByRole("link", { name: "My Enrollment" }),
    ).toBeVisible();
    await expect(
      delegateNavigation.getByRole("link", { name: "Profile" }),
    ).toHaveCount(0);

    const housingLink = page.getByRole("link", { name: /Select housing/i });
    await expect(housingLink).toBeVisible();
    await housingLink.click();
    await expect(
      page.getByRole("heading", { name: "Confirm housing plans", exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("radio", { name: /Off campus/ }).check();
    const housingResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/v1/student/housing-plan" &&
        response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save housing plan" }).click();
    expect((await housingResponse).status()).toBe(200);
    await expect(
      page.getByText("Your housing plan is saved and reflected in your enrollment record."),
    ).toBeVisible();

    await page.goto("/enrollment");
    await expect(
      page.getByRole("region", { name: "Delegated portal session" }),
    ).toContainText("FERPA settings remain student-controlled.");
    await expect(
      page.getByRole("link", { name: /FERPA.*access/i }),
    ).toHaveCount(0);

    await delegateContext.close();
  });

  test("opens delegated onboarding access inside My Enrollment and blocks onboarding mutations", async ({
    request,
    browser,
    baseURL,
  }) => {
    const completed = await completeFerpaThroughApi({
      request,
      delegates: [
        {
          ...delegateDraft,
          scopes: ["enrollment"],
        },
      ],
    });
    const delegate = completed.delegates[0];
    const link = await issueFerpaDelegateLink({
      request,
      authorization: completed,
      delegateId: delegate.id,
    });

    const delegateContext = await browser.newContext({ baseURL });
    const page = await delegateContext.newPage();
    await page.goto(delegatePortalUrl(baseURL, link));
    await expect(page).toHaveURL(/\/enrollment$/);
    await expect(
      page.getByRole("heading", { name: "Your requirements", exact: true }),
    ).toBeVisible();
    const navigation = page.getByRole("navigation", {
      name: "Student portal sections",
    });
    await page.goto("/onboarding");
    await expect(
      page,
    ).toHaveURL(/\/enrollment$/);
    await expect(navigation.getByRole("link", { name: "My Enrollment" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Onboarding" })).toHaveCount(0);

    const before = await delegateApiFetch(page, "/v1/student/onboarding");
    expect(before.status).toBe(200);
    const forgedUpdate = await delegateApiFetch(page, "/v1/student/onboarding", {
      method: "PUT",
      body: {
        expectedVersion: 1,
        currentStep: "about_you",
        data: { preferredName: "Parent Controlled" },
      },
    });
    expect(forgedUpdate.status).toBe(403);
    expect(apiErrorCode(forgedUpdate.body)).toBe("DELEGATE_ROUTE_NOT_ALLOWED");

    const forgedCompletion = await delegateApiFetch(
      page,
      "/v1/student/onboarding/complete",
      {
        method: "POST",
        idempotencyKey: `forged-onboarding-${crypto.randomUUID()}`,
        body: { expectedVersion: 1 },
      },
    );
    expect(forgedCompletion.status).toBe(403);
    expect(apiErrorCode(forgedCompletion.body)).toBe(
      "DELEGATE_ROUTE_NOT_ALLOWED",
    );
    const after = await delegateApiFetch(page, "/v1/student/onboarding");
    expect(after).toEqual(before);

    await delegateContext.close();
  });

  test("renders a dashboard-only share without cross-page navigation", async ({
    request,
    browser,
    baseURL,
  }) => {
    const completed = await completeFerpaThroughApi({
      request,
      delegates: [
        {
          ...delegateDraft,
          scopes: ["dashboard"],
        },
      ],
    });
    const delegate = completed.delegates[0];
    const link = await issueFerpaDelegateLink({
      request,
      authorization: completed,
      delegateId: delegate.id,
    });

    const delegateContext = await browser.newContext({ baseURL });
    const page = await delegateContext.newPage();
    await page.goto(delegatePortalUrl(baseURL, link));

    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upcoming campus events" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your financial snapshot" })).toBeVisible();
    await expect(page.getByLabel("Academic summary")).toBeVisible();
    const navigation = page.getByRole("navigation", {
      name: "Student portal sections",
    });
    await expect(navigation.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(
      navigation.getByRole("link", {
        name: /My Enrollment|My Financials|My Classrooms|Campus Life|My Documents|Profile/,
      }),
    ).toHaveCount(0);
    await expect(
      page.locator(
        'a[href*="/enrollment"], a[href*="/financials"], a[href*="/classrooms"], a[href*="/campus-life"], a[href*="/documents"]',
      ),
    ).toHaveCount(0);

    await delegateContext.close();
  });
});
