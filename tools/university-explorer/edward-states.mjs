/** Confirmation, cancellation, stop/retry and Lab with real API state. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const origin = process.env.UNIVERSITY_PORTAL_URL || "http://localhost:3000";
const output = new URL("../../artifacts/edward-experience/", import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL(".gitignore", output), "*\n");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
  extraHTTPHeaders: {
    "x-demo-tenant-id": "00000000-0000-7000-8000-000000000003",
    "x-demo-student-id": "ac2fa509-b4e3-402d-900b-ffb8440fc430",
    "x-demo-actor-id": "ac2fa509-b4e3-402d-900b-ffb8440fc430",
  },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const evidence = [];
try {
  await page.goto(origin + "/dashboard");
  const reminder = page.getByRole("button", {
    name: "Remind me later",
    exact: true,
  });
  if (await reminder.isVisible()) await reminder.click();
  await page.locator(".edward-launcher").click();
  const panel = page.getByRole("dialog", { name: /Edward/i });
  const field = panel.locator("textarea").first();
  const ask = async (message) => {
    await field.fill(message);
    const response = page.waitForResponse(
      (r) =>
        r.url().includes("/assistant/messages") &&
        r.request().method() === "POST",
      { timeout: 90000 },
    );
    await field.press("Enter");
    const r = await response;
    assert.equal(r.status(), 200);
    return r.json();
  };
  await ask("Change my preferred name to River");
  const preview = panel.getByRole("region", { name: "Edward action preview" });
  await preview.waitFor();
  await page.screenshot({
    path: new URL("student-confirmation.png", output).pathname,
  });
  await preview.getByRole("button", { name: "Cancel", exact: true }).click();
  await panel.getByRole("region", { name: "Cancelled action" }).waitFor();
  evidence.push("Student preview and cancellation");
  await page.screenshot({
    path: new URL("student-cancelled.png", output).pathname,
  });
  // A distinct conversation avoids pending-action continuation influencing the read.
  await panel.getByRole("button", { name: /New conversation/i }).click();
  await field.fill(
    "What is the difference between my degree requirements and my enrolled classes?",
  );
  const sent = page.waitForRequest(
    (r) => r.url().includes("/assistant/messages") && r.method() === "POST",
  );
  await field.press("Enter");
  const req = await sent;
  const id = req.postDataJSON().clientMessageId;
  await panel
    .getByRole("button", { name: "Stop waiting", exact: true })
    .click();
  await panel
    .getByRole("alert")
    .filter({ hasText: "Stopped waiting" })
    .waitFor();
  await page.screenshot({
    path: new URL("student-stopped.png", output).pathname,
  });
  // Stop aborts the browser wait, not the server. Allow the bounded real request to finish.
  await page.waitForTimeout(18000);
  const retried = page.waitForRequest(
    (r) => r.url().includes("/assistant/messages") && r.method() === "POST",
  );
  const returned = page.waitForResponse(
    (r) =>
      r.url().includes("/assistant/messages") &&
      r.request().method() === "POST",
    { timeout: 90000 },
  );
  await panel.getByRole("button", { name: "Try again", exact: true }).click();
  assert.equal((await retried).postDataJSON().clientMessageId, id);
  assert.equal((await returned).status(), 200);
  await panel.getByRole("alert").waitFor({ state: "hidden" });
  evidence.push("Stop and idempotent retry reused clientMessageId");
  await page.screenshot({
    path: new URL("student-retried.png", output).pathname,
  });
  const labReady = page.waitForResponse((r) =>
    r.url().includes("/api/edward-lab/traces"),
  );
  await page.goto(origin + "/dev/edward");
  await labReady;
  await page.getByRole("tab", { name: "Architecture", exact: true }).click();
  await page
    .getByRole("region", { name: "University evidence architecture" })
    .waitFor();
  assert.match(
    await page.locator("body").innerText(),
    /semantic response projection/,
  );
  await page.screenshot({
    path: new URL("lab-architecture.png", output).pathname,
    fullPage: true,
  });
  evidence.push("Lab shows real university architecture");
  assert.deepEqual(errors, []);
  await writeFile(
    new URL("states-evidence.json", output),
    JSON.stringify({ evidence, errors }, null, 2),
  );
  console.log(evidence);
} finally {
  await browser.close();
}
