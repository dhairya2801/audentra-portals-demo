import { expect, test } from "@playwright/test";
import { resetAndAuthenticateDemoStudent } from "../support/demo-session";

test.describe("student experience overview", () => {
  test.beforeEach(async ({ request, context, baseURL }) => {
    await resetAndAuthenticateDemoStudent({ request, context, baseURL });
  });

  test("combines enrollment, campus, and financial actions on the dashboard", async ({
    page,
  }) => {
    await page.goto("/aster/dashboard");

    const calendar = page.getByRole("heading", {
      name: "Your student calendar",
    }).locator("..").locator("..");
    await expect(calendar).toBeVisible();
    await expect(page.getByLabel("Calendar legend")).toContainText(
      /Enrollment|Campus life|Financial aid|Payments/,
    );
    await expect(
      page.getByRole("heading", { name: "Upcoming campus events" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Your financial snapshot" }),
    ).toBeVisible();

    const datedAction = calendar.locator('button[aria-pressed="false"]').first();
    if (await datedAction.count()) {
      await datedAction.click();
      await expect(datedAction).toHaveAttribute("aria-pressed", "true");
      await expect(calendar.getByRole("link").last()).toBeVisible();
    }

    await page.getByRole("button", { name: /unread notifications/i }).click();
    await expect(page.getByRole("region", { name: "Notifications" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "Notifications" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /unread notifications/i }),
    ).toBeFocused();
  });

  test("groups enrollment work and keeps its calendar enrollment-only", async ({
    page,
  }) => {
    await page.goto("/aster/enrollment");

    await expect(page.getByRole("heading", { name: "Action needed" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "In review" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Completed" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Enrollment deadlines" }),
    ).toBeVisible();
    const legend = page.getByLabel("Calendar legend");
    await expect(legend).toContainText("Enrollment");
    await expect(legend).not.toContainText("Campus life");
    await expect(legend).not.toContainText("Payments");

    const blockedAction = page.getByRole("link", {
      name: /View prerequisites/i,
    }).first();
    await expect(blockedAction).toHaveAttribute(
      "href",
      /\/aster\/enrollment\/requirements\//,
    );
    await blockedAction.click();
    await expect(page).toHaveURL(/\/aster\/enrollment\/requirements\//);
    const prerequisite = page.getByRole("link", {
      name: /prerequisite/i,
    }).first();
    if (await prerequisite.count()) {
      await expect(prerequisite).toHaveAttribute(
        "href",
        /\/aster\/enrollment\/requirements\//,
      );
    }
  });

  test("restores the document record before enabling another upload", async ({
    page,
  }) => {
    let releaseLookup!: () => void;
    const lookupBarrier = new Promise<void>((resolve) => {
      releaseLookup = resolve;
    });
    await page.route(/\/v1\/student\/documents(?:\?.*)?$/, async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await lookupBarrier;
      await route.continue();
    });

    await page.goto(
      "/aster/enrollment/requirements/financial-aid-verification",
    );
    await expect(
      page.getByText("Checking for an existing upload\u2026", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Drop files here or browse/)).toHaveCount(0);

    releaseLookup();
    await expect(
      page.getByText("Checking for an existing upload\u2026", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(/Drop files here or browse/)).toBeVisible();
  });
});
