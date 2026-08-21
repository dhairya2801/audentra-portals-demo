import { expect, test, type Page } from "@playwright/test";
import { resetAndAuthenticateDemoStudent } from "../support/demo-session";

async function openFerpaTask(page: Page) {
  await page.goto("/enrollment");
  const updateDialog = page.getByRole("dialog");
  if (await updateDialog.isVisible()) {
    await updateDialog.getByRole("button", { name: "Handle now" }).click();
    await expect(page.getByRole("heading", { name: "FERPA access" })).toBeVisible();
    return;
  }
  const link = page.getByRole("link", { name: /FERPA.*access/i }).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole("heading", { name: "FERPA access" })).toBeVisible();
}

async function prepareTypedSignature(page: Page) {
  await page.getByLabel("Full legal name").fill("Maya Chen");
  await page
    .getByLabel(
      "I consent to use this electronic signature for the FERPA authorization.",
    )
    .check();
  await page
    .getByRole("button", { name: "Sign FERPA authorization" })
    .click();
  await expect(page.getByText(/Signature is ready/)).toBeVisible();
}

function delegateCard(page: Page, index: number) {
  return page
    .getByText(`Authorized person ${index}`, { exact: true })
    .locator("xpath=ancestor::article[1]");
}

async function chooseScope(card: ReturnType<typeof delegateCard>, name: RegExp) {
  await card.getByRole("checkbox", { name }).check();
}

async function removeSeededDelegates(page: Page) {
  const removeButtons = page.getByRole("button", { name: "Remove person" });
  while (await removeButtons.count()) {
    await removeButtons.first().click();
  }
}

test.describe("student FERPA access center", () => {
  test.beforeEach(async ({ request, context, baseURL }) => {
    await resetAndAuthenticateDemoStudent({ request, context, baseURL });
  });

  test("requires the signature and an explicit no-access decision, then stays manageable", async ({
    page,
  }) => {
    await openFerpaTask(page);

    await page.getByRole("button", { name: "Complete FERPA" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Choose whether to grant anyone access.",
    );

    await page
      .getByRole("radio", { name: /Do not grant anyone access/ })
      .check();
    await page.getByRole("button", { name: "Complete FERPA" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Sign the FERPA authorization before completing this task.",
    );
    await prepareTypedSignature(page);

    const completionResponse = page.waitForResponse(
      (response) =>
        /\/v1\/student\/requirements\/[^/]+\/ferpa\/complete$/.test(
          new URL(response.url()).pathname,
        ) && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Complete FERPA" }).click();
    expect((await completionResponse).status()).toBe(200);
    await expect(page.getByText("FERPA is complete.")).toBeVisible();
    await expect(page.getByText("Your portal stays private")).toBeVisible();
    await expect(page.getByText(/Signed by Maya Chen/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save access" })).toBeVisible();

    await page.goto("/enrollment");
    await expect(
      page.getByRole("link", {
        name: /Manage access.*FERPA.*access/i,
      }),
    ).toBeVisible();

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "FERPA access" })).toBeVisible();
    await expect(
      page.getByRole("radio", { name: /Do not grant anyone access/ }),
    ).toBeChecked();
    await expect(page.getByText(/Signed by Maya Chen/)).toBeVisible();

    await openFerpaTask(page);
    await expect(
      page.getByRole("radio", { name: /Do not grant anyone access/ }),
    ).toBeChecked();
    await expect(page.getByRole("button", { name: "Save access" })).toBeVisible();
  });

  test("completes with two independently scoped delegates and syncs Profile to My Enrollment", async ({
    page,
  }) => {
    await openFerpaTask(page);
    await prepareTypedSignature(page);
    await page
      .getByRole("radio", { name: /Grant selected access/ })
      .check();
    await removeSeededDelegates(page);

    await page.getByRole("button", { name: /Add parent or guardian/ }).click();
    const father = delegateCard(page, 1);
    await father.getByLabel("Full name").fill("Daniel Chen");
    await father.getByLabel("Email address").fill("daniel.chen@example.test");
    await father.getByLabel("Relationship").selectOption("parent");
    await chooseScope(father, /^Dashboard/);
    await chooseScope(father, /^My Enrollment/);
    await chooseScope(father, /^My Financials/);
    await chooseScope(father, /^Profile/);

    await page.getByRole("button", { name: /Add parent or guardian/ }).click();
    const guardian = delegateCard(page, 2);
    await guardian.getByLabel("Full name").fill("Elena Chen");
    await guardian.getByLabel("Email address").fill("elena.chen@example.test");
    await guardian.getByLabel("Relationship").selectOption("guardian");
    await chooseScope(guardian, /^Dashboard/);
    await chooseScope(guardian, /^My Documents/);
    await chooseScope(guardian, /^Messages/);

    const completionResponse = page.waitForResponse(
      (response) =>
        /\/v1\/student\/requirements\/[^/]+\/ferpa\/complete$/.test(
          new URL(response.url()).pathname,
        ) && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Complete FERPA" }).click();
    expect((await completionResponse).status()).toBe(200);
    await expect(page.getByText("FERPA is complete.")).toBeVisible();
    await expect(page.getByText("Daniel Chen", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Elena Chen", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/2 secure parent links are ready below/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy link" })).toHaveCount(2);

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "FERPA access" })).toBeVisible();
    const profileFather = delegateCard(page, 1);
    await expect(
      profileFather.getByRole("checkbox", { name: /^My Financials/ }),
    ).toBeChecked();
    await expect(
      profileFather.getByRole("checkbox", { name: /^Profile/ }),
    ).toBeChecked();

    await profileFather
      .getByRole("checkbox", { name: /^My Financials/ })
      .uncheck();
    const updateResponse = page.waitForResponse(
      (response) =>
        /\/v1\/student\/ferpa-authorizations\/[^/]+\/access$/.test(
          new URL(response.url()).pathname,
        ) && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save access" }).click();
    expect((await updateResponse).status()).toBe(200);
    await expect(page.getByText("Access changes saved.")).toBeVisible();

    await openFerpaTask(page);
    const enrollmentFather = delegateCard(page, 1);
    await expect(
      enrollmentFather.getByRole("checkbox", { name: /^My Financials/ }),
    ).not.toBeChecked();
    await expect(
      enrollmentFather.getByRole("checkbox", { name: /^Profile/ }),
    ).toBeChecked();
    const enrollmentGuardian = delegateCard(page, 2);
    await expect(
      enrollmentGuardian.getByRole("checkbox", { name: /^My Documents/ }),
    ).toBeChecked();
    await expect(page.getByText(/Signed by Maya Chen/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign FERPA authorization" }),
    ).toHaveCount(0);
  });

  test("keeps the FERPA workflow keyboard-usable without mobile overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFerpaTask(page);

    await expect(
      page.getByRole("list", { name: "FERPA completion progress" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Parent and guardian access" }),
    ).toBeVisible();
    await expect(
      page.getByRole("radiogroup", { name: "Choose a FERPA access decision" }),
    ).toBeVisible();

    await page.getByLabel("Full legal name").focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("radio", { name: /Type my signature/ }),
    ).toBeFocused();

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1,
        ),
      )
      .toBe(true);
  });
});
