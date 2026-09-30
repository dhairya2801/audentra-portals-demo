/** Read-only UI journey against the local synthetic demo platform. */
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.PORTAL_BASE || 'http://127.0.0.1:3018';
const output = process.env.STUDENT360_SCREENSHOTS; // Optional; never capture document contents.
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const shot = async name => { if (output) { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300); await fs.mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/${name}.png`, fullPage: true }); } };
const noOverflow = async () => expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth > innerWidth), { message: 'Page overflows horizontally' }).toBe(false);
const tab = name => page.getByRole('navigation', { name: 'Student record sections' }).getByRole('button', { name, exact: true });
try {
  await page.goto(`${base}/staff`);
  await page.getByRole('button', { name: /Camila Abernathy/ }).click();
  await page.locator('.staff-shell--workspace').waitFor();
  await page.getByRole('button', { name: 'Student 360', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: 'Enrollment overview' })).toBeVisible();
  const table = page.getByRole('region', { name: 'Student directory' });
  await expect(table.locator('tbody tr').first()).toBeVisible();
  const firstName = await table.locator('tbody tr').first().getByRole('button').first().innerText();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(table.locator('tbody tr').first().getByRole('button').first()).not.toHaveText(firstName);
  await page.getByRole('button', { name: 'Previous page', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select students on this page' }).check();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export \(7\)/ }).click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'student-360-current-view.csv');
  const csv = await fs.readFile(await download.path(), 'utf8');
  assert.equal(csv.split('\r\n').length, 8);
  assert.ok(csv.includes('mock preview'));
  await page.getByRole('checkbox', { name: 'Select students on this page' }).uncheck();
  const riskResponse = page.waitForResponse(response => response.url().includes('/v1/staff/students?') && new URL(response.url()).searchParams.get('view') === 'risk' && response.ok());
  await page.getByRole('button', { name: /^High risk / }).click();
  await riskResponse;
  await expect(table).toHaveAttribute('aria-busy', 'false');
  for (const row of await table.locator('tbody tr').all()) assert.match(await row.innerText(), /Critical|High/);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await shot('directory-desktop');
  await noOverflow();
  await page.getByPlaceholder('Search by student, ID, or program').fill('no-such-student-360');
  await expect(page.getByRole('heading', { name: 'No students match this view' })).toBeVisible();
  await page.getByPlaceholder('Search by student, ID, or program').fill('SYN-000061');
  await table.getByRole('button', { name: /Ada Kettleby/ }).click();
  await expect(page.getByRole('heading', { name: 'Ada Kettleby', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Ada’s path to enrollment/ })).toBeVisible();
  await shot('overview-desktop');
  await tab('Application').click();
  for (const name of ['Overview', 'Application details', 'Education history', 'Application requirements', 'Program alignment', 'Application journey']) {
    const button = page.getByRole('navigation', { name: 'Application sections', exact: true }).getByRole('button', { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-current', 'page');
    await noOverflow();
  }
  for (const name of ['Enrollment', 'Financials', 'Academics', 'Campus Life', 'Timeline', 'Comments', 'Messages', 'Documents']) {
    await tab(name).click();
    await expect(page.getByRole('region', { name: `${name} content`, exact: true })).toBeVisible();
    await noOverflow();
  }
  // Open protected originals without saving source content or a screenshot.
  const preview = page.getByRole('button', { name: 'Preview', exact: true }).first();
  if (await preview.count()) {
    await preview.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(preview).toBeFocused();
  }
  await tab('Application').click();
  await shot('application-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await shot('application-mobile');
  await tab('Overview').click();
  await noOverflow();
  await shot('overview-mobile');
  await page.getByRole('button', { name: 'Back to all students' }).click();
  await expect(page.getByPlaceholder('Search by student, ID, or program')).toHaveValue('SYN-000061');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await noOverflow();
  await shot('directory-mobile');
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole('button', { name: /Morning Brew/, exact: false }).filter({ visible: true }).first().click();
  for (let step = 0; step < 3; step++) {
    await page.waitForTimeout(500);
    const setup = page.locator('.brew-setup');
    if (!(await setup.count())) break;
    const next = page.getByRole('button', { name: /Looks good|Make my Morning Brew/ }).filter({ visible: true }).first();
    await next.click();
  }
  await expect(page.locator('.brew-hero')).toBeVisible();
  const hero = await page.locator('.brew-hero').evaluate(element => getComputedStyle(element).backgroundImage);
  assert.ok(hero.includes('linear-gradient'));
  await expect(page.locator('.brew-hero__coffee')).toBeVisible();
  assert.ok(await page.locator('.brew-hero__coffee').evaluate(element => getComputedStyle(element).backgroundImage.includes('coffee-brew.png')));
  await noOverflow();
  await shot('morning-brew-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await shot('morning-brew-mobile');
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole('button', { name: 'Student 360', exact: true }).filter({ visible: true }).click();
  await page.getByPlaceholder('Search by student, ID, or program').fill('SYN-000061');
  await page.getByRole('button', { name: /Ada Kettleby/ }).click();
  await page.getByRole('button', { name: 'Open recommended action →', exact: true }).click();
  await expect(page.frameLocator('#approved-task-board').locator('#task-dialog')).toBeVisible();
  assert.deepEqual(errors, []);
  console.log('PASS: directory search/filter/paging/export, all student tabs, source dialog, mobile layouts, Morning Brew, and exact task handoff.');
} finally { await browser.close(); }
