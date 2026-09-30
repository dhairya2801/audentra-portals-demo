/** Read-only regression for a directory larger than the former 200-student cap. */
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

const base = process.env.PORTAL_BASE || 'http://127.0.0.1:3018';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${base}/staff`);
  await page.getByRole('button', { name: /Camila Abernathy/ }).click();
  await page.locator('.staff-shell--workspace').waitFor();
  await page.getByRole('button', { name: 'Student 360', exact: true }).filter({ visible: true }).click();
  const table = page.getByRole('region', { name: 'Student directory' });
  const rows = table.locator('tbody tr');
  await expect(rows.first()).toContainText('SYN-000061');
  await expect(rows).toHaveCount(7);
  for (const row of await rows.all()) {
    await expect(row.getByRole('cell').nth(3)).toContainText(/[1-9][0-9]*%/);
    await expect(row).not.toContainText('0/0 milestones');
  }
  const readiness = page.getByText('Enrollment readiness', { exact: true }).locator('..');
  const totals = await readiness.textContent();
  await page.getByRole('spinbutton', { name: 'Page number' }).fill('31');
  const later = page.waitForResponse(r => r.url().includes('/v1/staff/students?') && new URL(r.url()).searchParams.get('offset') === '210' && r.ok());
  await page.getByRole('button', { name: 'Go to page', exact: true }).click();
  const laterData = await (await later).json();
  assert.equal(laterData.offset, 210);
  assert.ok(laterData.total > 200);
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('31');
  await expect(rows.first()).toContainText(laterData.items[0].externalRef);
  await expect(readiness).toHaveText(totals);
  const search = page.getByPlaceholder('Search by student, ID, or program');
  const matching = page.waitForResponse(r => r.url().includes('/v1/staff/students?') && new URL(r.url()).searchParams.get('query') === 'Ada' && r.ok());
  void matching.catch(() => {});
  await search.fill('Ada');
  const matchingData = await (await matching).json();
  assert.equal(matchingData.offset, 0);
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('1');
  await expect(rows.first()).toContainText('SYN-000061');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(rows.first()).toContainText('SYN-000061');
  await expect(page.getByRole('combobox', { name: 'Sort', exact: true })).toHaveValue('recommended');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  assert.deepEqual(errors, []);
  console.log('PASS: rich first page includes Ada, page 31 loads canonical students, cohort summaries stay stable, search resets paging, clear restores Ada, mobile has no overflow.');
} finally { await browser.close(); }
