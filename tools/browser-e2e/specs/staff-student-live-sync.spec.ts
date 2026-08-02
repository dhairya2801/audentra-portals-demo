import {
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import {
  authenticateDemoStudent,
  resetDemoStudent,
} from "../support/demo-session";

const JOURNEY_INSTRUCTION =
  'Add "Choose a meal plan" to onboarding as a single selection worth 20 points.';

async function expectSuccessfulWrite(
  page: Page,
  path: string | RegExp,
  method: "POST" | "PUT",
  trigger: () => Promise<void>,
) {
  const responsePromise = page.waitForResponse(
    (response) => {
      const pathname = new URL(response.url()).pathname;
      const pathMatches =
        typeof path === "string" ? pathname === path : path.test(pathname);
      return pathMatches && response.request().method() === method;
    },
  );
  await trigger();
  const response = await responsePromise;
  expect(
    response.ok(),
    `${method} ${String(path)} returned ${response.status()}`,
  ).toBeTruthy();
  return response;
}

async function openStaffView(page: Page, label: string, heading: string) {
  const navigation = page
    .locator("aside.staff-sidebar--workspace:visible")
    .getByRole("navigation", { name: "Staff workspace" });
  await navigation
    .getByRole("button", { name: new RegExp(label, "i") })
    .click();
  await expect(
    page.getByRole("heading", { name: heading, exact: true }),
  ).toBeVisible();
}

async function dismissExperienceUpdateIfPresent(page: Page) {
  const dialog = page.locator(".experience-update-dialog");
  const appeared = await dialog
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(
      () => true,
      () => false,
    );
  if (!appeared) return;

  await expectSuccessfulWrite(
    page,
    /^\/v1\/student\/experience-updates\/[^/]+\/decision$/,
    "POST",
    async () => {
      await dialog.getByRole("button", { name: "Remind me later" }).click();
    },
  );
  await expect(dialog).toBeHidden();
}

async function waitForExperienceDecision(
  page: Page,
  trigger: () => Promise<void>,
) {
  const responsePromise = page.waitForResponse(
    (response) =>
      /^\/v1\/student\/experience-updates\/[^/]+\/decision$/.test(
        new URL(response.url()).pathname,
      ) && response.request().method() === "POST",
  );
  await trigger();
  const response = await responsePromise;
  expect(response.ok(), `experience decision returned ${response.status()}`).toBeTruthy();
  return response;
}

async function authenticateContext(
  context: BrowserContext,
  baseURL: string,
) {
  await authenticateDemoStudent(context, baseURL);
}

function numericAttribute(value: string | null, label: string) {
  const parsed = Number(value);
  expect(Number.isFinite(parsed), `${label} should be numeric`).toBeTruthy();
  return parsed;
}

test.describe("staff-to-student live experience synchronization", () => {
  test("publishes journey and content changes into fresh tenant-scoped student pages", async ({
    browser,
    request,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required");
    await resetDemoStudent(request);

    const staffContext = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 1000 },
    });
    const studentContext = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 1000 },
    });
    await authenticateContext(studentContext, baseURL);

    const staffPage = await staffContext.newPage();
    const studentPage = await studentContext.newPage();
    const marker = Date.now().toString().slice(-8);
    const eventTitle = `Live Sync Event ${marker}`;
    const courseTitle = `Live Sync Course ${marker}`;

    try {
      await studentPage.goto("/aster/enrollment");
      const overallProgress = studentPage.getByRole("progressbar", {
        name: "Overall enrollment progress",
      });
      await expect(overallProgress).toBeVisible();
      const baselineProgress = numericAttribute(
        await overallProgress.getAttribute("aria-valuenow"),
        "baseline enrollment progress",
      );
      const baselineRequirementCount = await studentPage
        .locator(".resource-list > li")
        .count();

      await staffPage.goto("/aster/staff");
      await expect(
        staffPage.getByRole("heading", { name: "Staff sign in" }),
      ).toBeVisible();
      await staffPage
        .getByRole("button", { name: "Sign in", exact: true })
        .click();
      await expect(
        staffPage.getByRole("heading", { name: /Today.*enrollment work/ }),
      ).toBeVisible();

      await openStaffView(staffPage, "Journeys", "Onboarding and enrollment");
      const assistant = staffPage.locator(".staff-configuration-assistant");
      await assistant.getByLabel("What should change?").fill(JOURNEY_INSTRUCTION);
      await expectSuccessfulWrite(
        staffPage,
        "/v1/staff/edward/configuration-draft",
        "POST",
        async () => {
          await assistant
            .getByRole("button", { name: "Draft with Edward" })
            .click();
        },
      );
      await expect(assistant).toContainText("Choose a meal plan");
      await expectSuccessfulWrite(
        staffPage,
        "/v1/staff/configurations/journeys",
        "PUT",
        async () => {
          await assistant
            .getByRole("button", { name: "Confirm and publish" })
            .click();
        },
      );
      await expect(
        staffPage.getByText("Choose a meal plan", { exact: true }),
      ).toBeVisible();

      await studentPage.reload();
      const updateDialog = studentPage.locator(".experience-update-dialog");
      await expect(updateDialog).toBeVisible();
      await expect(updateDialog).toContainText("Choose a meal plan");
      await waitForExperienceDecision(studentPage, async () => {
        await updateDialog
          .getByRole("button", { name: "Remind me later" })
          .click();
      });
      await expect(updateDialog).toBeHidden();

      const mealPlanRequirement = studentPage
        .locator(".resource-list > li")
        .filter({ hasText: "Choose a meal plan" });
      await expect(
        mealPlanRequirement.getByRole("heading", {
          name: "Choose a meal plan",
          exact: true,
        }),
      ).toBeVisible();
      await expect(mealPlanRequirement).toContainText("Earn 20 points");
      await expect(studentPage.locator(".resource-list > li")).toHaveCount(
        baselineRequirementCount + 1,
      );
      const recalculatedProgress = numericAttribute(
        await overallProgress.getAttribute("aria-valuenow"),
        "recalculated enrollment progress",
      );
      expect(recalculatedProgress).toBeLessThan(baselineProgress);

      await openStaffView(staffPage, "Campus life", "Campus life");
      const eventEditButton = staffPage
        .locator(".staff-event-list")
        .getByRole("button", { name: /^Edit / })
        .first();
      await expect(eventEditButton).toBeVisible();
      await eventEditButton.click();
      const eventEditor = staffPage.getByLabel("Edit campus event");
      await eventEditor.getByLabel("Event title").fill(eventTitle);
      await expectSuccessfulWrite(
        staffPage,
        "/v1/staff/configurations/campus_life",
        "PUT",
        async () => {
          await eventEditor
            .getByRole("button", { name: "Save and publish" })
            .click();
        },
      );
      await expect(eventEditor).toBeHidden();

      const campusPage = await studentContext.newPage();
      await campusPage.goto("/aster/campus-life");
      await dismissExperienceUpdateIfPresent(campusPage);
      const showUpdatedEvent = campusPage.getByRole("button", {
        name: `Show ${eventTitle}`,
      });
      await expect(showUpdatedEvent).toBeVisible();
      await showUpdatedEvent.click();
      await expect(
        campusPage
          .getByLabel("Featured campus events")
          .getByRole("heading", { name: eventTitle, exact: true }),
      ).toBeVisible();
      await campusPage.close();

      await openStaffView(staffPage, "Academics", "Courses and catalog");
      const courseEditButton = staffPage
        .locator(".staff-course-list")
        .getByRole("button", { name: /^Edit / })
        .first();
      await expect(courseEditButton).toBeVisible();
      await courseEditButton.click();
      const courseEditor = staffPage.getByLabel("Edit course");
      await courseEditor.getByLabel("Course title").fill(courseTitle);
      await expectSuccessfulWrite(
        staffPage,
        "/v1/staff/configurations/academics",
        "PUT",
        async () => {
          await courseEditor
            .getByRole("button", { name: "Save and publish" })
            .click();
        },
      );
      await expect(courseEditor).toBeHidden();

      const classroomsPage = await studentContext.newPage();
      await classroomsPage.goto("/aster/classrooms");
      await dismissExperienceUpdateIfPresent(classroomsPage);
      await classroomsPage
        .getByLabel("Search by course code, title, or topic")
        .fill(courseTitle);
      await classroomsPage
        .getByRole("button", { name: "Search catalog" })
        .click();
      await expect(
        classroomsPage.locator(".course-results").getByText(courseTitle, {
          exact: true,
        }),
      ).toBeVisible();
      await classroomsPage.close();

      const harvardContext = await browser.newContext({
        baseURL,
        viewport: { width: 1440, height: 1000 },
      });
      await authenticateContext(harvardContext, baseURL);
      try {
        const harvardCampus = await harvardContext.newPage();
        await harvardCampus.goto("/harvard/campus-life");
        await expect(
          harvardCampus.getByRole("heading", { name: "Clubs at Harvard" }),
        ).toBeVisible();
        await expect(
          harvardCampus.getByText(eventTitle, { exact: true }),
        ).toHaveCount(0);
        await harvardCampus.close();

        const harvardClassrooms = await harvardContext.newPage();
        await harvardClassrooms.goto("/harvard/classrooms");
        await expect(
          harvardClassrooms.getByRole("heading", {
            name: "Search classes",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          harvardClassrooms.getByText(courseTitle, { exact: true }),
        ).toHaveCount(0);
        await harvardClassrooms.close();
      } finally {
        await harvardContext.close();
      }
    } finally {
      await staffContext.close();
      await studentContext.close();
    }
  });
});
