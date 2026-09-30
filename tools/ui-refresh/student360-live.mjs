/** Local demo checks. Temporarily changes Ada's pronouns and restores them in finally. */
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

const base = process.env.PORTAL_BASE || 'http://127.0.0.1:3018';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local demo only');
const browser = await chromium.launch();
const staff = await browser.newContext();
const student = await browser.newContext();
const page = await staff.newPage();
let original;
let updated;
try {
  await page.goto(`${base}/staff`);
  await page.getByRole('button', { name: /Camila Abernathy/ }).click();
  await page.locator('.staff-shell--workspace').waitFor();
  const board = await (await staff.request.get(`${base}/v1/staff/demo-task-board`)).json();
  const documents = board.cards.flatMap(card => card.documents);
  assert.ok(documents.length > 0, 'The demo needs stored document cards');
  for (const document of documents) {
    const response = await staff.request.get(`${base}${document.contentPath}`);
    assert.equal(response.status(), 200, 'Stored demo original must be available');
    assert.match(response.headers()['content-type'], /application\/pdf/);
    assert.ok((await response.body()).subarray(0, 5).equals(Buffer.from('%PDF-')));
  }
  await page.getByRole('button', { name: 'Student 360', exact: true }).filter({ visible: true }).click();
  const shortcut = page.getByRole('button', { name: /Open Ada’s live record/ });
  await expect(shortcut).toBeVisible();
  await shortcut.click();
  await expect(page.getByRole('heading', { name: 'Ada Kettleby', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Student record sections' }).getByRole('button', { name: 'Application', exact: true }).click();
  await page.getByRole('button', { name: 'Application details', exact: true }).click();
  const pronouns = page.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Pronouns$/ }) }).locator('dd');
  const signIn = await student.request.post(`${base}/v1/auth/demo/sign-in-as`, { data: { studentRef: 'SYN-000061' } });
  assert.equal(signIn.status(), 200);
  original = await (await student.request.get(`${base}/v1/student/profile`)).json();
  assert.equal(original.preferredName, 'Ada');
  const marker = original.pronouns === 'she / her' ? 'she / they' : 'she / her';
  const update = await student.request.patch(`${base}/v1/student/profile`, { data: { expectedVersion: original.version, pronouns: marker } });
  assert.equal(update.status(), 200);
  updated = await update.json();
  // No navigation, refresh click or injected event: the open record must update itself.
  await expect(pronouns).toHaveText(marker, { timeout: 25000 });
  await page.getByRole('navigation', { name: 'Student record sections' }).getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Open recommended action →', exact: true }).click();
  const frame = page.frameLocator('#approved-task-board');
  await expect(frame.locator('#task-dialog')).toBeVisible();
  const card = board.cards.find(card => card.documents.length);
  await page.locator('#approved-task-board').evaluate((element, id) => { element.contentWindow.location.hash = id; }, card.id);
  await expect(frame.locator('[data-original-document] canvas').first()).toBeVisible({ timeout: 20000 });
  await expect(frame.getByText('The original file could not be displayed.', { exact: false })).toHaveCount(0);
  console.log(`PASS: ${documents.length} protected PDFs available, PDF canvas rendered, Ada shortcut and live student-to-staff profile update.`);
} finally {
  if (updated) {
    const current = await (await student.request.get(`${base}/v1/student/profile`)).json();
    // Do not undo someone else's concurrent edit.
    assert.equal(current.version, updated.version, 'Concurrent profile change; do not overwrite it');
    const restored = await student.request.patch(`${base}/v1/student/profile`, { data: { expectedVersion: current.version, pronouns: original.pronouns } });
    assert.equal(restored.status(), 200, 'Restore the original pronouns');
  }
  await browser.close();
}
