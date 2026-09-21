/** Real PostgreSQL + metered OpenAI responses. Requires experience/serve.py. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const origin = process.env.UNIVERSITY_PORTAL_URL || "http://localhost:3000";
const output = new URL("../../artifacts/edward-experience/", import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL(".gitignore", output), "*\n");
const browser = await chromium.launch({ headless: true });
const evidence = [];
const axeModule = process.env.EDWARD_AXE_MODULE;
const AxeBuilder = axeModule ? (await import(axeModule)).default : null;
try {
  for (const role of ["student", "staff"])
    for (const mobile of [false, true]) {
      const context = await browser.newContext({
        viewport: mobile
          ? { width: 390, height: 844 }
          : { width: 1440, height: 1000 },
        reducedMotion: "reduce",
        extraHTTPHeaders: {
          "x-demo-tenant-id": "00000000-0000-7000-8000-000000000003",
          "x-demo-student-id": "d5e3eabd-4bd6-449b-a012-0291406598f1",
          "x-demo-actor-type": role,
          "x-demo-actor-id":
            role === "staff"
              ? "01973261-954a-5019-8e9e-24a699abea7b"
              : "d5e3eabd-4bd6-449b-a012-0291406598f1",
        },
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(origin + (role === "staff" ? "/staff" : "/dashboard"));
      const reminder = page.getByRole("button", {
        name: "Remind me later",
        exact: true,
      });
      if (await reminder.isVisible()) await reminder.click();
      await page.locator(".edward-launcher").click({ timeout: 30000 });
      const panel = page.getByRole("dialog", { name: /Edward/i });
      await panel.waitFor();
      const name = role + (mobile ? "-mobile" : "-desktop");
      await page.screenshot({
        path: new URL(name + "-empty.png", output).pathname,
      });
      const field = panel.locator("textarea").first();
      await field.fill(
        role === "student"
          ? "Why is my financial aid incomplete? What do I need to do?"
          : "For student d5e3eabd-4bd6-449b-a012-0291406598f1: What's blocking this student and who owns the next step?",
      );
      const responsePromise = page.waitForResponse(
        (r) =>
          r.url().includes("/assistant/messages") &&
          r.request().method() === "POST",
        { timeout: 90000 },
      );
      await field.press("Enter");
      const response = await responsePromise;
      assert.equal(response.status(), 200);
      const body = await response.json();
      await writeFile(
        new URL(name + "-response.json", output),
        JSON.stringify(
          { body, requestId: response.headers()["x-request-id"] },
          null,
          2,
        ),
      );
      await panel
        .getByText(
          body.blocks.find((b) => b.type === "answer")?.text || body.message,
          { exact: true },
        )
        .first()
        .waitFor();
      await page.screenshot({
        path: new URL(name + "-answer.png", output).pathname,
      });
      console.log(name + " received real response");
      const accessibility = AxeBuilder
        ? await new AxeBuilder({ page })
            .include("[role=dialog]")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        : null;
      if (accessibility)
        await writeFile(
          new URL(name + "-axe.json", output),
          JSON.stringify(accessibility.violations, null, 2),
        );
      const geometry = await panel.evaluate((el) => {
        const p = el.getBoundingClientRect();
        const a = el
          .querySelector(
            '[class*="answer_"], .assistant-block--text, .assistant-block-text',
          )
          ?.getBoundingClientRect();
        return {
          x: p.x,
          y: p.y,
          w: p.width,
          h: p.height,
          overflow: el.scrollWidth > el.clientWidth + 1,
          answerVisible: !!a && a.y >= p.y && a.y + a.height <= p.bottom,
        };
      });
      assert.equal(geometry.overflow, false, "no horizontal overflow");
      assert.ok(geometry.x >= 0 && geometry.y >= 0);
      assert.ok(geometry.answerVisible, "primary answer remains visible");
      if (mobile) assert.equal(await panel.getAttribute("aria-modal"), "true");
      const source = panel
        .locator("summary")
        .filter({ hasText: /Polic|source/i })
        .first();
      if (await source.count()) {
        await source.click();
        await page.screenshot({
          path: new URL(name + "-sources.png", output).pathname,
        });
      }
      await field.focus();
      await field.press("Escape");
      await panel.waitFor({ state: "hidden" });
      assert.equal(
        await page
          .locator(".edward-launcher")
          .evaluate((el) => document.activeElement === el),
        true,
        "focus restored to launcher",
      );
      await page.locator(".edward-launcher").click();
      await panel
        .getByText(
          body.blocks.find((b) => b.type === "answer")?.text || body.message,
          { exact: true },
        )
        .first()
        .waitFor();
      assert.deepEqual(errors, []);
      evidence.push({
        role,
        mobile,
        geometry,
        status: response.status(),
        traceId: body.traceId,
        blockTypes: body.blocks.map((b) => b.type),
        accessibilityViolations: accessibility?.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
        })),
        errors,
      });
      await context.close();
    }
  await writeFile(
    new URL("browser-evidence.json", output),
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
