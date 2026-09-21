// Read-only reference comparison; mutation checks run only in a fresh local browser context.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import sharp from 'sharp';

const base = process.env.PORTAL_BASE || 'http://localhost:3009';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = 'artifacts/demo-task-board-parity';
await fs.mkdir(output, { recursive: true });
const manifest = JSON.parse(await fs.readFile('apps/web/public/action-center-demo/source-manifest.json', 'utf8'));
for (const [file, hash] of Object.entries(manifest.files)) {
  const bytes = await fs.readFile(`apps/web/public/action-center-demo/${file}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, file);
}

const browser = await chromium.launch();
const errors = [], comparisons = [], boardRequests = [];
try {
  const pages = [];
  for (const [name, origin, person] of [['reference', 'https://test.audentra.ai', 'Vivian Hale'], ['local', base, 'Camila Abernathy']]) {
    const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });
    page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
    if (name === 'local') page.on('request', request => {
      if (request.frame().parentFrame() || /\/v1\/staff\/(work-board|work-items|document-review)/.test(request.url())) {
        if (/\/v1\//.test(request.url())) boardRequests.push(request.url());
      }
    });
    await page.goto(`${origin}/staff#tasks`);
    await page.getByTitle(`Open the staff portal as ${person}`, { exact: true }).click();
    const board = page.frameLocator('#approved-task-board');
    await expect(board.locator('[data-task="ENR-184"]')).toBeVisible({ timeout: 45000 });
    await board.locator('body').evaluate(() => document.fonts.ready);
    pages.push({ page, board, name });
  }
  const [reference, local] = pages;
  const compare = async (name, selector, screenshot = false) => {
    const texts = await Promise.all(pages.map(({ board }) => board.locator(selector).innerText()));
    assert.equal(texts[1], texts[0], `${name}: visible text`);
    const result = { name, textMatches: true };
    if (screenshot) {
      const buffers = [];
      for (const { page, board, name: side } of pages) {
        await page.mouse.move(0, 0);
        buffers.push(await board.locator(selector).screenshot({ path: `${output}/${name}-${side}.png`, animations: 'disabled' }));
      }
      const raw = await Promise.all(buffers.map(buffer => sharp(buffer).raw().toBuffer({ resolveWithObject: true })));
      assert.deepEqual(raw[1].info, raw[0].info, `${name}: dimensions`);
      let changed = 0;
      for (let i = 0; i < raw[0].data.length; i += raw[0].info.channels) {
        if (raw[0].data.subarray(i, i + 3).some((value, channel) => Math.abs(value - raw[1].data[i + channel]) > 8)) changed++;
      }
      result.changedPixelRatio = changed / (raw[0].info.width * raw[0].info.height);
      assert.ok(result.changedPixelRatio < 0.005, `${name}: ${result.changedPixelRatio} pixels differ`);
    }
    comparisons.push(result);
  };
  for (const id of ['en-docs', 'fa-docs', 'fa-outreach', 'fa-payments', 'en-outreach', 'en-requests', 'cl-housing']) {
    for (const { page } of pages) {
      if (id === 'cl-housing') await page.locator('[data-board-space="cl"]').filter({ visible: true }).click();
      await page.locator(`[data-approved-board="${id}"]`).filter({ visible: true }).click();
      await expect(page.locator(`[data-approved-board="${id}"]`).filter({ visible: true })).toHaveAttribute('aria-current', 'page');
    }
    await compare(`${id}-board`, '.main', true);
    const keys = await reference.board.locator('[data-task]').evaluateAll(cards => cards.map(card => card.dataset.task));
    assert.deepEqual(await local.board.locator('[data-task]').evaluateAll(cards => cards.map(card => card.dataset.task)), keys);
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      for (const { board } of pages) await board.locator(`[data-task="${key}"]`).click();
      for (const { page } of pages) await expect.poll(() => page.locator('#approved-task-board').evaluate(frame => frame.getBoundingClientRect().x)).toBe(0);
      const tabs = await reference.board.locator('[data-detail-tab]').evaluateAll(tabs => tabs.map(tab => tab.dataset.detailTab));
      for (const tab of tabs) {
        for (const { board } of pages) await board.locator(`[data-detail-tab="${tab}"]`).click();
        await compare(`${id}-${key}-${tab}`, '#task-dialog', index === 0 || key === 'ENR-184');
      }
      for (const { board } of pages) await board.getByRole('button', { name: 'Close task', exact: true }).click();
    }
    for (const { board } of pages) await board.getByRole('tab', { name: 'List', exact: true }).click();
    await compare(`${id}-list`, '.main', true);
    for (const { board } of pages) await board.getByRole('tab', { name: 'Board', exact: true }).click();
    console.log(`${id}: ${keys.length} cards and all detail tabs match`);
  }

  for (const { page, board } of pages) {
    await page.locator('[data-approved-board="en-docs"]').filter({ visible: true }).click();
    await expect(page.locator('[data-approved-board="en-docs"]').filter({ visible: true })).toHaveAttribute('aria-current', 'page');
    await board.getByRole('textbox', { name: 'Search this board' }).fill('Maya');
  }
  await compare('search', '.main');
  for (const { board } of pages) {
    await board.locator('[data-action="clear-filters"]').click();
    await board.getByLabel('Assignee', { exact: true }).selectOption('ML');
    await board.getByLabel('Priority', { exact: true }).selectOption('High');
  }
  await compare('assignee-priority', '.main');
  for (const { board } of pages) await board.locator('[data-action="clear-filters"]').click();

  for (const { page } of pages) await page.setViewportSize({ width: 390, height: 844 });
  await compare('mobile-board', '.main', true);
  for (const { board } of pages) await board.locator('[data-task="ENR-184"]').click();
  await compare('mobile-document', '#task-dialog', true);
  for (const { board } of pages) await board.getByRole('button', { name: 'Close task', exact: true }).click();

  // Exercise persistence and reset on the local mock only.
  await local.page.setViewportSize({ width: 1512, height: 982 });
  await local.board.locator('[data-task="ENR-184"]').click();
  await local.board.locator('[data-detail-tab="activity"]').click();
  await local.board.locator('[name="comment"]').fill('Local parity verification note');
  await local.board.locator('#comment-form button[type="submit"]').click();
  await expect(local.board.locator('#task-dialog')).toContainText('Local parity verification note');
  await local.page.reload();
  await local.board.locator('[data-task="ENR-184"]').click();
  await local.board.locator('[data-detail-tab="activity"]').click();
  await expect(local.board.locator('#task-dialog')).toContainText('Local parity verification note');
  await local.board.getByRole('button', { name: 'Close task', exact: true }).click();
  await local.board.getByRole('button', { name: 'Reset demo', exact: true }).click();
  await expect(local.board.locator('#action-dialog')).toBeVisible();
  await expect.poll(() => local.page.locator('#approved-task-board').evaluate(frame => frame.getBoundingClientRect().x)).toBe(0);
  await local.board.locator('#action-dialog').getByRole('button', { name: 'Reset demo', exact: true }).click();
  await local.board.locator('[data-task="ENR-184"]').click();
  await local.board.locator('[data-detail-tab="activity"]').click();
  await expect(local.board.locator('#task-dialog')).not.toContainText('Local parity verification note');
  await local.page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await local.board.getByRole('button', { name: 'Copy task link', exact: true }).click();
  const taskLink = await local.page.evaluate(() => navigator.clipboard.readText());
  assert.equal(new URL(taskLink).pathname, '/staff');
  assert.equal(new URL(taskLink).searchParams.get('actionTask'), 'ENR-184');
  await local.page.goto(taskLink);
  await expect(local.board.locator('#task-title')).toHaveText('Review final high school transcript');
  assert.deepEqual(errors, []);
  assert.deepEqual(boardRequests, []);
  await fs.writeFile(`${output}/results.json`, JSON.stringify({ sourceFiles: Object.keys(manifest.files).length, comparisons, localActions: ['comment', 'reload persistence', 'reset', 'copy task link', 'portal deep link'], errors, boardRequests }, null, 2));
  console.log(`${comparisons.length} reference comparisons passed; local persistence/reset passed; no board API requests.`);
} finally {
  await browser.close();
}
