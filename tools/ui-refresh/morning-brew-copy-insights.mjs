/** Real demo sign-in and UI checks; no student edits or model submissions. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit, expect as baseExpect } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 20000 });
const base = process.env.PORTAL_BASE || 'http://localhost:3027';
const out = process.env.EVIDENCE_DIR || 'artifacts/morning-brew-copy';
const topics = [
  'See where aid stands and what needs attention.',
  'Track applications, admissions, and emerging trends.',
  'Follow deposits, enrollment trends, and next steps.',
  'Follow housing contracts, assignments, and waitlists.',
  'Follow orientation, campus events, and student engagement.',
];
const descriptions = [
  'Get a view of key metrics, what’s changed, and how they’re tracking against your goals.',
  'Follow higher education news and developments that could shape your institution’s priorities.',
  'Get a clear view of today’s meetings, key details, and decisions to prepare for.',
  'See key emails, pending responses, and what needs your attention.',
  'Get a clear view of workflow progress, bottlenecks, and emerging risks to see where your attention is needed.',
  'Explore key findings from your data, their potential impact, and recommended next steps.',
];
const scenarios = [
  ['deposited-aid-delay', '38', '8–11', '$192K–$264K', '94%'],
  ['registration-capacity', '32', '7–10', '$168K–$240K', '91%'],
  ['deposited-disengagement', '54', '9–13', '$216K–$312K', '88%'],
];

await mkdir(out, { recursive: true });
for (const engine of [chromium, webkit].filter(e => !process.env.BROWSER_ENGINE || e.name() === process.env.BROWSER_ENGINE)) {
  const browser = await engine.launch();
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, reducedMotion: 'reduce', ignoreHTTPSErrors: new URL(base).hostname === 'localhost' });
      const page = await context.newPage();
      const errors = [], modelCalls = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => {
        if (r.method() === 'POST' && r.url().includes('/assistant/messages')) modelCalls.push(r.url());
      });
      page.setDefaultTimeout(20000);
      const noOverflow = async () => expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.goto(base + '/staff');
      await page.getByRole('button', { name: /Camila Abernathy/ }).click();
      await expect(page.getByRole('heading', { name: 'Camila, your briefing starts here.' })).toBeVisible();
      await expect(page.getByText('Start your day with a clearer view of the areas you lead. Review your selections and choose what matters most to you.', { exact: true })).toBeVisible();
      for (const text of topics) await expect(page.getByText(text, { exact: true })).toBeVisible();
      await noOverflow();
      await page.screenshot({ path: `${out}/${engine.name()}-${width}-setup.png`, fullPage: true });
      await page.getByRole('button', { name: /Looks good/ }).click();
      const sourceNames = ['Institutional Pulse', 'Higher Ed News', 'Calendar', 'Email', 'Action Center', 'Institutional Intelligence'];
      for (const [i, text] of descriptions.entries()) {
        const source = page.locator('.brew-source-card').filter({ has: page.locator('.brew-source-card__open', { hasText: sourceNames[i] }) });
        if (!(await source.locator('.brew-source-card__blurb').isVisible())) await source.locator('.brew-source-card__open').click();
        await expect(source.getByText(text, { exact: true })).toBeVisible();
      }
      await noOverflow();
      // Preview copies and detail-level samples must not duplicate accessible IDs.
      assert.deepEqual(await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[aria-labelledby]')].flatMap(e => e.getAttribute('aria-labelledby').split(/\s+/));
        return [...new Set(ids)].filter(id => document.querySelectorAll(`[id="${id}"]`).length > 1 && id.startsWith('_'));
      }), []);
      await page.getByRole('button', { name: /Make my Morning Brew/ }).click();
      await expect(page.locator('.brew-hero')).toBeVisible();
      const grid = page.locator('.brew-insight-grid');
      await expect(grid.locator('article')).toHaveCount(3);
      for (const [id, exposure, loss, tuition, confidence] of scenarios) {
        const card = grid.locator(`[data-insight-id="${id}"]`);
        for (const text of [exposure, loss, tuition, confidence]) await expect(card).toContainText(text);
        const disclosure = card.locator('details');
        if (!(await disclosure.evaluate(e => e.open))) await disclosure.locator('summary').click();
        await expect(disclosure).toHaveAttribute('open', '');
        await expect(disclosure.locator('p').first()).toBeVisible();
        await disclosure.locator('summary').click();
        const opener = card.getByRole('button', { name: 'View details', exact: true });
        await opener.click();
        const detail = page.locator('.brew-detail');
        await expect(detail).toContainText(tuition);
        await expect(detail).toContainText('Sample data only; no student records were used for this finding.');
        await expect(detail.getByRole('heading', { name: 'About this example' })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(opener).toBeFocused();
        await card.getByRole('button', { name: /Ask Edward/ }).click();
        const edward = page.locator('#staff-edward-panel');
        await expect(edward).toBeVisible();
        await expect(edward).toContainText('Hi! What would you like to know');
        await edward.getByRole('button', { name: 'Close Edward', exact: true }).click();
      }
      await expect(page.locator('.brew-disclaimer')).toContainText('not live model outputs');
      await noOverflow();
      assert.equal(await grid.locator('article').evaluateAll(cards => cards.some(c => c.scrollWidth > c.clientWidth)), false);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await page.screenshot({ path: `${out}/${engine.name()}-${width}-insights.png`, fullPage: true });
      await page.reload();
      await expect(grid.locator('article')).toHaveCount(3);
      await page.getByRole('button', { name: /Customize .*Morning Brew/ }).click();
      await expect(page.getByRole('heading', { name: 'Camila, your briefing starts here.' })).toBeVisible();
      await page.getByRole('button', { name: /Looks good/ }).click();
      const news = page.locator('.brew-source-card').filter({ hasText: 'Higher Ed News' });
      await news.getByRole('switch').click();
      await page.getByRole('button', { name: /Save it/ }).click();
      await expect(page.locator('.brew-hero')).toBeVisible();
      await expect(page.locator('.brew-news')).toHaveCount(0);
      await page.reload();
      await expect(page.locator('.brew-hero')).toBeVisible();
      await expect(page.locator('.brew-news')).toHaveCount(0);
      await expect(grid.locator('article')).toHaveCount(3);
      assert.deepEqual(modelCalls, [], 'Opening Edward must not submit model work');
      assert.deepEqual(errors, []);
      console.log('PASS', engine.name(), width, 'all 13 copy updates, three forecasts, evidence, detail/focus, Edward, saved source preferences, reload and layout');
      await context.close();
    }
  } finally { await browser.close(); }
}
