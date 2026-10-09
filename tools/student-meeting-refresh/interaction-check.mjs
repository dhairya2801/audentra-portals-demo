// Run against the isolated local API; never against a deployed portal.
// STUDENT_SESSION points to a local Playwright storageState file (not committed).
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.STUDENT_PORTAL_URL || 'http://localhost:3012';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use the isolated local portal.');
const out = 'artifacts/student-meeting-refresh';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', storageState: process.env.STUDENT_SESSION || '/tmp/student-refresh-session.json' });
const page = await context.newPage();
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
const check = (name) => { checks.push(name); console.log('PASS', name); };
const shot = name => page.screenshot({ path: `${out}/${name}.png`, fullPage: true, animations: 'disabled' });
try {
  await page.goto(`${base}/enrollment`);
  await page.getByRole('button', { name: /Take a quick tour/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s get started' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Fastest', exact: true }).click();
  await page.getByRole('button', { name: 'Due soon', exact: true }).click();
  await page.getByRole('button', { name: 'Smart order', exact: true }).click();
  await page.getByRole('button', { name: 'How this works', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await shot('enrollment-task-detail');
  await page.keyboard.press('Escape');
  check('Replayable guide, all sort controls, task detail and Escape');

  // Test reward and returned-document UI without writing fictional student records.
  await page.route('**/v1/student/bootstrap', async route => {
    const response = await route.fetch(), data = await response.json();
    data.rewards = { pointName: 'points', pointsPerUsd: 100, lifetimePoints: 650, bookstoreCreditCents: 650 };
    await route.fulfill({ response, json: data });
  });
  await page.route('**/v1/student/requirements', async route => {
    const response = await route.fetch(), data = await response.json();
    data.items = data.items.map((item, i) => ({ ...item, reward: { points: 100, earned: item.status === 'completed' }, ...(i < 3 ? { status: i === 0 ? 'rejected' : 'ready', dueAt: new Date(Date.now()+[7,14,2][i]*86400000).toISOString(), ...(i === 1 ? { title: 'Confirm emergency contact', code: 'emergency_contact', submissionType: 'form' } : i === 2 ? { title: 'Enrollment deposit', submissionType: 'payment' } : {}) } : {}) }));
    await route.fulfill({ response, json: data });
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'How points work' })).toBeVisible();
  await expect(page.locator('.task-return-note')).toBeVisible();
  await page.getByRole('button', { name: 'Fastest', exact: true }).click();
  await expect(page.locator('.task-card h3').first()).toHaveText('Confirm emergency contact');
  await page.getByRole('button', { name: 'Due soon', exact: true }).click();
  await expect(page.locator('.task-card h3').first()).toHaveText('Enrollment deposit');
  await page.getByRole('button', { name: 'Smart order', exact: true }).click();
  await shot('enrollment-rewards-returned-document');
  await page.getByRole('button', { name: 'How points work' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.unroute('**/v1/student/bootstrap');
  await page.unroute('**/v1/student/requirements');
  check('Rewards, bookstore value, due date and returned-document state');

  await page.goto(`${base}/appointments`);
  await page.getByRole('button', { name: 'Find a time' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(page.getByRole('group', { name: 'Available times' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Book this time' })).toBeDisabled();
  await page.getByRole('group', { name: 'Available times' }).getByRole('button').first().click();
  const firstDay = await page.locator('.booking-date-grid [aria-pressed=true]').textContent();
  await page.getByRole('button', { name: 'Next dates' }).click();
  expect(await page.locator('.booking-date-grid [aria-pressed=true]').textContent()).not.toBe(firstDay);
  await expect(page.getByRole('button', { name: 'Book this time' })).toBeDisabled();
  await page.getByRole('button', { name: 'Previous dates' }).click();
  await page.getByRole('group', { name: 'Available times' }).getByRole('button').first().click();
  await dialog.locator('textarea').fill('Local UI verification: enrollment planning');
  await page.getByRole('button', { name: 'Book this time' }).click();
  await expect(dialog.getByRole('heading', { name: /^Booked/ })).toBeVisible();
  await shot('booking-confirmation');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  const row = page.locator('.student-agenda .appointment-row').filter({ hasText: 'Local UI verification' });
  await expect(row).toHaveCount(1);
  await shot('appointments-populated-agenda');
  await row.locator('.row-link').click();
  await expect(dialog.getByRole('link', { name: 'Add to calendar' })).toHaveAttribute('download', 'appointment.ics');
  await shot('appointment-details');
  await dialog.getByRole('button', { name: 'Move to another time' }).click();
  await page.getByRole('group', { name: 'Available times' }).getByRole('button').last().click();
  await page.getByRole('button', { name: 'Move to this time' }).click();
  await expect(dialog.getByRole('heading', { name: /^Moved/ })).toBeVisible();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await row.locator('.row-link').click();
  await dialog.getByRole('button', { name: 'Cancel this conversation' }).click();
  await dialog.getByRole('button', { name: 'Yes, cancel it' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Past & cancelled' }).click();
  await expect(page.locator('.student-agenda')).toContainText('Local UI verification');
  check('Real local booking, pagination, confirmation, calendar, reschedule and cancellation');

  await page.goto(`${base}/financials`);
  let frame = page.frameLocator('iframe');
  await expect(frame.locator('#budget-form')).toBeVisible();
  await frame.locator('.src-row').first().hover();
  await expect(frame.locator('.comparison-ring').first().locator('path.is-highlighted')).toHaveCount(1);
  await frame.locator('.src-row').first().click();
  await expect(frame.getByRole('dialog')).toContainText('A clearer picture of your tuition');
  await shot('financial-charge-detail');
  await page.keyboard.press('Escape');
  const transportRow = frame.locator('.living-expense-entry[data-ring-key="transportCents"]');
  await transportRow.hover();
  await expect(frame.locator('#budget-form path.is-highlighted')).toHaveAttribute('data-ring-key', 'transportCents');
  const transport = frame.getByRole('spinbutton', { name: 'Transportation amount' });
  await transport.click();
  await expect(transportRow.locator('.money-input')).toHaveCSS('border-color', 'rgb(104, 84, 217)');
  await expect(transport).toHaveCSS('outline-style', 'none');
  await transport.fill('100');
  await expect(frame.locator('#budget-form path.is-highlighted')).toHaveAttribute('data-ring-key', 'transportCents');
  await frame.getByRole('combobox', { name: 'Transportation period' }).selectOption('term');
  await expect(transport).toHaveValue('361.4');
  await frame.getByRole('combobox', { name: 'Transportation period' }).selectOption('month');
  await expect(transport).toHaveValue('100');
  await frame.locator('#living-housing').selectOption('off');
  await frame.getByRole('spinbutton', { name: 'Monthly rent amount' }).fill('800');
  await expect(frame.locator('#budget-form .ring')).toContainText('needed each month');
  await frame.locator('#living-housing').selectOption('campus');
  await expect(frame.getByRole('spinbutton', { name: 'Monthly rent amount' })).toHaveCount(0);
  await frame.getByRole('spinbutton', { name: 'Savings on hand amount' }).fill('20000');
  await expect(frame.locator('#budget-form .ring')).toContainText('left over each month');
  await expect(frame.locator('[data-detail="living-surplus"]')).toHaveCount(1);
  check('Chart/list highlight, detailed charges, budget unit math, rent and surplus/shortfall');

  let financialWrites = 0;
  page.on('request', request => { if (/financial-plan|financial-aid|payment/.test(request.url()) && ['POST','PUT','PATCH','DELETE'].includes(request.method())) financialWrites++; });
  await page.goto(`${base}/financials/aid`);
  frame = page.frameLocator('iframe');
  await frame.getByRole('button', { name: 'Choose amount', exact: true }).first().click();
  const amount = frame.getByRole('spinbutton', { name: 'Loan acceptance amount' });
  await amount.fill('999999');
  await frame.getByRole('button', { name: 'Preview acceptance' }).click();
  await expect(amount).toBeVisible();
  expect(await amount.evaluate(el => el.validity.rangeOverflow)).toBe(true);
  await amount.fill('500');
  await frame.getByRole('button', { name: 'Preview acceptance' }).click();
  await expect(frame.getByRole('dialog')).toContainText('$500 selected');
  await shot('loan-partial-acceptance');
  await frame.getByRole('button', { name: 'Back to my offers' }).click();
  await expect(frame.locator('.award-row').filter({ hasText: 'Accepted · preview' })).toContainText('$500');
  await frame.getByRole('button', { name: 'Decline', exact: true }).first().click();
  await frame.getByRole('button', { name: 'Preview decline' }).click();
  await expect(frame.getByRole('dialog')).toContainText('Offer declined in preview');
  await page.keyboard.press('Escape');
  await frame.getByRole('button', { name: /Exploring options with your family/ }).click();
  await expect(frame.getByRole('dialog')).toContainText('parent is the borrower');
  await page.keyboard.press('Escape');
  check('Partial loan amount, validation, accept/decline previews and Parent PLUS detail');

  await page.goto(`${base}/financials/payments`);
  frame = page.frameLocator('iframe');
  await frame.getByRole('button', { name: 'Make a payment' }).click();
  await frame.getByRole('button', { name: 'Preview payment confirmation' }).click();
  await expect(frame.getByRole('dialog')).toContainText('No payment was processed');
  await page.keyboard.press('Escape');
  await frame.getByRole('button', { name: 'Back to my actual plan' }).click();
  await frame.getByRole('button', { name: 'Set up a payment plan' }).click();
  await frame.getByRole('checkbox').check();
  await frame.getByRole('button', { name: 'Preview plan confirmation' }).click();
  await expect(frame.getByRole('dialog')).toContainText('Your plan is ready to review');
  expect(financialWrites).toBe(0);
  check('One-time and installment previews never write financial records');

  await page.route('**/v1/student/financial-plan', async route => {
    const response = await route.fetch(), data = await response.json();
    data.planning.estimatedAccountGapAfterAnticipatedAidCents = -125000;
    await route.fulfill({ response, json: data });
  });
  await page.reload();
  await frame.getByRole('button', { name: 'Choose a refund method' }).click();
  await frame.getByRole('button', { name: 'Preview refund setup' }).click();
  await expect(frame.getByRole('dialog')).toContainText('Refund preference ready');
  await page.keyboard.press('Escape');
  await shot('payments-credit-state');
  await page.unroute('**/v1/student/financial-plan');
  check('Credit/refund state');

  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/enrollment','/appointments','/financials','/financials/aid','/financials/payments']) {
      await page.goto(base+path);
      if (path.startsWith('/financials')) await page.frameLocator('iframe').locator('#tab-root .story').first().waitFor();
      else await page.locator('.page-body').waitFor();
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path} outer overflow at ${width}`).toBe(true);
      if (path.startsWith('/financials')) expect(await page.frameLocator('iframe').locator('html').evaluate(el => el.scrollWidth <= innerWidth + 1), `${path} frame overflow at ${width}`).toBe(true);
      await shot(`${path.split('/').filter(Boolean).join('-')}-${width}`);
    }
  }
  check('390px, 768px and 1280px layouts without horizontal overflow');
  expect(errors).toEqual([]);
  check('No browser runtime errors');
} finally {
  await writeFile(`${out}/interaction-results.json`, JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
