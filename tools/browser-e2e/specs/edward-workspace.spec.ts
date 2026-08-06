import { expect, test } from "@playwright/test";
import { resetAndAuthenticateDemoStudent } from "../support/demo-session";

test.describe("Edward conversation workspace", () => {
  test.beforeEach(async ({ request, context, baseURL }) => {
    await resetAndAuthenticateDemoStudent({ request, context, baseURL });
  });

  test("keeps the full Edward workspace in document flow with its own history menu", async ({
    page,
  }) => {
    await page.goto("/edward");

    const workspace = page.getByRole("region", {
      name: "Edward AI student guide",
    });
    await expect(workspace).toBeVisible();
    await expect(page.locator("#edward-panel")).toHaveCount(0);
    await expect(page.locator(".edward-launcher")).toHaveCount(0);
    expect(await workspace.evaluate((element) => getComputedStyle(element).position)).toBe(
      "relative",
    );

    const historyMenu = page.getByRole("button", {
      name: "Open conversation history",
    });
    await expect(historyMenu).toHaveAttribute(
      "aria-controls",
      "edward-conversation-navigation",
    );

    await historyMenu.click();
    await expect(
      page.getByRole("complementary", {
        name: "Edward conversation history",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New conversation", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("This browser tab")).toBeVisible();
  });

  test("preserves the fixed floating assistant on other student pages", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const launcher = page.getByRole("button", { name: "Ask Edward" });
    await expect(launcher).toBeVisible();
    await launcher.click();

    const floatingPanel = page.getByRole("dialog", {
      name: "Edward AI student guide",
    });
    await expect(floatingPanel).toBeVisible();
    expect(
      await floatingPanel.evaluate((element) => getComputedStyle(element).position),
    ).toBe("fixed");
    await expect(
      floatingPanel.getByRole("button", { name: "Close Edward" }),
    ).toBeVisible();
    await expect(
      floatingPanel.getByRole("button", { name: /conversation history/i }),
    ).toHaveCount(0);
  });

  test("keeps the mobile portal menu above the in-flow Edward workspace", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/edward");

    await page
      .getByRole("button", { name: "Open conversation history" })
      .click();
    await page.getByRole("button", { name: "Open portal menu" }).click();

    await expect(page.locator(".aster-sidebar")).toHaveClass(/aster-sidebar--open/);
    const stacking = await page.evaluate(() => ({
      portal: Number.parseInt(
        getComputedStyle(document.querySelector(".aster-sidebar")!).zIndex,
        10,
      ),
      portalBackdrop: Number.parseInt(
        getComputedStyle(document.querySelector(".aster-nav-backdrop")!).zIndex,
        10,
      ),
      workspace: Number.parseInt(
        getComputedStyle(document.querySelector("#edward-workspace")!).zIndex,
        10,
      ),
    }));
    expect(stacking.portal).toBeGreaterThan(stacking.workspace);
    expect(stacking.portalBackdrop).toBeGreaterThan(stacking.workspace);
  });
});
