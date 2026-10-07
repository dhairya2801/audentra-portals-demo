/** Read-only regression: real Chrome and Safari's WebKit engine, fresh sessions. */
import assert from 'node:assert/strict';
import {chromium, webkit, devices, expect as baseExpect} from '@playwright/test';

const expect = baseExpect.configure({timeout: 20000});
const base = process.env.PORTAL_BASE || 'https://localhost:3018';
for (const engine of [webkit, chromium]) {
  const browser = await engine.launch(engine === chromium ? {channel: 'chrome'} : {});
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({...(mobile ? devices['iPhone 13'] : {viewport: {width: 1440, height: 1000}}), ignoreHTTPSErrors: new URL(base).hostname === 'localhost'});
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        window.__boardReplies = [];
        window.addEventListener('message', event => {
          if (event.data?.type === 'audentra:board:response') {
            window.__boardReplies.push({parent: event.source === parent, origin: event.origin === location.origin});
          }
        });
      });
      // Exercise the actual demo sign-in UI and an empty preference store.
      await page.goto(base + '/staff');
      await page.getByRole('button', {name: /Camila/}).click();
      await expect(page.getByRole('heading', {name: 'Camila, start your morning with what matters.'})).toBeVisible();
      const frame = page.frameLocator('#approved-task-board');
      const ready = async () => {
        await expect(frame.locator('[data-task]').first()).toBeVisible();
        await expect(page.locator('#approved-task-board')).toBeVisible();
        const replies = await frame.locator('body').evaluate(() => window.__boardReplies);
        assert.ok(replies.length && replies.every(reply => reply.parent && reply.origin), 'Replies must come from the actual parent');
      };
      await page.goto(base + '/staff#tasks');
      await ready();
      const canonical = await (await page.request.get(base + '/v1/staff/demo-task-board')).json();
      await expect(frame.locator('.task-card')).toHaveCount(canonical.cards.filter(card => card.board === 'en-docs').length);
      await frame.locator('#filter-priority').selectOption('High');
      await expect(frame.locator('.task-card')).toHaveCount(canonical.cards.filter(card => card.board === 'en-docs' && card.priority === 'high').length);
      await frame.locator('#filter-priority').selectOption('all');
      const card = frame.locator('[data-task]').first();
      await card.scrollIntoViewIfNeeded();
      const bounds = await card.boundingBox();
      await card.click({position: {x: 20, y: bounds.height - 16}});
      await expect(frame.locator('#task-dialog')).toBeVisible();
      await frame.getByRole('button', {name: 'Close task', exact: true}).click();
      await page.reload();
      await ready();
      // An in-app round trip remounts the bridge without reloading the shell.
      await page.evaluate(() => { location.hash = 'morning_brew'; });
      await expect(page.getByRole('heading', {name: 'Camila, start your morning with what matters.'})).toBeVisible();
      await page.evaluate(() => { location.hash = 'tasks'; });
      await ready();
      // Async errors need the same sender correction as successful API replies.
      await page.route('**/v1/staff/demo-task-board', route => route.fulfill({status: 503, json: {error: {code: 'TEMPORARILY_UNAVAILABLE', message: 'Test unavailable'}}}));
      await page.reload();
      await expect(frame.getByRole('heading', {name: 'Task board unavailable'})).toBeVisible();
      await expect(frame.locator('body')).not.toContainText('The requested data could not load');
      await page.unroute('**/v1/staff/demo-task-board');
      await frame.getByRole('button', {name: 'Retry', exact: true}).click();
      await ready();
      // Verify name projection, not a replacement hardcoded to Camila. This
      // response fixture changes presentation only; it never writes a profile.
      await page.route('**/v1/staff/workspace?projection=navigation', async route => {
        const response = await route.fetch();
        const data = await response.json();
        data.currentStaff.name = 'Jordan Example';
        await route.fulfill({response, json: data});
      });
      await page.goto(base + '/staff#morning_brew');
      await expect(page.getByRole('heading', {name: 'Jordan, start your morning with what matters.'})).toBeVisible();
      assert.deepEqual(errors, []);
      console.log('PASS', engine.name(), mobile ? 'mobile' : 'desktop', 'UI sign-in, actual staff greeting, canonical cards/filter, task detail, reload, navigation, parent sender, error/retry, dynamic name');
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
