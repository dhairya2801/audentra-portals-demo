import { expect, test, type Page } from "@playwright/test";
import { signInDemoStaff } from "../support/demo-session";

async function openJourneys(page: Page) {
  await page
    .locator("aside.staff-sidebar--workspace:visible")
    .getByRole("navigation", { name: "Staff workspace" })
    .getByRole("button", { name: /Journeys/i })
    .click();
  await expect(
    page.getByRole("heading", { name: "Onboarding and enrollment" }),
  ).toBeVisible();
}

async function publishedJourneyResponse(
  page: Page,
  trigger: () => Promise<void>,
) {
  const pending = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        "/v1/staff/configurations/journeys" &&
      response.request().method() === "PUT",
  );
  await trigger();
  const response = await pending;
  const body = await response.text();
  expect(
    response.ok(),
    `FERPA journey publication returned ${response.status()}: ${body}`,
  ).toBeTruthy();
}

test.describe("staff FERPA journey authoring", () => {
  test("publishes the canonical FERPA block and exposes its dedicated task editor", async ({
    page,
  }) => {
    await page.goto("/staff");
    await signInDemoStaff(page);
    await expect(
      page.getByRole("heading", { name: /Today.*enrollment work/ }),
    ).toBeVisible();
    await openJourneys(page);

    const onboardingBuilder = page
      .locator("section.staff-panel")
      .filter({
        has: page.getByRole("heading", {
          name: "New student onboarding",
          exact: true,
        }),
      });
    const canonicalFerpa = onboardingBuilder
      .locator(".staff-journey-list > li")
      .filter({ hasText: "FERPA release and parent access" });
    await expect(canonicalFerpa).toBeVisible();
    await expect(canonicalFerpa).toContainText(/FERPA/i);
    await canonicalFerpa.getByRole("button", { name: /Edit screen|Edit step/ }).click();

    const canonicalEditor = page.getByRole("dialog", {
      name: /Edit built-in onboarding screen|Edit journey step/,
    });
    await expect(canonicalEditor).toBeVisible();
    await expect(canonicalEditor).toContainText(/FERPA/i);
    await publishedJourneyResponse(page, async () => {
      await canonicalEditor
        .getByRole("button", { name: "Save and publish" })
        .click();
    });
    await expect(canonicalFerpa).toBeVisible();

    await page.getByRole("tab", { name: "Enrollment checklist" }).click();
    const enrollmentBuilder = page
      .locator("section.staff-panel")
      .filter({
        has: page.getByRole("heading", {
          name: "Post-acceptance enrollment",
          exact: true,
        }),
      });
    await enrollmentBuilder.getByRole("button", { name: "Add step" }).click();
    const addEditor = page.getByRole("dialog", { name: "Add journey step" });
    await addEditor.getByLabel("Input / action type").selectOption("ferpa");
    await addEditor.getByRole("button", { name: /02 Student input/ }).click();
    await expect(addEditor.getByLabel("E-signature provider")).toBeVisible();
    await expect(addEditor).toContainText(/parent.*guardian.*access/i);
    await expect(addEditor).toContainText(/Dashboard/i);
    await expect(addEditor).toContainText(/My Enrollment/i);
    await expect(addEditor).toContainText(/Profile/i);
    await expect(
      addEditor
        .locator('[aria-label="FERPA portal pages"]')
        .getByText("Onboarding", { exact: true }),
    ).toHaveCount(0);
    await addEditor.getByRole("button", { name: "Cancel" }).click();
  });
});
