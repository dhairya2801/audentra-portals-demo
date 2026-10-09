// Read-only checks for alternate task-board views and Student 360 sections.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.STAFF_BASE_URL ?? 'http://localhost:3012';
const output = 'artifacts/staff-responsive/workspaces';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const results = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${base}/staff`);
  await page.getByTitle('Open the staff portal as Camila Abernathy', { exact: true }).click();
  await page.getByRole('button', { name: 'Looks good', exact: true }).click();
  await page.getByRole('button', { name: 'Make my Morning Brew', exact: true }).click();
  await page.locator('.brew-hero').waitFor();
  await page.goto(`${base}/staff#tasks`);
  await page.getByRole('button', { name: 'For You 3 views' }).last().click();
  const frame = page.frames().find(frame => frame.url().includes('action-center-demo'));
  for (const [width, height] of [[320,740], [390,844], [768,1024], [1024,768], [1440,900], [2560,1440], [3440,1440], [844,390]]) {
    await page.setViewportSize({ width, height });
    for (const version of ['board', 'focus', 'portfolio']) {
      await frame.locator(`[data-version=${version}]`).click();
      const geometry = await frame.locator('#task-summary').evaluate(e => ({ width: e.clientWidth, scroll: e.scrollWidth }));
      assert.ok(geometry.scroll <= geometry.width + 1, `For You ${version}/${width}: ${JSON.stringify(geometry)}`);
      results.push({ version, width });
    }
    await page.screenshot({ path: `${output}/for-you-${width}.png` });
  }
  for (const [width, height] of [[320,740], [768,1024], [1440,900], [2560,1440]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${base}/staff#students`);
    await page.getByRole('button', { name: /Open Ada.s live record/ }).click();
    const navigation = page.getByRole('navigation', { name: 'Student record sections' });
    await navigation.waitFor();
    for (const name of await navigation.locator('button').allTextContents()) {
      await navigation.getByRole('button', { name, exact: true }).click();
      await expect(page.getByRole('region', { name: `${name} content`, exact: true })).toBeVisible();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Student record ${name}/${width}`);
      results.push({ record: name, width });
    }
    await page.goto(`${base}/staff#edward`);
    await expect(page.getByRole('textbox', { name: 'Ask about students, tasks, or the workspace' })).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Edward workspace/${width}`);
    results.push({ workspace: 'Edward', width });
    if (width <= 1024) {
      await page.getByRole('button', { name: 'Toggle navigation' }).click();
      await expect(page.getByRole('dialog', { name: 'Staff navigation' })).toBeVisible();
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(page.getByRole('dialog', { name: 'Staff navigation' })).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/results.json`, JSON.stringify({ results, errors }, null, 2));
  console.log(`PASS ${results.length} alternate workspace and record checks`);
} finally { await browser.close(); }
