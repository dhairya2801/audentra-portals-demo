import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import type {
  StudentDashboard,
  StudentOnboarding,
  StudentOnboardingData,
} from "@vv/contracts";
import {
  authenticateDemoStudent,
  demoApiBaseUrl,
  resetDemoStudent,
  resetDemoStudentForOnboarding,
} from "../support/demo-session";

const demoStudentHeaders = {
  Cookie: "vv_demo_session=demo-session-v2",
  "X-Tenant-Slug": "aster",
};

type JsonHttpResponse = {
  ok(): boolean;
  status(): number;
  text(): Promise<string>;
};

async function responseJson<T>(response: JsonHttpResponse, operation: string) {
  const body = await response.text();
  if (!response.ok()) {
    throw new Error(`${operation} returned ${response.status()}: ${body}`);
  }
  return JSON.parse(body) as T;
}

function completePrerequisiteAnswers(
  onboarding: StudentOnboarding,
): StudentOnboardingData {
  const customFields = { ...onboarding.data.customFields };
  for (const field of
    onboarding.screenConfigurations?.about_you?.fields ?? []) {
    if (field.required && !customFields[field.id]) {
      customFields[field.id] = "Browser acceptance response";
    }
  }

  return {
    ...onboarding.data,
    firstName: "Maya",
    lastName: "Chen",
    preferredName: "Maya",
    personalEmail: "maya.chen@example.test",
    mobilePhone: "+15550104471",
    citizenshipStatus: "us_citizen",
    communicationPreference: "email",
    residencyStatus: "domestic",
    residencyVerificationPath: "home_address_review",
    streetAddress: "418 Larkspur Lane",
    city: "Cambridge",
    stateOrProvince: "MA",
    postalCode: "02139",
    country: "United States",
    housingPreference: "undecided",
    campusInterests: ["code_collective"],
    firstMonthGoals: ["friends_in_major"],
    emergencyContacts: [
      {
        fullName: "Daniel Chen",
        relationship: "parent",
        mobilePhone: "+15550104472",
      },
    ],
    customFields,
  };
}

async function positionFreshJourneyAtFerpa(request: APIRequestContext) {
  const dashboard = await responseJson<StudentDashboard>(
    await request.get(`${demoApiBaseUrl}/v1/student/dashboard`, {
      headers: demoStudentHeaders,
    }),
    "loading the fresh onboarding dashboard",
  );
  expect(dashboard.offer.status).toBe("offered");

  await responseJson(
    await request.post(
      `${demoApiBaseUrl}/v1/admission-offers/${encodeURIComponent(dashboard.offer.id)}/accept`,
      {
        headers: {
          ...demoStudentHeaders,
          "Content-Type": "application/json",
          "Idempotency-Key": `browser-ferpa-onboarding-offer-${crypto.randomUUID()}`,
        },
        data: {},
      },
    ),
    "accepting the fresh admission offer",
  );

  let onboarding = await responseJson<StudentOnboarding>(
    await request.get(`${demoApiBaseUrl}/v1/student/onboarding`, {
      headers: demoStudentHeaders,
    }),
    "loading the fresh onboarding journey",
  );
  expect(onboarding.status).toBe("in_progress");
  expect(onboarding.currentStep).toBe("offer");

  const answers = completePrerequisiteAnswers(onboarding);
  const prerequisiteSteps = [
    "offer",
    "about_you",
    "housing",
    "campus_life",
    "emergency_contacts",
  ] as const;

  for (const currentStep of prerequisiteSteps) {
    expect(onboarding.currentStep).toBe(currentStep);
    onboarding = await responseJson<StudentOnboarding>(
      await request.put(`${demoApiBaseUrl}/v1/student/onboarding`, {
        headers: {
          ...demoStudentHeaders,
          "Content-Type": "application/json",
        },
        data: {
          expectedVersion: onboarding.version,
          currentStep,
          data: answers,
        },
      }),
      `completing the ${currentStep} onboarding prerequisite`,
    );
  }

  expect(onboarding.currentStep).toBe("family_permissions");
  expect(onboarding.completedSteps).toEqual(prerequisiteSteps);
  return onboarding;
}

async function completeFerpaWithoutDelegates(page: Page) {
  await page.getByLabel("Full legal name").fill("Maya Chen");
  await page
    .getByLabel(
      "I consent to use this electronic signature for the FERPA authorization.",
    )
    .check();
  await page
    .getByRole("button", { name: "Sign FERPA authorization" })
    .click();
  await page
    .getByRole("radio", { name: /Do not grant anyone access/ })
    .check();

  const [response] = await Promise.all([
    page.waitForResponse(
      (response) =>
        /\/v1\/student\/requirements\/[^/]+\/ferpa\/complete$/.test(
          new URL(response.url()).pathname,
        ) && response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Complete FERPA", exact: true }).click(),
  ]);
  const body = await response.text();
  expect(
    response.status(),
    `FERPA completion returned ${response.status()}: ${body}`,
  ).toBe(200);
  await expect(
    page.getByRole("button", { name: "Save access", exact: true }),
  ).toBeVisible();
}

test("fresh onboarding mounts canonical FERPA and advances to the FERPA-free signing packet", async ({
  request,
  context,
  baseURL,
  page,
}) => {
  test.setTimeout(90_000);
  await resetDemoStudentForOnboarding(request);
  try {
    await positionFreshJourneyAtFerpa(request);
    await authenticateDemoStudent(context, baseURL);
    await page.goto("/onboarding");

    await expect(page.getByRole("region", { name: "FERPA access" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "FERPA access", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("FERPA task")).toBeVisible();
    const ferpaDocument = page.getByRole("group", {
      name: "Read your FERPA authorization",
    });
    await expect(ferpaDocument).toBeVisible();
    await expect(
      ferpaDocument.getByRole("img", { name: /FERPA Information Release page 1/i }),
    ).toBeVisible();
    await expect(
      ferpaDocument.getByRole("link", { name: "Open the full PDF" }),
    ).toBeVisible();
    await expect(page.getByLabel("FERPA signature placement preview")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Complete FERPA above" }),
    ).toBeDisabled();

    await completeFerpaWithoutDelegates(page);
    const advance = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/v1/student/onboarding" &&
        response.request().method() === "PUT",
    );
    await page
      .getByRole("button", { name: "Save and continue", exact: true })
      .click();
    const advanceResponse = await advance;
    expect(advanceResponse.status()).toBe(200);
    const advanced = await responseJson<StudentOnboarding>(
      advanceResponse,
      "advancing past canonical FERPA",
    );
    expect(advanced.currentStep).toBe("review_and_sign");

    await expect(
      page.getByRole("group", { name: "Read your document packet" }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Enrollment Information Acknowledgment/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("tablist", { name: "Onboarding documents" })
        .getByRole("tab"),
    ).toHaveCount(1);
    await expect(
      page.locator('input[name="signedDocumentIds"]'),
    ).toHaveCount(1);
    await expect(
      page.locator(
        'input[name="signedDocumentIds"][value="enrollment_acknowledgment"]',
      ),
    ).toHaveCount(1);
    await expect(
      page.locator('input[name="signedDocumentIds"][value*="ferpa" i]'),
    ).toHaveCount(0);
    await expect(page.getByText(/FERPA Information Release/i)).toHaveCount(0);
  } finally {
    await page.close();
    await resetDemoStudent(request);
  }
});
