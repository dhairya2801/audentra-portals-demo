import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Run against the existing local platform; changes only this browser's preferences.
const output = process.env.REVIEW_OUTPUT || 'artifacts/morning-brew-card-refresh';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const referenceStories = [
  {
    "title": "Financial aid delays put 38 deposited students at risk",
    "summary": "38 deposited students have waited 7+ days for aid review — 2.4× the typical turnaround.",
    "why": "Financial aid review — not student follow-through — is the main remaining barrier for this cohort. If delays persist, roughly 21–29% of exposed students may not enroll.",
    "action": "Prioritize these 38 files within 48 hours; contact only students who still have actions to complete.",
    "evidence": "Historically, students with aid reviews taking more than seven days enrolled at 68%, compared with 91% for otherwise-similar students resolved within three days. Of these 38 students, 29 have already completed at least 80% of other onboarding requirements.",
    "detail": "Most of the exposed students have satisfied other enrollment requirements. The remaining friction is an institutional processing delay, so reminders alone are unlikely to resolve it.",
    "students": "38",
    "losses": "8–11",
    "tuition": "$192–264K",
    "confidence": 94
  },
  {
    "title": "Course capacity blocks 32 enrollment-ready students",
    "summary": "96 incoming students are eligible, but only 64 unreserved seats remain in required sections.",
    "why": "These students cannot complete registration under the current schedule even if they take every required action on time. Roughly 22–31% may be lost without an available registration path.",
    "action": "Open course capacity or approve alternate pathways before the registration deadline.",
    "evidence": "Audentra matched students’ program requirements, completed prerequisites, registration eligibility and available section capacity. The eligible cohort exceeds remaining unreserved seats by 32.",
    "detail": "The bottleneck is a seat shortfall rather than student intent or lack of awareness. A generic registration reminder would not create a valid seat.",
    "students": "32",
    "losses": "7–10",
    "tuition": "$168–240K",
    "confidence": 91
  },
  {
    "title": "54 deposited students show signs of disengagement",
    "summary": "54 deposited students have had no portal, event or two-way activity for 10+ days.",
    "why": "Prolonged silence surfaces before a formal enrollment failure appears in headline KPIs. The model attributes incremental loss risk of roughly 17–24% to sustained disengagement.",
    "action": "Launch counselor-led recovery outreach, prioritizing unresolved checklist items and no recent two-way contact.",
    "evidence": "Among otherwise-similar deposited students at the same stage, students with meaningful activity over the past seven days enrolled at 89%, versus 68% among students inactive for ten or more days.",
    "detail": "The lack of responses, event attendance and portal activity across multiple signals makes disengagement a more useful intervention trigger than a single missed email.",
    "students": "54",
    "losses": "9–13",
    "tuition": "$216–312K",
    "confidence": 88
  }
];
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
    await expect(page.getByText(/Team setting ·|Changing this switch applies to everyone/)).toHaveCount(0);
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
    for (const [cardIndex, story] of referenceStories.entries()) {
      const card = cards().nth(cardIndex);
      await expect(card.locator('h3')).toHaveText(story.title);
      await expect(card.locator(':scope > p')).toHaveText(story.summary);
      await expect(card.getByText(`${story.confidence}% confidence`, { exact: true })).toBeVisible();
      await expect(card.getByText(story.action, { exact: true })).toBeVisible();
      await expect(card.locator('dt')).toHaveText(level === 'glance'
        ? ['Estimated Loss', 'Net Tuition At Risk']
        : ['Students Exposed', 'Estimated Loss', 'Net Tuition At Risk']);
      await expect(card.locator('dd')).toHaveText(level === 'glance'
        ? [story.losses, story.tuition]
        : [story.students, story.losses, story.tuition]);
      await expect(card.getByRole('button', { name: 'Why it matters' })).toHaveCount(1);
    }
    for (const width of sizes) {
      await page.setViewportSize({ width, height: 1100 });
      await noOverflow(cards());
      await noOverflow(cards().locator('dd'));
      expect(await cards().locator('dd').evaluateAll(nodes => nodes.every(node =>
        node.getBoundingClientRect().height <= parseFloat(getComputedStyle(node).lineHeight) + 1
      ))).toBe(true);
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
    await expect(first.getByText(referenceStories[0].evidence, { exact: true })).toBeVisible();
    await expect(dialog()).toHaveCount(0);
    await evidence.click();
    {
      const why = first.getByRole('button', { name: 'Why it matters' });
      const tooltip = first.getByRole('tooltip');
      const originalHeight = (await first.boundingBox()).height;
      await why.hover();
      await expect(tooltip).toBeVisible();
      await expect(tooltip.locator('p')).toHaveText(referenceStories[0].why);
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
    await expect(dialog().getByRole('heading', { name: 'Evidence behind the signal' })).toBeVisible();
    const story = referenceStories[index];
    await expect(dialog().getByText(story.summary, { exact: true })).toBeVisible();
    await expect(dialog().getByText(story.detail, { exact: true })).toBeVisible();
    await expect(dialog().getByText(story.why, { exact: true })).toBeVisible();
    await expect(dialog().getByText(story.evidence, { exact: true })).toBeVisible();
    await expect(dialog().getByText(story.action, { exact: true })).toBeVisible();
    await expect(dialog().locator('dd')).toHaveText([story.students, story.losses, story.tuition]);
    await expect(dialog().getByText(/Illustrative sample data for UI review/)).toBeVisible();
    await expect(dialog().locator('.brew-student-list, .brew-table')).toHaveCount(0);
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
