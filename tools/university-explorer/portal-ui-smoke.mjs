/** Read-only UI regression over the local v3 runtime. No model or publications. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const origin = process.env.UNIVERSITY_PORTAL_URL || 'http://localhost:3000';
const output = new URL('../../artifacts/portal-ui/', import.meta.url);
const browser = await chromium.launch({ headless: true, channel: process.env.CI ? undefined : 'chrome' });
const tenant = '00000000-0000-7000-8000-000000000003';
const student = 'ac2fa509-b4e3-402d-900b-ffb8440fc430';
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  extraHTTPHeaders: { 'x-demo-tenant-id': tenant, 'x-demo-student-id': student, 'x-demo-actor-id': student },
});
const page = await context.newPage();
const errors = [];
const captures = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir(output, { recursive: true });

async function ready() {
  await page.locator('.app-shell, .staff-shell--workspace').first().waitFor();
  await page.locator('h1').first().waitFor();
  await page.waitForFunction(() => ![...document.querySelectorAll('main [role="status"], main h1, main h2, main h3')].some(element => /loading/i.test(element.textContent)));
  const reminder = page.getByRole('button', { name: 'Remind me later', exact: true });
  if (await reminder.isVisible()) await reminder.click();
  await page.evaluate(() => document.fonts.ready);
}
async function capture(name) {
  await ready();
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(250); // Settle the shell's responsive transition.
    await page.screenshot({ path: new URL(`${name}-${viewport.width}.png`, output).pathname, fullPage: true, animations: 'disabled' });
    const size = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
    assert.ok(size.content <= size.width, `${name} overflows at ${size.width}px: ${size.content}px`);
    captures.push({ name, ...size });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log(`${name}: desktop and mobile`);
}

try {
  for (const route of [
    '/dashboard', '/enrollment', '/financials', '/financials/aid', '/payments',
    '/classrooms', '/campus-life', '/campus-life?view=clubs', '/housing', '/health',
    '/documents', '/appointments', '/messages', '/help', '/profile',
    '/profile?section=contact', '/profile?section=access', '/profile?section=origins', '/edward',
  ]) {
    await page.goto(origin + route);
    await capture(`student-${route.slice(1).replaceAll(/[^a-z0-9-]/g, '-')}`);
  }

  // All six sections must stay reachable, including on a narrow screen.
  await page.goto(origin + '/dashboard');
  await ready();
  const record = page.getByRole('region', { name: 'University record', exact: true });
  await record.getByRole('heading', { name: 'My university record', exact: true }).waitFor();
  for (const [tab, heading] of [
    ['Overview', 'Registration holds'], ['Academics', 'Registrations & course history'],
    ['Account', 'Posted account ledger'], ['People & support', 'Your people & offices'],
    ['Documents', 'Documents & review evidence'], ['History', 'University history'],
  ]) {
    await record.getByRole('button', { name: tab, exact: true }).click();
    await record.getByRole('heading', { name: heading, exact: true }).waitFor();
    assert.equal(await record.getByRole('button', { name: tab, exact: true }).getAttribute('aria-pressed'), 'true');
    await capture(`record-${tab.toLowerCase().replaceAll(/[^a-z]/g, '-')}`);
  }
  // A failed section request must not relabel the previous section's data.
  const accountRoute = '**/v1/student/university?domain=account';
  await page.route(accountRoute, route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'AUDIT_FAILURE', message: 'Unavailable' } }) }));
  await record.getByRole('button', { name: 'Account', exact: true }).click();
  await record.getByRole('alert').waitFor();
  assert.equal(await record.getByRole('heading', { name: 'University history', exact: true }).count(), 0);
  await page.unroute(accountRoute);
  await record.getByRole('button', { name: 'Try again', exact: true }).click();
  await record.getByRole('heading', { name: 'Posted account ledger', exact: true }).waitFor();

  await record.getByRole('button', { name: 'Academics', exact: true }).click();
  await record.getByRole('heading', { name: 'Registrations & course history', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileCellsFit = await record.locator('td').evaluateAll(cells => cells.every(cell => {
    const bounds = cell.getBoundingClientRect();
    return cell.dataset.label && bounds.left >= 0 && bounds.right <= innerWidth;
  }));
  assert.ok(mobileCellsFit, 'Mobile record labels and values must fit without horizontal scrolling');
  await page.setViewportSize({ width: 1440, height: 1000 });

  await context.setExtraHTTPHeaders({ 'x-demo-tenant-id': tenant, 'x-demo-actor-type': 'staff', 'x-demo-actor-id': '01973261-954a-5019-8e9e-24a699abea7b' });
  await page.goto(origin + '/staff');
  await page.getByRole('heading', { name: 'My university operations', exact: true }).waitFor();
  await capture('staff-today');
  const sidebar = page.locator('.staff-shell > .staff-sidebar');
  for (const name of ['Morning Brew', 'Action center', 'Task board', 'Students', 'Messages', 'Journeys', 'Campus life', 'Academics', 'Knowledge base', 'Core plays', 'Edward']) {
    await sidebar.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await capture(`staff-${name.toLowerCase().replaceAll(' ', '-')}`);
    if (name === 'Students') {
      const buttons = page.locator('.staff-student-directory__list > button');
      await buttons.nth(1).click();
      const selectedName = await buttons.nth(1).locator('strong').innerText();
      await page.getByRole('heading', { name: `${selectedName} · University record`, exact: true }).waitFor();
      await capture('staff-selected-student');
    }
    if (name === 'Edward') {
      const panel = page.getByRole('region', { name: 'Edward AI staff assistant' });
      assert.equal(await panel.evaluate(element => getComputedStyle(element).position), 'static');
      const contextBounds = await page.locator('.staff-edward-context').boundingBox();
      const chatBounds = await panel.boundingBox();
      assert.ok(chatBounds.x + chatBounds.width <= contextBounds.x, 'Embedded chat must not overlap the context panel');
    }
  }
  await page.getByRole('button', { name: /^Account menu for/ }).click();
  await page.getByRole('menuitem', { name: 'Profile', exact: true }).click();
  await capture('staff-profile');
  for (const [view, action] of [['Knowledge base', 'New knowledge card'], ['Core plays', 'New core play']]) {
    await sidebar.getByRole('button', { name: view, exact: false }).click();
    await page.getByRole('button', { name: action, exact: true }).click();
    await page.getByRole('button', { name: 'Close editor', exact: true }).waitFor();
    await capture(`staff-${view.toLowerCase().replaceAll(' ', '-')}-editor`);
    await page.getByRole('button', { name: 'Close editor', exact: true }).click();
  }
  assert.deepEqual(errors, [], 'No browser exceptions');
  await writeFile(new URL('report.json', output), JSON.stringify({ captures, errors }, null, 2));
  console.log(`Passed ${captures.length} viewport captures and university record interactions.`);
} finally {
  await browser.close();
}
