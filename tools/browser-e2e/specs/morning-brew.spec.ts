import { expect, test } from "@playwright/test";
import { signInDemoStaff } from "../support/demo-session";

// Authentication handoff against the platform; Morning Brew itself currently
// renders its existing demo corpus. Requires E2E_STAFF_PASSWORD.
test("staff portal serves Morning Brew alongside the workspace", async ({ page }) => {
  await page.goto("/aster/staff");
  await signInDemoStaff(page);
  const navigation = page
    .locator("aside.staff-sidebar--workspace:visible")
    .getByRole("navigation", { name: "Staff workspace" });
  await navigation.getByRole("button", { name: /Morning Brew/i }).click();

  const setup = page.getByRole("heading", { name: /start your morning with what matters/ });
  const briefing = page.locator(".brew-hero");
  await expect(setup.or(briefing.first())).toBeVisible();
  if (await setup.isVisible()) {
    await page.getByRole("button", { name: "Looks good" }).click();
    await page.getByRole("button", { name: "Make my Morning Brew" }).click();
  }
  await expect(briefing).toBeVisible();
  await expect(page.locator(".staff-shell--workspace")).toBeVisible();
  await expect(page.locator(".brew-unavailable")).toHaveCount(0);
  await expect(page.getByText("Demo data.", { exact: true })).toBeVisible();
  await expect(page.locator("section.brew-news")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Higher Ed News/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "View full dashboard" })).toHaveCount(0);
  await expect(page.getByText(/Confidence:/)).toHaveCount(0);

  await navigation.getByRole("button", { name: /Action center/i }).click();
  await expect(page.locator(".brew-hero")).toHaveCount(0);
  await expect(page.locator(".staff-shell--workspace")).toBeVisible();
});
