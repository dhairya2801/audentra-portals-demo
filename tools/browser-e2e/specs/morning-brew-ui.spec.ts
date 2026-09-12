import { expect, test } from "@playwright/test";

// Frontend journey over synthetic browser responses. No platform/provider writes.
test("Morning Brew review: setup, previews, cards, email and calendar", async ({
  page,
  baseURL,
}, testInfo) => {
  await page.setViewportSize({ width: 1512, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  const writes: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method()))
      writes.push(new URL(request.url()).pathname);
  });
  await page.route("**/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const cors = {
      "access-control-allow-origin": new URL(baseURL!).origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "*",
    };
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: cors });
    let json = {};
    if (url.pathname === "/v1/tenant/bootstrap")
      json = {
        tenantId: "00000000-0000-7000-8000-000000000001",
        slug: "aster",
        names: {
          displayName: "Aster University",
          shortName: "Aster",
          legalName: "Aster University",
        },
        branding: {
          logoUrl: "",
          logoAlt: "Aster",
          primaryColor: "#1f3b5b",
          secondaryColor: "#eff4f8",
          accentColor: "#c78a2c",
        },
        localization: {
          locale: "en-US",
          timeZone: "America/New_York",
          currencyCode: "USD",
          countryCode: "US",
        },
        academicContext: {
          academicYearLabel: "2025–26",
          currentTermLabel: "Fall 2025",
        },
        contacts: {
          support: {
            label: "Support",
            email: null,
            phone: null,
            hours: null,
            url: null,
          },
        },
        capabilities: {},
        publicLinks: {},
        version: 1,
        updatedAt: "2025-05-20T11:30:00Z",
      };
    else if (url.pathname === "/v1/staff/workspace")
      json = {
        currentStaff: {
          id: "brew-review",
          name: "Vivian Hale",
          email: "vivian.hale@aster.example.edu",
          component: "Enrollment",
          role: "admin",
        },
        inquiries: [],
        cohort: [],
        journeyBlueprint: [],
        knowledgeBase: [],
        corePlays: [],
        portalInventory: [],
        outreachRuns: [],
      };
    else if (url.pathname.includes("assistant/messages"))
      json = {
        message: "Demo response for UI verification.",
        contextReceipts: [],
        conversationId: "demo-conversation",
      };
    else if (url.pathname.includes("events"))
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: ": connected\n\n",
        headers: cors,
      });
    return route.fulfill({ status: 200, json, headers: cors });
  });
  await page.goto(`${baseURL}/staff`);
  await page.locator("#brew-setup-title").waitFor({ timeout: 30000 });

  await page.screenshot({
    path: testInfo.outputPath("setup.png"),
    fullPage: true,
  });

  const timing = page.locator('.brew-setup__timing [role="status"] strong');
  const before = await timing.innerText();
  await page.getByRole("button", { name: /Housing.*The housing/ }).click();
  await expect(timing).not.toHaveText(before);
  await page.getByRole("button", { name: /Housing.*The housing/ }).click();
  await page.getByRole("button", { name: "Looks good" }).click();
  await page.locator(".brew-detail-options").first().waitFor();
  await expect(page.locator("#brew-setup-title")).toHaveText(
    "Nice. What should we bring you?",
  );
  await expect(
    page.locator(".brew-setup .brew-kpi__edward:visible"),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("options.png"),
    fullPage: true,
  });
  await page
    .getByRole("radiogroup", { name: "Institutional Pulse detail level" })
    .getByRole("radio")
    .nth(1)
    .focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page
      .getByRole("radiogroup", { name: "Institutional Pulse detail level" })
      .getByRole("radio")
      .nth(2),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("switch", { name: "Remove Email", exact: true }).click();
  await expect(page.locator(".bp-scale .brew-list--emails")).toHaveCount(0);
  await page.getByRole("switch", { name: "Add Email", exact: true }).click();
  for (const title of [
    "Institutional Pulse",
    "Higher Ed News",
    "Calendar",
    "Email",
    "Action Center",
    "Institutional Intelligence",
  ]) {
    if (
      (await page
        .locator(".brew-source-card__open")
        .filter({ hasText: title })
        .getAttribute("aria-expanded")) !== "true"
    )
      await page
        .locator(".brew-source-card__open")
        .filter({ hasText: title })
        .click();
    const group = page.getByRole("radiogroup", {
      name: `${title} detail level`,
    });
    const choices = group.getByRole("radio");
    if (["Calendar", "Email"].includes(title))
      await expect(choices).toHaveCount(2);
    if (title === "Action Center") {
      await expect(
        group.locator(".brew-priority-flag:visible, .brew-chip:visible"),
      ).toHaveCount(0);
    }
    if (title === "Institutional Intelligence") {
      await expect(choices.nth(1).locator(".brew-insight__cohort")).toHaveCount(
        0,
      );
      await expect(
        choices.nth(2).locator(".brew-insight__cohort li"),
      ).toHaveCount(2);
      for (const sample of await group.locator(".brew-sample").all()) {
        expect((await sample.boundingBox())!.height).toBeLessThan(330);
      }
      await expect(
        group.locator(".brew-insight__stats, .brew-insight__projection"),
      ).toHaveCount(0);
    }
    const gap = await choices.first().evaluate((node) => {
      const description = node
        .querySelector(":scope > p")!
        .getBoundingClientRect();
      const sample = node
        .querySelector(".brew-sample")!
        .getBoundingClientRect();
      return sample.top - description.bottom;
    });
    expect(gap).toBeLessThan(10);
    for (let i = 0; i < (await choices.count()); i++) {
      await choices.nth(i).click();
      await expect(choices.nth(i)).toHaveAttribute("aria-checked", "true");
      if (title === "Institutional Pulse") {
        const liveValue = await page
          .locator(".bp-scale .brew-kpi__value")
          .first()
          .innerText();
        await expect(choices.nth(i).locator(".brew-kpi__value")).toHaveText(
          liveValue,
        );
        await expect(page.locator(".bp-scale .brew-pulse")).toHaveClass(
          new RegExp(`brew-pulse--${["glance", "context", "deep"][i]}`),
        );
      }
    }
    await group.screenshot({
      path: testInfo.outputPath(`preview-${title.replaceAll(" ", "-")}.png`),
    });
  }
  await expect(page.locator(".brew-sample .brew-trend-key")).toHaveCount(0);
  await page.getByRole("button", { name: "Make my Morning Brew" }).click();
  await page.locator(".brew-hero").waitFor();
  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
  });
  const reel = page.locator(".brew-kpi-reel");
  const topics = await reel
    .locator(".brew-kpi")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-topic")),
    );
  const groupRuns = topics.filter(
    (topic, index) => index === 0 || topic !== topics[index - 1],
  );
  expect(groupRuns.length).toBe(new Set(topics).size);
  await expect(
    page.locator(".brew-insight__cohort").first().locator("li"),
  ).toHaveCount(2);
  const firstKpi = reel.locator(".brew-kpi").first();
  const periods = firstKpi.locator(".brew-kpi__ticks button");
  await expect(periods).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    await periods.nth(i).click();
    await expect(periods.nth(i)).toHaveAttribute("aria-pressed", "true");
    await expect(firstKpi.locator(".brew-kpi__primary")).toContainText(
      (await periods.nth(i).getAttribute("aria-label")) || "",
    );
  }
  await periods.first().click();
  await periods.first().blur();
  await page.mouse.move(0, 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(periods.nth(1)).toHaveAttribute("aria-pressed", "true", {
    timeout: 5000,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Next metrics", exact: true }).click();
  await expect
    .poll(() => reel.evaluate((node) => node.scrollLeft))
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Previous metrics", exact: true })
    .click();
  await page.locator(".brew-kpi .brew-stretch").first().click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: testInfo.outputPath("metric.png") });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  for (const name of ["Deposit Paid", "Verification Queue", "Deposit Rate"]) {
    const card = page
      .locator(".brew-kpi")
      .filter({ has: page.getByRole("button", { name, exact: true }) });
    const value = await card.locator(".brew-kpi__value").innerText();
    await card.getByRole("button", { name, exact: true }).click();
    await expect(
      page.locator(".brew-metric-overview > div > strong"),
    ).toHaveText(value.trim());
    await expect(page.locator(".brew-move-list li")).toHaveCount(4);
    if (name === "Deposit Rate")
      await expect(page.locator(".brew-donut")).toHaveCount(0);
    await page.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.locator(".brew-insight .brew-stretch").first().click();
  await page.screenshot({
    path: testInfo.outputPath("insight.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const emails = page
    .locator(".brew-panel")
    .filter({ has: page.getByRole("heading", { name: "Email", exact: true }) });
  for (const category of ["Unread", "Pending response", "Important", "All"])
    await emails.getByRole("tab", { name: new RegExp("^" + category) }).click();
  await emails.locator(".brew-stretch").first().click();
  await page.setViewportSize({ width: 1744, height: 1408 });
  await page.screenshot({ path: testInfo.outputPath("approved-email.png") });
  await expect(page.locator(".brew-detail__title-row")).toContainText(
    "Important",
  );
  await page.getByRole("link", { name: /Open the email in Outlook/ }).click();
  await expect(
    page.getByRole("region", { name: "Demo Outlook preview" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close mock preview" }).click();
  await expect(
    page.getByRole("link", { name: /Open the email in Outlook/ }),
  ).toBeFocused();
  await expect(
    page.getByRole("textbox", { name: "Say what to change" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1512, height: 1000 });
  await page
    .getByRole("textbox", { name: "Draft for you" })
    .fill("Marcus,\n\nLet’s review the reallocation on Friday.\n\nVivian");
  await page.screenshot({ path: testInfo.outputPath("email.png") });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await emails.locator(".brew-stretch").first().click();

  await expect(
    page.getByRole("textbox", { name: "Draft for you" }),
  ).toHaveValue(/Let’s review/);
  await page
    .getByRole("textbox", { name: "Say what to change" })
    .fill("Make the reply more concise");
  await page
    .getByRole("button", { name: "Ask Edward to revise draft" })
    .click();
  await expect(page.locator(".brew-edward__answer")).toContainText(
    "Demo response for UI verification.",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(
    page.getByText("Reply recorded for this demo session. No email was sent."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Scholarship_Reallocation.xlsx/ })
    .click();
  await expect(
    page.getByRole("region", { name: "Sample attachment preview" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Enrollment Leadership Huddle.*Calendar/ })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Your prep sheet" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1744, height: 1408 });
  await page.screenshot({ path: testInfo.outputPath("approved-calendar.png") });
  await page.getByRole("link", { name: /Open the event in Outlook/ }).click();
  await expect(
    page.getByRole("region", { name: "Demo Outlook preview" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close mock preview" }).click();
  await page.getByRole("link", { name: /meet.audentra.example/ }).click();
  await expect(
    page.getByRole("region", { name: "Demo meeting room" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close mock preview" }).click();
  await expect(page.locator(".brew-meeting-summary")).toContainText(
    "Edward Insights",
  );
  await page.getByRole("button", { name: /Show attendee names/ }).click();
  await expect(page.locator(".brew-attendee-roster li").first()).toBeVisible();
  await page.getByRole("button", { name: /Show attendee names/ }).click();
  await page.setViewportSize({ width: 1512, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath("calendar.png") });
  await page
    .getByRole("button", {
      name: "Ask Edward about Enrollment Leadership Huddle",
      exact: true,
    })
    .first()
    .click();
  await expect(page.locator(".brew-edward")).toBeVisible();
  await expect(page.locator(".brew-edward__answer")).toContainText(
    "Enrollment Leadership Huddle",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".brew-detail")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.screenshot({
      path: testInfo.outputPath(`dashboard-${width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.locator(".brew-list--emails .brew-stretch").first().click();
    await page.screenshot({ path: testInfo.outputPath(`email-${width}.png`) });
    await page.getByRole("button", { name: "Close", exact: true }).click();
  }

  await page
    .getByRole("button", { name: "Customize Vivian Hale's Morning Brew" })
    .click();
  await expect(page.locator("#brew-setup-title")).toContainText("Vivian");
  await page.getByRole("button", { name: "Looks good" }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath("setup-mobile.png"),
    fullPage: true,
  });
  const mobileChoices = page
    .locator(".brew-detail-options")
    .first()
    .getByRole("radio");
  const firstChoice = await mobileChoices.nth(0).boundingBox();
  const secondChoice = await mobileChoices.nth(1).boundingBox();
  expect(secondChoice!.y).toBeGreaterThanOrEqual(
    firstChoice!.y + firstChoice!.height,
  );
  expect(firstChoice!.width).toBeGreaterThan(240);
  await page.getByRole("button", { name: "Save it", exact: true }).click();
  await page.locator(".brew-hero").waitFor();
  await page.reload();
  await expect(page.locator(".brew-hero")).toBeVisible();
  expect(errors).toEqual([]);
  expect(writes).toEqual(["/v1/staff/assistant/messages"]);
});
