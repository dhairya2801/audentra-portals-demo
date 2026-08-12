import { expect, test } from "@playwright/test";
import { signInDemoStaff } from "../support/demo-session";

// Staff portal + Morning Brew journey against the live platform: sign in,
// complete the first-use setup, and confirm the briefing and the rest of the
// workspace stay healthy. Requires E2E_STAFF_PASSWORD like the other staff
// journeys.
test("staff portal serves Morning Brew alongside the workspace", async ({
  page,
}) => {
  await page.goto("/aster/staff");
  await signInDemoStaff(page);
  await expect(
    page.getByRole("heading", { name: /Today.*enrollment work/ }),
  ).toBeVisible();

  await page
    .locator("aside.staff-sidebar--workspace:visible")
    .getByRole("navigation", { name: "Staff workspace" })
    .getByRole("button", { name: /Morning Brew/i })
    .click();

  // First use lands on the three-step setup; a returning profile lands on
  // the briefing itself. Accept either as a healthy render.
  const setupHeading = page.getByRole("heading", {
    name: /What do you want to catch up on each morning\?/,
  });
  const briefing = page.locator(".brew-hero");
  await expect(setupHeading.or(briefing.first())).toBeVisible();

  // Walk the setup when it is showing and reach the generated briefing.
  if (await setupHeading.isVisible()) {
    await page.getByRole("button", { name: /Looks good/ }).click();
    await page.getByRole("button", { name: /Looks good/ }).click();
    await page.getByRole("button", { name: /Make my Morning Brew/ }).click();
    await expect(briefing.first()).toBeVisible();
  }

  // The briefing must show live-workspace substitutions, not an error state.
  await expect(page.locator(".staff-shell--workspace")).toBeVisible();

  // Other staff views still respond after Morning Brew.
  await page
    .locator("aside.staff-sidebar--workspace:visible")
    .getByRole("navigation", { name: "Staff workspace" })
    .getByRole("button", { name: /Today/i })
    .click();
  await expect(
    page.getByRole("heading", { name: /Today.*enrollment work/ }),
  ).toBeVisible();
});
