import { expect, test } from "@playwright/test";

async function selectCreateAccount(page: import("@playwright/test").Page) {
  const tab = page.getByRole("tab", { name: "Create account" });
  await expect
    .poll(
      async () => {
        if ((await tab.getAttribute("aria-selected")) !== "true") {
          await tab.click();
        }
        return tab.getAttribute("aria-selected");
      },
      { timeout: 10_000 },
    )
    .toBe("true");
  await expect(page.locator('input[name="phone"]')).toBeVisible();
}

test.describe("credential journeys through the browser", () => {
  test("shows persistent, field-specific feedback for malformed signup data", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await selectCreateAccount(page);

    await page.locator('input[name="email"]').fill("student-at-example");
    await page.locator('input[name="phone"]').fill("555");
    await page.locator('input[name="password"]').fill("allletters");
    await page
      .locator('input[name="passwordConfirmation"]')
      .fill("different-password-123");
    await page
      .getByRole("button", { name: /create account and start onboarding/i })
      .click();

    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(
      page.getByText(
        "Enter a valid email address, such as you@example.com.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Use an international phone number, such as +15551234567.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Use a password between 12 and 128 characters.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("The passwords do not match.", { exact: true }),
    ).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeFocused();
  });

  test("normalizes valid contact input and rejects a duplicate account in the UI", async ({
    browser,
    baseURL,
  }) => {
    const unique = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const email = `browser.${unique}@example.com`;
    const phone = `+1555${unique.replaceAll("-", "").slice(-7).padStart(7, "0")}`;
    const password = "Browser-student-123";

    const firstContext = await browser.newContext({ baseURL });
    const firstPage = await firstContext.newPage();
    await firstPage.goto("/sign-in");
    await selectCreateAccount(firstPage);
    await firstPage.locator('input[name="email"]').fill(`  ${email.toUpperCase()}  `);
    await firstPage.locator('input[name="phone"]').fill(phone);
    await firstPage.locator('input[name="password"]').fill(password);
    await firstPage
      .locator('input[name="passwordConfirmation"]')
      .fill(password);
    await firstPage
      .getByRole("button", { name: /create account and start onboarding/i })
      .click();
    await expect(firstPage).toHaveURL(/\/onboarding$/);
    await firstContext.close();

    const secondContext = await browser.newContext({ baseURL });
    const secondPage = await secondContext.newPage();
    await secondPage.goto("/sign-in");
    await selectCreateAccount(secondPage);
    await secondPage.locator('input[name="email"]').fill(email);
    await secondPage.locator('input[name="phone"]').fill("+15551239999");
    await secondPage.locator('input[name="password"]').fill(password);
    await secondPage
      .locator('input[name="passwordConfirmation"]')
      .fill(password);
    await secondPage
      .getByRole("button", { name: /create account and start onboarding/i })
      .click();

    await expect(secondPage).toHaveURL(/\/sign-in$/);
    await expect(secondPage.getByRole("alert")).toContainText(
      /account already exists/i,
    );
    await secondContext.close();
  });

  test("does not reveal whether an account exists when a password is wrong", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.locator('input[name="email"]').fill("missing.student@example.com");
    await page.locator('input[name="password"]').fill("Wrong-password-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("alert")).toContainText(
      "Email or password is incorrect",
    );
  });
});
