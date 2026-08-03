import { expect, test, type Page } from "@playwright/test";

async function expectJourneyPublish(page: Page, trigger: () => Promise<void>) {
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/v1/staff/configurations/journeys" &&
      response.request().method() === "PUT",
  );
  await trigger();
  const response = await responsePromise;
  const responseBody = await response.text();
  expect(
    response.ok(),
    `journey publish returned ${response.status()}: ${responseBody}`,
  ).toBeTruthy();
}

async function openJourneys(page: Page) {
  await page
    .locator("aside.staff-sidebar--workspace:visible")
    .getByRole("navigation", { name: "Staff workspace" })
    .getByRole("button", { name: /Journeys/i })
    .click();
  await expect(
    page.getByRole("heading", { name: "Onboarding and enrollment", exact: true }),
  ).toBeVisible();
}

test.describe("staff portal journeys", () => {
  test("authenticates, opens the operations workspace, and signs out", async ({
    page,
  }) => {
    await page.goto("/aster/staff");

    await expect(
      page.getByRole("heading", { name: "Staff sign in" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: /Today.*enrollment work/ }),
    ).toBeVisible();
    await expect(page.getByLabel("Today at a glance")).toBeVisible();
    await expect(page.getByText("Priya Shah", { exact: true })).toBeVisible();

    await page
      .getByRole("button", { name: "Open my Action Center", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Action center", exact: true }),
    ).toBeVisible();

    await page.locator('[title="Sign out"]').click();
    await expect(
      page.getByRole("heading", { name: "Staff sign in" }),
    ).toBeVisible();
  });

  test("builds offer-onboarding and enrollment-checklist flows accessibly", async ({
    page,
  }) => {
    await page.goto("/aster/staff");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Today.*enrollment work/ }),
    ).toBeVisible();

    await page
      .locator("aside.staff-sidebar--workspace:visible")
      .getByRole("navigation", { name: "Staff workspace" })
      .getByRole("button", { name: /Journeys/i })
      .click();
    await expect(
      page.getByRole("heading", { name: "Onboarding and enrollment", exact: true }),
    ).toBeVisible();

    const onboardingBuilder = page
      .locator("section.staff-panel")
      .filter({
        has: page.getByRole("heading", {
          name: "New student onboarding",
          exact: true,
        }),
      });
    await expect(onboardingBuilder.getByRole("button", { name: "Add step" })).toBeVisible();
    const firstStep = onboardingBuilder.locator(".staff-journey-list > li").first();
    await expect(firstStep).toHaveAttribute("draggable", "false");
    await expect(firstStep.getByRole("button", { name: /Move .* up/ })).toBeDisabled();
    await expect(firstStep.getByRole("button", { name: /Move .* down/ })).toBeDisabled();
    await expect(firstStep.getByRole("switch")).toBeDisabled();
    await expect(firstStep.getByRole("note")).toContainText("Required system screen");

    const aboutYouStep = onboardingBuilder
      .locator(".staff-journey-list > li")
      .filter({ hasText: "Tell us about you" });
    await aboutYouStep.getByRole("button", { name: "Edit screen" }).click();
    const builtInPanel = page.getByLabel("Edit built-in onboarding screen");
    await expect(builtInPanel.getByLabel("Journey list label")).toHaveValue(
      "Tell us about you",
    );
    await expect(builtInPanel.getByLabel("Student page section label")).toHaveValue(
      "About you",
    );
    await expect(builtInPanel.getByLabel("Student page heading")).toHaveValue(
      "Identity & home address",
    );
    await expect(builtInPanel.getByLabel("Responsible office")).toHaveValue(
      "Enrollment Services",
    );
    await expect(builtInPanel.getByLabel("Student form builder")).toBeVisible();
    await expect(builtInPanel.getByLabel("Student page preview")).toContainText(
      "Identity & home address",
    );
    await expect(
      builtInPanel.getByRole("button", { name: "Save and publish" }),
    ).toBeVisible();
    await builtInPanel.getByRole("button", { name: "Cancel" }).click();

    await onboardingBuilder.getByRole("button", { name: "Add step" }).click();
    const addOnboarding = page.getByLabel("Add journey step");
    await expect(addOnboarding.locator(".staff-journey-task-id code")).toHaveText(
      /^new_onboarding_step_[a-z0-9]+$/,
    );
    await addOnboarding.getByLabel("Input / action type").selectOption("signature");
    await expect(addOnboarding.getByLabel("E-signature provider")).toBeVisible();
    await addOnboarding.getByLabel("E-signature provider").selectOption("docusign");
    await expect(addOnboarding).toContainText("configuration only");
    await addOnboarding
      .getByLabel("Input / action type")
      .selectOption("multiple_select");
    await expect(addOnboarding.getByLabel("Option values")).toBeVisible();
    await expect(addOnboarding.getByLabel("Maximum selections")).toBeVisible();
    await addOnboarding.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("tab", { name: "Enrollment checklist" }).click();
    const enrollmentBuilder = page
      .locator("section.staff-panel")
      .filter({
        has: page.getByRole("heading", {
          name: "Post-acceptance enrollment",
          exact: true,
        }),
      });
    const firstEnrollmentStep = enrollmentBuilder
      .locator(".staff-journey-list > li")
      .first();
    await firstEnrollmentStep.getByRole("button", { name: "Edit step" }).click();
    const enrollmentEditor = page.getByLabel("Edit journey step");
    await enrollmentEditor.getByRole("button", { name: "Delete step" }).click();
    await expect(enrollmentEditor.getByText(/Delete .*\?/)).toBeVisible();
    await enrollmentEditor.getByRole("button", { name: "Keep step" }).click();
    await enrollmentEditor.getByRole("button", { name: "Cancel" }).click();
    await enrollmentBuilder.getByRole("button", { name: "Add step" }).click();
    const addEnrollment = page.getByLabel("Add journey step");
    await expect(addEnrollment.locator(".staff-journey-task-id code")).toHaveText(
      /^new_enrollment_step_[a-z0-9]+$/,
    );
    await addEnrollment
      .getByLabel("Input / action type")
      .selectOption("upload_file");
    await expect(addEnrollment.getByLabel("Document categories")).toBeVisible();
    await expect(addEnrollment.getByLabel("Accepted MIME types")).toBeVisible();
    await addEnrollment.getByRole("button", { name: "Cancel" }).click();
  });

  test("publishes, reorders, deactivates, and deletes a sacrificial step", async ({
    page,
  }) => {
    const marker = Date.now().toString(36);
    const title = `Journey builder test ${marker}`;
    await page.goto("/aster/staff");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Today.*enrollment work/ }),
    ).toBeVisible();
    await openJourneys(page);
    await page.getByRole("tab", { name: "Enrollment checklist" }).click();

    const builder = page
      .locator("section.staff-panel")
      .filter({
        has: page.getByRole("heading", {
          name: "Post-acceptance enrollment",
          exact: true,
        }),
      });
    const row = builder.locator(".staff-journey-list > li").filter({ hasText: title });

    try {
      await builder.getByRole("button", { name: "Add step" }).click();
      const editor = page.getByLabel("Add journey step");
      await editor.getByLabel("Step name").fill(title);
      await editor
        .getByLabel("Student instructions")
        .fill("Choose the test response used to verify the staff flow builder.");
      await editor.getByLabel("Input / action type").selectOption("single_select");
      await editor.getByLabel("Option values").fill("yes\nno");
      await expectJourneyPublish(page, async () => {
        await editor.getByRole("button", { name: "Save and publish" }).click();
      });
      await expect(row).toBeVisible();

      const journeyRows = builder.locator(".staff-journey-list > li");
      const dragTargetTitle = await journeyRows
        .nth(-2)
        .locator("strong")
        .innerText();
      const dragTarget = journeyRows.filter({
        has: page.getByText(dragTargetTitle, { exact: true }),
      });
      await expectJourneyPublish(page, async () => {
        await row.dragTo(dragTarget);
      });
      await expect(journeyRows.nth(-2)).toContainText(title);
      await expectJourneyPublish(page, async () => {
        await dragTarget.dragTo(row);
      });
      await expect(journeyRows.last()).toContainText(title);

      await expectJourneyPublish(page, async () => {
        await row.getByRole("button", { name: `Move ${title} up` }).click();
      });
      await expectJourneyPublish(page, async () => {
        await row.getByRole("button", { name: `Move ${title} down` }).click();
      });

      await expectJourneyPublish(page, async () => {
        await row.getByRole("switch", { name: `Deactivate ${title}` }).click();
      });
      await expect(row).toHaveClass(/is-inactive/);
      await expect(row.getByRole("switch", { name: `Activate ${title}` })).toBeVisible();

      await row.getByRole("button", { name: "Edit step" }).click();
      const deleteEditor = page.getByLabel("Edit journey step");
      await deleteEditor.getByRole("button", { name: "Delete step" }).click();
      await expectJourneyPublish(page, async () => {
        await deleteEditor.getByRole("button", { name: "Confirm delete" }).click();
      });
      await expect(row).toHaveCount(0);
    } finally {
      try {
        if (await row.count()) {
          await row.getByRole("button", { name: "Edit step" }).click();
          const cleanupEditor = page.getByLabel("Edit journey step");
          await cleanupEditor.getByRole("button", { name: "Delete step" }).click();
          await expectJourneyPublish(page, async () => {
            await cleanupEditor.getByRole("button", { name: "Confirm delete" }).click();
          });
        }
      } catch {
        // The assertion failure remains primary; the marker makes manual cleanup obvious.
      }
    }
  });

  test("campus event images use a validated drag-and-drop control", async ({ page }) => {
    await page.goto("/harvard/staff");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Today.*enrollment work/ }),
    ).toBeVisible();
    await page
      .locator("aside.staff-sidebar--workspace:visible")
      .getByRole("navigation", { name: "Staff workspace" })
      .getByRole("button", { name: /Campus life/i })
      .click();
    await expect(page.getByRole("heading", { name: "Campus life", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Edit event/i }).first().click();
    const editor = page.getByLabel("Edit campus event");
    const dropzone = editor.getByRole("button", {
      name: "Upload or drop an event image",
    });
    await expect(dropzone).toBeVisible();
    await expect(dropzone).toContainText("Drop an event image here");
    await expect(dropzone.locator('input[type="file"]')).toHaveAttribute(
      "accept",
      /image\/jpeg.*image\/png.*image\/webp/,
    );
    await editor.getByRole("button", { name: "Cancel" }).click();
  });
});
