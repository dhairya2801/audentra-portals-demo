import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Run against the existing local platform; changes only this browser's preferences.
const output = 'artifacts/morning-brew-card-refresh';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const sizes = [390, 820, 1440, 2560];
const levels = ['glance', 'context', 'deep'];
const cards = () => page.locator('.brew-insights .brew-insight');
const dialog = () => page.locator('.brew-detail--intelligence');
const noOverflow = async locator => {
  expect(await locator.evaluateAll(nodes => nodes.filter(node => node.scrollWidth > node.clientWidth + 2).map(node => node.className))).toEqual([]);
};

try {
  await page.goto(`${process.env.PORTAL_URL || 'http://localhost:3012'}/staff`);
  await page.getByRole('button', { name: /Camila/ }).click();
  await page.getByRole('button', { name: 'Looks good', exact: true }).click();
  for (const [index, level] of levels.entries()) {
    if (index) {
      await page.getByRole('button', { name: 'Change what’s in it', exact: true }).click();
      await page.getByRole('button', { name: 'Looks good', exact: true }).click();
    }
    await page.locator('.brew-source-card__open').filter({ hasText: 'Institutional Intelligence' }).click();
    const options = page.getByRole('radiogroup', { name: 'Institutional Intelligence detail level' });
    await options.getByRole('radio').nth(index).click();
    await expect(options.getByRole('radio').nth(index)).toHaveAttribute('aria-checked', 'true');
    // Page-two live preview must react immediately, before preferences are saved.
    await expect(page.locator('.brew-preview .brew-insight').first()).toHaveAttribute('data-level', level);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1100 });
      await noOverflow(page.locator('.brew-sample--intelligence .brew-insight'));
      await noOverflow(page.locator('.brew-preview .brew-insight'));
    }
    if (level === 'context') {
      await options.screenshot({ path: `${output}/onboarding-options.png` });
      await page.locator('.brew-preview .brew-insights').screenshot({ path: `${output}/onboarding-live.png` });
    }
    await page.getByRole('button', { name: index ? 'Save it' : /Make my Morning Brew/, exact: Boolean(index) }).click();
    await expect(cards()).toHaveCount(3);
    await expect(cards().first()).toHaveAttribute('data-level', level);
    await expect(cards().first().locator('dt')).toContainText(level === 'glance'
      ? ['Tuition Impact', 'Enrolled Students']
      : ['Commuter Deposits', 'Tuition Impact', 'Enrolled Students']);
    for (const width of sizes) {
      await page.setViewportSize({ width, height: 1100 });
      await noOverflow(cards());
      expect(await cards().evaluateAll(nodes => nodes.every(node => {
        const summary = node.querySelector(':scope > p');
        return Math.abs(summary.nextElementSibling.getBoundingClientRect().top - summary.getBoundingClientRect().bottom - 8) < 1;
      }))).toBe(true);
      await noOverflow(page.locator('html'));
      await page.mouse.move(0, 0);
      await page.locator('.brew-insights').screenshot({ path: `${output}/${level}-${width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    const first = cards().first();
    const evidence = first.getByRole('button', { name: 'Why am I seeing this?' });
    await evidence.click();
    await expect(evidence).toHaveAttribute('aria-expanded', 'true');
    await expect(first.getByText(/Underlying signal/)).toBeVisible();
    await expect(dialog()).toHaveCount(0);
    await evidence.click();
    if (level !== 'glance') {
      const why = first.getByRole('button', { name: 'Why it matters' });
      const tooltip = first.getByRole('tooltip');
      const originalHeight = (await first.boundingBox()).height;
      await why.hover();
      await expect(tooltip).toBeVisible();
      expect((await first.boundingBox()).height).toBe(originalHeight);
      await tooltip.hover();
      await expect(tooltip).toBeVisible();
      await first.screenshot({ path: `${output}/${level}-why-tooltip.png` });
      await page.mouse.move(0, 0);
      await expect(tooltip).toBeHidden();
      await why.focus();
      await expect(tooltip).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(tooltip).toBeHidden();
      await page.keyboard.press('Enter');
      await expect(tooltip).toBeVisible();
      await expect(dialog()).toHaveCount(0);
      await page.keyboard.press('Tab');
      await expect(tooltip).toBeHidden();
      await page.setViewportSize({ width: 390, height: 1100 });
      await why.click();
      await expect(tooltip).toBeVisible();
      const bounds = await tooltip.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width: 1440, height: 1100 });
    }
    console.log(`PASS ${level}: live preview, four viewport sizes, evidence and context disclosures`);
  }

  // E controls have their own hit target; hover and keyboard focus match the reference lift and darker purple.
  for (const selector of ['.brew-insight', '.brew-kpi']) {
    const icon = page.locator(`${selector} button.brew-kpi__edward`).first();
    await icon.hover();
    await expect.poll(() => icon.evaluate(node => getComputedStyle(node).transform)).toBe('matrix(1, 0, 0, 1, 0, -1)');
    expect(await icon.evaluate(node => getComputedStyle(node).boxShadow)).not.toContain('inset');
    expect(await icon.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(78, 48, 220)');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const icon = cards().first().locator('button.brew-kpi__edward');
  await icon.hover();
  await expect.poll(() => icon.evaluate(node => getComputedStyle(node).transform)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await icon.click();
  await expect(page.locator('#staff-edward-message')).toBeVisible();
  await expect(dialog()).toHaveCount(0);
  await page.getByRole('button', { name: 'Close Edward', exact: true }).click();

  for (let index = 0; index < 3; index++) {
    await cards().nth(index).getByRole('button', { name: 'View details' }).click();
    await expect(dialog().getByRole('heading', { name: 'How this was counted' })).toBeVisible();
    for (const width of [390, 820, 1440]) {
      await page.setViewportSize({ width, height: 1100 });
      await noOverflow(dialog());
      await noOverflow(dialog().locator('section, table'));
      await dialog().evaluate(node => node.scrollTop = 0);
      await dialog().screenshot({ path: `${output}/detail-${index}-${width}.png` });
    }
    const buttons = dialog().getByRole('button');
    await buttons.last().focus();
    await page.keyboard.press('Tab');
    await expect(buttons.first()).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(buttons.last()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog()).toHaveCount(0);
  }
  await cards().first().locator('h3 button').click();
  await page.locator('.brew-detail-layer').click({ position: { x: 2, y: 2 } });
  await expect(dialog()).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log('PASS reference E hover, reduced motion, separate Edward action, three dialogs, responsive tables, focus trap, Escape and backdrop dismissal; no browser errors');
} finally {
  await browser.close();
}
