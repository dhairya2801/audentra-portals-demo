// Read-only responsive checks against the configured disposable demo.
// Usage: STAFF_BASE_URL=http://localhost:3012 STAFF_BROWSER=chromium node tools/staff-responsive/check.mjs
import { chromium, firefox, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.STAFF_BASE_URL ?? 'http://localhost:3012';
const engine = process.env.STAFF_BROWSER ?? 'chromium';
const output = `artifacts/staff-responsive/${engine}`;
await mkdir(output, { recursive: true });
const browser = await ({ chromium, firefox }[engine]).launch(engine === 'chromium' ? { channel: 'chrome' } : {});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await context.newPage(), errors = [], results = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${base}/staff`);
  await page.getByTitle('Open the staff portal as Camila Abernathy', { exact: true }).click();
  await page.getByRole('button', { name: 'Looks good', exact: true }).click();
  await page.getByRole('button', { name: 'Make my Morning Brew', exact: true }).click();
  await page.locator('.brew-hero').waitFor();
  const views = ['morning_brew', 'tasks', 'students', 'outreach', 'overview', 'messages', 'journeys', 'campus_life', 'academics', 'knowledge', 'core_plays', 'profile'];
  const sizes = [[320,740], [360,800], [390,844], [430,932], [600,900], [680,900], [681,900], [768,1024], [900,900], [1024,768], [1025,768], [1280,800], [1440,900], [1920,1080], [2560,1440], [3440,1440], [844,390]];
  async function geometry(scope, label) {
    const result = await scope.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(result.scroll <= result.width + 2, `${label}: page overflow ${JSON.stringify(result)}`);
    return result;
  }
  for (const view of process.env.STAFF_PHASE === "interactions" ? [] : views) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}/staff#${view}`);
    await page.locator('.staff-main--workspace').waitFor();
    await page.waitForTimeout(1300);
    if (view === 'tasks') await page.frameLocator('#approved-task-board').locator('.board-heading').waitFor();
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(100);
      await expect(page.locator('#staff-global-search')).toBeVisible();
      await expect(page.locator('.staff-notification-trigger')).toBeVisible();
      await expect(page.locator('.edward-launcher .edward-mark.small')).toBeVisible();
      if (width <= 1024) await expect(page.getByRole('button', { name: 'Toggle navigation' })).toBeVisible();
      const result = await geometry(page, `${view}/${width}`);
      const header = await page.locator('.staff-topbar').boundingBox();
      for (const selector of ['.staff-global-search', '.staff-topbar__actions', '.staff-brand']) {
        const box = await page.locator(selector).boundingBox();
        assert.ok(box.x >= -1 && box.x + box.width <= width + 1, `${selector} outside header at ${width}`);
      }
      if (view === 'tasks') {
        const frame = page.frames().find(frame => frame.url().includes('action-center-'));
        await geometry(frame, `board/${width}`);
        const box = await page.locator('#approved-task-board').boundingBox();
        assert.ok(Math.abs(box.y - header.height) < 2, `Board overlaps header at ${width}`);
        const workflow = await frame.locator('[data-action="board-workflow"]').evaluate(e => ({ width: e.clientWidth, scroll: e.scrollWidth }));
        assert.ok(workflow.scroll <= workflow.width + 2, `Workflow action clipped at ${width}`);
      }
      results.push({ view, width, height, ...result });
      if ([320, 768, 1024, 2560].includes(width)) await page.screenshot({ path: `${output}/${view}-${width}.png` });
    }
    console.log(`PASS ${engine}: ${view}, ${sizes.length} sizes`);
  }
  // Keyboard behavior and interactions: never publish, reset, send, or modify a task.
  for (const [width, height] of [[320,740], [390,844], [768,1024], [1024,768], [1440,900], [2560,1440], [844,390]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${base}/staff#morning_brew`);
    await page.locator('.brew-hero').waitFor();
    if (width <= 1024) {
      await page.getByRole('button', { name: 'Toggle navigation' }).click();
      const nav = page.getByRole('dialog', { name: 'Staff navigation' });
      await expect(nav).toBeVisible();
      await page.keyboard.press('Shift+Tab');
      assert.ok(await nav.evaluate(e => e.contains(document.activeElement)), 'Navigation focus escaped');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Toggle navigation' })).toBeFocused();
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
    }
    await page.locator('.staff-notification-trigger').click();
    await expect(page.locator('.staff-notification-popover')).toBeVisible();
    await page.getByRole('button', { name: 'Close notifications' }).click();
    await page.getByRole('button', { name: 'Reset demo', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.locator('.edward-launcher').click();
    await expect(page.locator('#staff-edward-panel')).toBeVisible();
    await geometry(page, `Edward/${width}`);
    await page.getByRole('button', { name: 'Close Edward' }).click();
    for (const selector of ['.brew-glance', '.brew-insight .brew-stretch', '.brew-kpi .brew-stretch']) {
      const opener = page.locator(selector).first();
      if (!await opener.count()) continue;
      await opener.click();
      await expect(page.locator('.brew-detail')).toBeVisible();
      await geometry(page, `Brew detail/${width}`);
      await page.locator('.brew-detail').getByRole('button', { name: 'Close', exact: true }).click();
    }
    for (const [view, name] of [['knowledge','New knowledge card'], ['core_plays','New core play'], ['campus_life','Add event'], ['academics',/^Edit [A-Z]+ [0-9]/]]) {
      await page.goto(`${base}/staff#${view}`);
      await page.getByRole('button', { name, exact: typeof name === 'string' }).first().click();
      const editor = page.locator('.staff-editor-panel');
      await expect(editor).toBeVisible();
      const box = await editor.boundingBox();
      assert.ok(box.x >= -1 && box.x + box.width <= width + 1, `Editor outside viewport: ${view}/${width}`);
      assert.equal(await editor.evaluate(e => e.scrollWidth > e.clientWidth + 1), false, `Editor overflow: ${view}/${width}`);
      await page.getByRole('button', { name: 'Close editor', exact: true }).click();
    }
    await page.goto(`${base}/staff#students`);
    await page.getByRole('button', { name: /Open Ada.s live record/ }).click();
    await page.getByRole('heading', { name: 'Ada Kettleby', exact: true }).waitFor();
    await geometry(page, `Student record/${width}`);
    await page.screenshot({ path: `${output}/student-record-${width}.png` });
    results.push({ interactions: true, width, height });
    console.log(`PASS ${engine}: interactions at ${width}×${height}`);
  }
  assert.deepEqual(errors, [], 'Browser runtime errors');
  await writeFile(`${output}/results.json`, JSON.stringify({ results, errors }, null, 2));
  console.log(`PASS ${engine}: ${results.length} checks`);
} finally { await browser.close(); }
