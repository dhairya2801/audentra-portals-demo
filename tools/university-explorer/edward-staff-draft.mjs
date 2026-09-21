/** Real staff draft and unavailable-mailbox boundary; nothing is sent. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
  extraHTTPHeaders: {
    "x-demo-tenant-id": "00000000-0000-7000-8000-000000000003",
    "x-demo-actor-type": "staff",
    "x-demo-actor-id": "01973261-954a-5019-8e9e-24a699abea7b",
  },
});
const page = await context.newPage();
const out = "artifacts/edward-experience/";
await mkdir(out, { recursive: true });
await writeFile(out + ".gitignore", "*\n");
try {
  await page.goto("http://localhost:3000/staff");
  await page.locator(".edward-launcher").click();
  const panel = page.getByRole("dialog", { name: /Edward/i });
  const field = panel.locator("textarea");
  const ask = async (text) => {
    await field.fill(text);
    const response = page.waitForResponse(
      (r) =>
        r.url().includes("/staff/assistant/messages") &&
        r.request().method() === "POST",
      { timeout: 90000 },
    );
    await field.press("Enter");
    const r = await response;
    assert.equal(r.status(), 200);
    return r.json();
  };
  const summary = await ask(
    "For student d5e3eabd-4bd6-449b-a012-0291406598f1: Why is the aid incomplete?",
  );
  const draft = await ask("Draft a short explanation for them");
  await panel.getByRole("region", { name: "email draft" }).waitFor();
  await page.screenshot({ path: out + "staff-draft.png" });
  assert.ok(draft.blocks.some((b) => b.type === "draft"));
  const prepared = await ask("prepare that");
  assert.equal(prepared.actionError?.code, "EDWARD_EMAIL_MAILBOX_REQUIRED");
  assert.equal(prepared.actionIntents?.length || 0, 0);
  await panel
    .getByText(/need exactly one active mailbox/)
    .first()
    .waitFor();
  await page.screenshot({ path: out + "staff-mailbox-unavailable.png" });
  await writeFile(
    out + "staff-draft-evidence.json",
    JSON.stringify(
      { summary, draft, prepared, noUnsupportedAction: true },
      null,
      2,
    ),
  );
  console.log(
    "Staff draft and honest unavailable-mailbox boundary passed; no fake action control.",
  );
} finally {
  await browser.close();
}
