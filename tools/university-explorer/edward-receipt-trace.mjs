/** Confirm a reversible profile edit, restore it, and inspect a real semantic trace. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const origin = process.env.UNIVERSITY_PORTAL_URL || "http://localhost:3000";
const out = "artifacts/edward-experience/";
await mkdir(out, { recursive: true });
await writeFile(out + ".gitignore", "*\n");
const browser = await chromium.launch();
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
try {
  await page.goto(origin + "/dashboard");
  const reminder = page.getByRole("button", {
    name: "Remind me later",
    exact: true,
  });
  if (await reminder.isVisible()) await reminder.click();
  await page.locator(".edward-launcher").click();
  const panel = page.getByRole("dialog", { name: /Edward/i });
  const field = panel.locator("textarea");
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
  const change = async (name) => {
    const proposal = await ask("Change my preferred name to " + name);
    assert.ok(proposal.actionIntents.length);
    const preview = panel
      .getByRole("region", { name: "Edward action preview" })
      .last();
    await preview.waitFor();
    const response = page.waitForResponse(
      (r) =>
        r.url().includes("/action-intents/") &&
        r.url().endsWith("/confirm") &&
        r.request().method() === "POST",
    );
    await preview
      .getByRole("button", { name: "Confirm update", exact: true })
      .click();
    const r = await response;
    assert.equal(r.status(), 200);
    const receipt = await r.json();
    assert.equal(receipt.status, "succeeded");
    assert.equal(receipt.affectedCount, 1);
    await panel
      .getByRole("region", { name: "Action receipt" })
      .last()
      .waitFor();
    return receipt;
  };
  const changed = await change("River");
  await page.screenshot({ path: out + "student-receipt.png" });
  const restored = await change("Wren");
  const verified = await ask(
    "What preferred name is currently saved on my profile?",
  );
  assert.match(verified.message, /Wren/);
  const question = "What's my current posted balance? Keep it brief.";
  const answer = await ask(question);
  assert.ok(answer.blocks.some((b) => b.type === "answer"));
  const ready = page.waitForResponse((r) =>
    r.url().includes("/api/edward-lab/traces"),
  );
  await page.goto(origin + "/dev/edward");
  await ready;
  await page
    .getByRole("button", {
      name: new RegExp("What's my current posted balance"),
    })
    .first()
    .click();
  const semantic = page.getByRole("region", {
    name: "Semantic response construction",
  });
  await semantic.waitFor();
  await semantic.getByText("Inspect semantic payload", { exact: true }).click();
  await semantic.scrollIntoViewIfNeeded();
  assert.match(await semantic.innerText(), /answer/);
  await page.screenshot({ path: out + "lab-semantic-trace.png" });
  assert.deepEqual(errors, []);
  await writeFile(
    out + "receipt-trace-evidence.json",
    JSON.stringify(
      { changed, restored, verified, semanticPayloadVisible: true, errors },
      null,
      2,
    ),
  );
  console.log(
    "Confirmed profile receipt, restored original name, and inspected semantic trace.",
  );
} finally {
  await browser.close();
}
