import {
  expect,
  test,
  type Locator,
  type Page,
  type Request,
  type Response,
} from "@playwright/test";

const EXTERNAL_CONTEXT_PATH = "/v1/staff/morning-brew/external-context";
const STAFF_ASSISTANT_MESSAGES_PATH = "/v1/staff/assistant/messages";
const PUBLIC_EDWARD_QUERY =
  "Search the public web for current FAFSA guidance";

interface ExternalContextPayload {
  status?: unknown;
  results?: unknown[];
}

interface StaffAssistantPayload {
  message?: unknown;
  provider?: unknown;
  blocks?: Array<{
    type?: unknown;
    query?: unknown;
    results?: unknown[];
  }>;
}

function matchesBrowserPost(response: Response, pathname: string): boolean {
  return (
    new URL(response.url()).pathname === pathname &&
    response.request().method() === "POST"
  );
}

function staffWorkspaceNavigation(page: Page): Locator {
  return page
    .locator("aside.staff-sidebar--workspace:visible")
    .getByRole("navigation", { name: "Staff workspace" });
}

async function signInOrCreateStaffAccountThroughUi(page: Page): Promise<void> {
  const email =
    process.env.E2E_STAFF_EMAIL?.trim() ||
    "priya.shah@aster.example.edu";
  const password = process.env.E2E_STAFF_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      "E2E_STAFF_PASSWORD is required for the visible staff sign-in journey",
    );
  }

  const signInForm = page.locator("form.staff-auth-form");
  await expect(
    page.getByRole("heading", { name: "Staff sign in" }),
  ).toBeVisible();
  await signInForm.getByLabel("Staff email").fill(email);
  await signInForm.getByLabel("Password").fill(password);
  await signInForm
    .getByRole("button", { name: "Sign in", exact: true })
    .click();

  const workspaceNavigation = staffWorkspaceNavigation(page);
  const signInError = signInForm.getByRole("alert");
  await expect
    .poll(
      async () =>
        (await workspaceNavigation.isVisible()) ||
        (await signInError.isVisible()),
      { message: "staff sign-in should open the workspace or explain why it failed" },
    )
    .toBe(true);
  if (await workspaceNavigation.isVisible()) return;

  // A freshly migrated local database has an approved staff identity but may
  // not have a credential yet. Claim it through the same form a staff member
  // sees; do not create the account through an API or injected session.
  const accessCode =
    process.env.E2E_STAFF_INVITATION_CODE?.trim() ||
    process.env.VV_STAFF_INVITATION_CODE?.trim() ||
    password;
  if (accessCode.length < 16) {
    throw new Error(
      "E2E_STAFF_INVITATION_CODE (or VV_STAFF_INVITATION_CODE) must be at least 16 characters for visible account creation",
    );
  }

  await page.getByRole("tab", { name: "Create account" }).click();
  const createAccountForm = page.locator("form.staff-auth-form");
  await expect(
    page.getByRole("heading", { name: "Create staff account" }),
  ).toBeVisible();
  await createAccountForm.getByLabel("Staff email").fill(email);
  // The rendered hint is part of the accessible name in this form. Its
  // controlled input name is the stable form contract and selects only the
  // visible primary password field, not the confirmation field.
  await createAccountForm.locator('input[name="password"]').fill(password);
  await createAccountForm.getByLabel("Confirm password").fill(password);
  await createAccountForm.getByLabel("Institution access code").fill(accessCode);
  await createAccountForm
    .getByRole("button", { name: "Create staff account", exact: true })
    .click();
  await expect(workspaceNavigation).toBeVisible();
}

async function expectSafeExternalLinks(sourceList: Locator): Promise<void> {
  await expect(sourceList).toBeVisible();
  const links = sourceList.getByRole("link");
  const linkCount = await links.count();
  expect(linkCount, "a non-empty result set should expose source links").toBeGreaterThan(0);

  for (let index = 0; index < linkCount; index += 1) {
    const link = links.nth(index);
    const href = await link.getAttribute("href");
    expect(href, "source links must have an href").toBeTruthy();
    expect(new URL(href as string).protocol).toMatch(/^https?:$/);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
}

async function expectRailStoryPreviews(sourceList: Locator): Promise<void> {
  const cards = sourceList.locator(".staff-web-source");
  const cardCount = await cards.count();
  expect(cardCount, "a non-empty result set should expose story cards").toBeGreaterThan(0);

  for (let index = 0; index < cardCount; index += 1) {
    const media = cards.nth(index).locator(".staff-web-source__media");
    await expect(media).toBeVisible();
    const thumbnail = media.locator("img.staff-web-source__thumbnail");
    const fallback = media.locator(".staff-web-source__thumbnail-fallback");
    expect(await thumbnail.count() + (await fallback.count())).toBe(1);
    if (await thumbnail.count()) {
      const src = await thumbnail.getAttribute("src");
      expect(src, "provider thumbnails must have a source URL").toBeTruthy();
      expect(new URL(src as string).protocol).toBe("https:");
      await expect(thumbnail).toHaveAttribute("referrerpolicy", "no-referrer");
    }
  }
}

test("staff receives curated external context in Morning Brew and can still ask Edward", async ({
  page,
}, testInfo) => {
  const observedContextRequests: Request[] = [];
  const observedContextResponses: Response[] = [];
  page.on("request", (observedRequest) => {
    if (new URL(observedRequest.url()).pathname === EXTERNAL_CONTEXT_PATH) {
      observedContextRequests.push(observedRequest);
    }
  });
  page.on("response", (observedResponse) => {
    if (new URL(observedResponse.url()).pathname === EXTERNAL_CONTEXT_PATH) {
      observedContextResponses.push(observedResponse);
    }
  });

  // Bare /staff is intentional: tenant resolution and staff authentication
  // must happen through the current public portal route.
  await page.goto("/staff");
  await signInOrCreateStaffAccountThroughUi(page);

  const workspaceNavigation = staffWorkspaceNavigation(page);
  await workspaceNavigation
    .getByRole("button", { name: "Morning Brew", exact: true })
    .click();

  const setupHeading = page.getByRole("heading", {
    name: "What do you want to catch up on each morning?",
  });
  const newsRail = page.locator("section.brew-news-rail");
  await expect
    .poll(async () => (await setupHeading.isVisible()) || (await newsRail.isVisible()))
    .toBe(true);

  // On a first visit, the automatic request begins before completing Morning
  // Brew setup. Returning staff take the same one-request path without setup.
  await expect
    .poll(
      () =>
        observedContextRequests.filter((request) => request.method() === "POST").length,
      { message: "Morning Brew should trigger external context before completing Morning Brew setup" },
    )
    .toBe(1);
  if (await setupHeading.isVisible()) {
    await page.getByRole("button", { name: "Looks good", exact: true }).click();
    await page.getByRole("button", { name: "Looks good", exact: true }).click();
    await page
      .getByRole("button", { name: "Make my Morning Brew", exact: true })
      .click();
  }

  await expect(newsRail).toBeVisible();
  await expect(newsRail.getByText("Higher Ed News", { exact: true })).toBeVisible();
  await expect(
    newsRail.getByRole("heading", { name: "Curated for you", exact: true }),
  ).toBeVisible();
  const refreshButton = newsRail
    .locator(".brew-news-rail__head")
    .getByRole("button", { name: "Refresh Higher Ed News" });
  await expect(refreshButton).toBeVisible();
  await expect
    .poll(
      async () => {
        const busy = await newsRail.getAttribute("aria-busy");
        const disabled = await refreshButton.isDisabled();
        return busy === "true" ? disabled : !disabled;
      },
      { message: "Refresh should be disabled only while the external-news rail is busy" },
    )
    .toBe(true);
  expect(
    await newsRail.evaluate((rail) => {
      const colophon = rail.closest(".brew")?.querySelector("footer.brew-colophon");
      return Boolean(
        colophon &&
          (rail.compareDocumentPosition(colophon) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      );
    }),
    "Higher Ed News should appear before the final daily-edition colophon",
  ).toBe(true);

  // The page triggers the canonical refresh itself. No browser-originated
  // query, provider key, or result stub is used in this journey.
  await expect
    .poll(
      () =>
        observedContextRequests.filter((request) => request.method() === "POST").length,
      { message: "Morning Brew should retain exactly one external-context trigger after setup" },
    )
    .toBe(1);
  await expect
    .poll(
      () =>
        observedContextRequests.filter((request) => request.method() === "GET").length,
      { message: "Morning Brew should read canonical external context after triggering it" },
    )
    .toBeGreaterThan(0);
  expect(
    observedContextRequests.find((request) => request.method() === "POST")?.postData(),
  ).toBeNull();

  await expect
    .poll(
      () => observedContextResponses.some((response) => response.request().method() === "GET"),
      { message: "the canonical external-context GET should receive a response" },
    )
    .toBe(true);

  const latestContextResponse = [...observedContextResponses]
    .reverse()
    .find((response) => response.request().method() === "GET");
  const contextWasAvailable = Boolean(latestContextResponse?.ok());
  const contextBody = contextWasAvailable
    ? ((await latestContextResponse?.json()) as ExternalContextPayload)
    : null;
  const contextStatus = typeof contextBody?.status === "string" ? contextBody.status : null;
  const requireReady = process.env.E2E_REQUIRE_WEB_SEARCH_READY === "true";

  if (contextStatus) {
    // A pending refresh can complete between observing the GET response and
    // rendering the rail. Assert the visible state is a valid canonical state
    // rather than coupling the UI to a stale response snapshot.
    await expect
      .poll(() => newsRail.getAttribute("data-external-context-status"))
      .toMatch(/^(idle|pending|running|ready|failed|unavailable)$/);
  }

  if (requireReady) {
    await expect
      .poll(
        () => newsRail.getAttribute("data-external-context-status"),
        { timeout: 60_000, message: "configured web search should reach a ready rail" },
      )
      .toBe("ready");
    await expect(refreshButton).toBeEnabled();
    await expectSafeExternalLinks(
      newsRail.getByRole("list", { name: "Curated higher education news" }),
    );
    await expectRailStoryPreviews(
      newsRail.getByRole("list", { name: "Curated higher education news" }),
    );

    // Staff can deliberately refresh the edition from the visible rail. The
    // second POST is still browser-originated and body-less; completion is
    // read back from the canonical platform state rather than mocked here.
    const initialPostCount = observedContextRequests.filter(
      (request) => request.method() === "POST",
    ).length;
    expect(initialPostCount).toBe(1);
    const refreshResponsePromise = page.waitForResponse((response) =>
      matchesBrowserPost(response, EXTERNAL_CONTEXT_PATH),
    );
    await refreshButton.click();
    const refreshResponse = await refreshResponsePromise;
    expect(refreshResponse.ok()).toBe(true);
    expect(refreshResponse.request().postData()).toBeNull();
    await expect
      .poll(
        () =>
          observedContextRequests.filter((request) => request.method() === "POST").length,
        { message: "the visible refresh button should make a second external-context trigger" },
      )
      .toBe(initialPostCount + 1);
    await expect
      .poll(
        () => newsRail.getAttribute("data-external-context-status"),
        { timeout: 60_000, message: "the refreshed edition should return to ready" },
      )
      .toBe("ready");
    await expectSafeExternalLinks(
      newsRail.getByRole("list", { name: "Curated higher education news" }),
    );
    await expectRailStoryPreviews(
      newsRail.getByRole("list", { name: "Curated higher education news" }),
    );

    if (process.env.E2E_CAPTURE_SCREENSHOTS === "true") {
      const screenshot = testInfo.outputPath("morning-brew-ready.png");
      await page.screenshot({ path: screenshot, fullPage: true });
      await testInfo.attach("Morning Brew external news rail", {
        path: screenshot,
        contentType: "image/png",
      });
    }
  } else if (contextStatus === "ready" && contextBody?.results?.length) {
    await expectSafeExternalLinks(
      newsRail.getByRole("list", { name: "Curated higher education news" }),
    );
    await expectRailStoryPreviews(
      newsRail.getByRole("list", { name: "Curated higher education news" }),
    );
  } else if (contextStatus === "pending" || contextStatus === "running") {
    await expect(newsRail.getByRole("status")).toContainText(
      /Gathering current higher education reporting|Refreshing external reporting/,
    );
    await expect
      .poll(
        () =>
          observedContextRequests.filter((request) => request.method() === "GET").length,
        { message: "pending external context should be polled" },
      )
      .toBeGreaterThan(1);
  } else if (contextStatus === "ready") {
    await expect(newsRail).toContainText("No current stories matched this edition.");
  } else if (contextStatus === "idle") {
    await expect(newsRail).toContainText("External reporting is being prepared");
  } else {
    await expect(newsRail.getByRole("alert")).toContainText(
      "External reporting is unavailable",
    );
  }

  // Edward's current/public turn is also submitted through the visible staff
  // UI. The deterministic public-web classifier does not need an AI key.
  await workspaceNavigation
    .getByRole("button", { name: "Edward", exact: true })
    .click();
  const edwardPanel = page.getByRole("region", {
    name: "Edward AI staff assistant",
  });
  await edwardPanel
    .getByLabel("Ask about students, tasks, or the workspace")
    .fill(PUBLIC_EDWARD_QUERY);
  const assistantResponsePromise = page.waitForResponse((response) =>
    matchesBrowserPost(response, STAFF_ASSISTANT_MESSAGES_PATH),
  );
  await edwardPanel.getByRole("button", { name: "Send message" }).click();
  const assistantResponse = await assistantResponsePromise;
  expect(assistantResponse.ok()).toBe(true);
  expect(assistantResponse.request().postDataJSON()).toMatchObject({
    message: PUBLIC_EDWARD_QUERY,
  });

  const assistantBody = (await assistantResponse.json()) as StaffAssistantPayload;
  expect(assistantBody.provider).toBe("guided");
  const sourceBlock = assistantBody.blocks?.find(
    (block) => block.type === "web_sources",
  );
  if (sourceBlock?.results?.length) {
    expect(sourceBlock.query).toBe("current FAFSA guidance");
    const sourcePanel = edwardPanel.locator("section.edward-web-sources");
    await expect(sourcePanel).toBeVisible();
    await expect(sourcePanel).toContainText("From the web");
    await expect(sourcePanel).toContainText(
      "External sources are not student records. Open and verify a source before acting.",
    );
    await expectSafeExternalLinks(
      sourcePanel.getByRole("list", { name: "External web sources" }),
    );
  } else if (!contextWasAvailable || ["unavailable", "failed"].includes(contextStatus ?? "")) {
    await expect(edwardPanel).toContainText(
      "I couldn't search the public web just now, so I haven't used or invented any external sources.",
    );
    await expect(
      edwardPanel.getByRole("list", { name: "External web sources" }),
    ).toHaveCount(0);
  } else {
    await expect(edwardPanel).toContainText(
      "I searched the public web but found no usable sources for that query.",
    );
  }
});
