import { expect, test } from "@playwright/test";
import { resetAndAuthenticateDemoStudent } from "../support/demo-session";

test.describe("student and staff inquiry round trip", () => {
  test.beforeEach(async ({ request, context, baseURL }) => {
    await resetAndAuthenticateDemoStudent({ request, context, baseURL });
  });

  test("submits, assigns, replies to, and delivers a student inquiry", async ({
    page,
  }) => {
    const question = "Which transcript should I use for my dual-enrollment courses?";
    const reply = "Please upload the official transcript from the college that awarded credit.";

    await page.goto("/aster/help");
    await expect(
      page.getByRole("heading", { name: "How can we help?" }),
    ).toBeVisible();
    await page.locator('select[name="topicCode"]').selectOption("documents");
    await page.getByLabel("Your question").fill(question);
    await page.getByRole("button", { name: "Send inquiry" }).click();
    await expect(
      page.getByText("Your inquiry is now in the staff message portal."),
    ).toBeVisible();

    await page.goto("/aster/staff");
    await expect(
      page.getByRole("heading", { name: "Staff sign in" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Today.*enrollment work/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Messages/ }).click();
    await expect(
      page.getByRole("heading", { name: "Message portal" }),
    ).toBeVisible();

    await page.getByRole("button").filter({ hasText: question }).click();
    const reader = page.locator(".staff-message-reader");
    await expect(reader.getByText(question, { exact: true })).toBeVisible();
    await reader.getByLabel("Status").selectOption("open");
    await reader.getByLabel("Owner").selectOption({ label: "Priya Shah" });
    await reader
      .getByRole("textbox", { name: "Reply", exact: true })
      .fill(reply);
    await reader.getByRole("button", { name: "Save and reply" }).click();
    await expect(reader.getByText("open", { exact: true })).toBeVisible();

    await page.goto("/aster/messages");
    await expect(page.getByText(reply, { exact: true })).toBeVisible();
  });
});
