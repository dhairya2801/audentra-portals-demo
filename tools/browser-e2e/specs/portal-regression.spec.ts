import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const sessionCookie = "demo-session-v2";

async function authenticateDemoStudent(
  context: BrowserContext,
  baseURL: string | undefined,
) {
  if (!baseURL) throw new Error("Playwright baseURL is required");
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: "vv_demo_session",
      value: sessionCookie,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: url.protocol === "https:",
    },
  ]);
}

async function expectLoadedImage(page: Page, source: RegExp) {
  const image = page.locator(".campus-carousel__background");
  await expect(image).toHaveAttribute("src", source);
  await expect(image).toHaveAttribute("alt", /.+/);
  await expect
    .poll(() =>
      image.evaluate(
        (element) =>
          element instanceof HTMLImageElement &&
          element.complete &&
          element.naturalWidth > 0,
      ),
    )
    .toBe(true);
}

test.describe("student portal regression journeys", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await authenticateDemoStudent(context, baseURL);
  });

  test("uses a distinct staff-configured image and visual theme for each featured event", async ({
    page,
  }) => {
    await page.goto("/aster/campus-life");
    const carousel = page.getByLabel("Featured campus events");

    await expect(carousel).toHaveAttribute("data-visual-theme", "festival");
    await expect(carousel.getByRole("heading", { level: 2 })).toHaveText(
      "Welcome Week Block Party",
    );
    await expectLoadedImage(page, /welcome-week-block-party\.webp$/);

    await page
      .getByRole("button", { name: "Next featured event" })
      .click();
    await expect(carousel).toHaveAttribute("data-visual-theme", "discovery");
    await expect(carousel.getByRole("heading", { level: 2 })).toHaveText(
      "First-Year Research Showcase",
    );
    await expectLoadedImage(page, /first-year-research-showcase\.webp$/);

    await page
      .getByRole("button", { name: "Next featured event" })
      .click();
    await expect(carousel).toHaveAttribute("data-visual-theme", "career");
    await expect(carousel.getByRole("heading", { level: 2 })).toHaveText(
      "Internship Ready Lab",
    );
    await expectLoadedImage(page, /internship-ready-lab\.webp$/);
  });

  test("keeps the visual carousel readable without horizontal overflow on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/aster/campus-life");
    await expectLoadedImage(page, /welcome-week-block-party\.webp$/);
    await expect(page.getByLabel("Featured campus events")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1,
        ),
      )
      .toBe(true);
    await expect(
      page.getByRole("button", { name: "Next featured event" }),
    ).toBeVisible();
  });

  test("opens a tenant-scoped club calendar with contact and upcoming events", async ({
    page,
  }) => {
    await page.goto("/aster/campus-life");
    const robotics = page.getByRole("link", {
      name: /Aster Robotics.*Explore club, events & calendar/i,
    });
    await expect(robotics).toHaveAttribute(
      "href",
      /\/aster\/campus-life\/clubs\//,
    );
    await robotics.click();

    await expect(page).toHaveURL(/\/aster\/campus-life\/clubs\//);
    await expect(
      page.getByRole("heading", { name: "Upcoming events" }),
    ).toBeVisible();
    await expect(page.locator(".club-event-card")).toHaveCount(3);
    await expect(page.getByText("robotics@aster.edu")).toBeVisible();
  });

  test("shows staff-selected PDF resources in course details with safe new-tab links", async ({
    page,
  }) => {
    await page.goto("/aster/classrooms");
    await page
      .getByRole("row", {
        name: /^CS 101 Programming Fundamentals/,
      })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Programming Fundamentals");
    await expect(
      dialog.getByText("Relevant resources", { exact: true }),
    ).toBeVisible();
    const resource = dialog.getByRole("link", { name: /Open PDF/i }).first();
    await expect(resource).toHaveAttribute("target", "_blank");
    await expect(resource).toHaveAttribute("rel", /noreferrer/);
    await expect(resource).toHaveAttribute("href", /^https:\/\//);
  });

  test("preserves enrollment actions, document layout, and the secure sign-out control", async ({
    page,
  }) => {
    await page.goto("/aster/enrollment");
    await expect(page.getByText("Open task", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("link", {
        name: /View prerequisites Submit your official transcript/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: /View prerequisites Provide identity documentation/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: /Upload aid documents Complete financial-aid verification/i,
      }),
    ).toBeVisible();

    await page.goto("/aster/documents");
    await expect(
      page.getByRole("heading", { name: /Submitted & signed documents/i }),
    ).toBeVisible();
    const steps = page.locator(".processing-steps");
    await expect(steps.getByRole("listitem")).toHaveCount(3);
    expect(
      await steps.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).paddingLeft),
      ),
    ).toBeGreaterThan(0);

    await page.goto("/aster/profile");
    const session = page.locator(".profile-session-card");
    await expect(session).toContainText("Signed in securely");
    await expect(
      session.getByRole("button", { name: /Sign out of the portal/i }),
    ).toBeVisible();
  });

  test("keeps Aster and Harvard content isolated and protects signed-out routes", async ({
    browser,
    page,
    baseURL,
  }) => {
    await page.goto("/harvard/campus-life");
    await expect(page.getByText("Clubs at Harvard")).toBeVisible();
    await expect(page.getByText("Harvard Computer Society")).toBeVisible();
    await expect(page.getByText("Aster Robotics")).toHaveCount(0);
    await expect(
      page.getByLabel("Featured campus events"),
    ).toHaveAttribute("data-visual-theme", "festival");

    const signedOut = await browser.newContext({ baseURL });
    const protectedPage = await signedOut.newPage();
    await protectedPage.goto("/aster/enrollment");
    await expect(protectedPage).toHaveURL(/\/aster\/sign-in$/);
    await signedOut.close();
  });
});
