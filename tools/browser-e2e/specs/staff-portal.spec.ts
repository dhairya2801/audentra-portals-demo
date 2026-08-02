import { expect, test } from "@playwright/test";

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
});
