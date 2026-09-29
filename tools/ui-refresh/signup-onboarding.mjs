/** Writes only to the disposable signup API proxied by localhost:3000.
 * Start the isolated services documented in docs/ui-refresh/onboarding.md first.
 * No intercepted API responses, payments, uploads, or assistant requests.
 */
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';

if (process.env.AUDENTRA_SIGNUP_E2E !== 'isolated') {
  throw new Error('Requires AUDENTRA_SIGNUP_E2E=isolated and the disposable local API proxy.');
}
const out = 'artifacts/ui-refresh/signup';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce',
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const apiErrors = [];
page.on('response', response => {
  if (response.url().includes('/v1/') && response.status() >= 400) {
    apiErrors.push({ status: response.status(), path: new URL(response.url()).pathname });
  }
});
const stamp = Date.now();
const email = `signup-${stamp}@example.test`;
const password = `Local-${stamp}-Test!`;

async function next() {
  const heading = page.locator('.page-hero h1');
  const previous = await heading.innerText();
  await page.getByRole('button', { name: 'Save and continue', exact: true }).click();
  await expect(heading).not.toHaveText(previous, { timeout: 20000 });
  await expect(page.locator('.step-failed')).toHaveCount(0);
  console.log('Saved:', previous);
}
async function choose(label, option) {
  const box = page.getByRole('combobox', { name: label, exact: true });
  await box.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await box.focus();
  await box.press('ArrowDown');
  await box.pressSequentially(option.toLowerCase());
  await box.press('Enter');
  await expect(box).toContainText(option);
}
async function capture(name) {
  for (const width of [1440, 1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
async function readProgress() {
  return page.evaluate(async () => {
    const [bootstrap, requirements] = await Promise.all(
      ['/v1/student/bootstrap', '/v1/student/requirements'].map(async path => {
        const response = await fetch(path, { headers: { 'X-Tenant-Slug': 'aster' } });
        if (!response.ok) throw new Error(`${path}: ${response.status}`);
        return response.json();
      }),
    );
    return { bootstrap, requirements };
  });
}

try {
  await page.goto('http://localhost:3000/sign-in');
  await page.getByRole('tab', { name: 'Create account', exact: true }).click();
  await page.locator('input[name=email]').fill(email);
  await page.locator('input[name=phone]').fill(`+1202${String(stamp).slice(-7)}`);
  await page.locator('input[name=password]').fill(password);
  await page.locator('input[name=passwordConfirmation]').fill(password);
  await page.getByRole('button', { name: 'Create account and start onboarding', exact: true }).click();
  await page.locator('.offer-card').waitFor({ timeout: 60000 });
  await capture('active-offer');
  await page.getByRole('button', { name: /Yes, I’m joining/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Continue to step 2', exact: true }).click();
  await page.locator('input[autocomplete=given-name]').fill('Morgan');
  await page.locator('input[autocomplete=family-name]').fill('Test');
  await page.locator('input[autocomplete=nickname]').fill('Morgan');
  await choose('Citizenship status', 'International student');
  await capture('details');
  await next();

  await page.locator('input[autocomplete=address-line1]').fill('12 Test Street');
  await page.locator('input[autocomplete=address-level2]').fill('Toronto');
  await page.locator('input[autocomplete=address-level1]').fill('Ontario');
  await page.locator('input[autocomplete=postal-code]').fill('M5V 1A1');
  // Regression: long-menu keyboard navigation and scrolling must not close it.
  const country = page.getByRole('combobox', { name: 'Country', exact: true });
  await country.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await country.press('ArrowDown');
  await country.press('End');
  await expect(country).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('listbox').evaluate(el => { el.scrollTop = 0; });
  await expect(country).toHaveAttribute('aria-expanded', 'true');
  await country.press('Escape');
  await expect(country).toBeFocused();
  await choose('Country', 'Canada');
  await page.getByRole('radio', { name: /^Email/ }).check();
  await next();
  await page.getByRole('radio', { name: /^Off campus/ }).check();
  await next();
  await page.getByRole('radio', { name: /Not right now/ }).check();
  await next();
  await page.getByRole('textbox', { name: 'Full name', exact: true }).fill('Alex Test');
  await choose('How they’re related to you', 'Parent');
  await page.getByRole('textbox', { name: 'Phone number', exact: true }).fill('+12025550102');
  await next();
  await next(); // No delegate access requested.
  await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
  await page.locator('.read-panel-body').first().waitFor();
  for (const image of await page.locator('.sign-doc-page').all()) {
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  for (const panel of await page.locator('.read-panel-body').all()) {
    await panel.evaluate(el => { el.scrollTop = el.scrollHeight; });
  }
  await page.getByRole('textbox', { name: /Type your full legal name to sign/ }).fill('Morgan Test');
  await capture('review');
  await next(); // Real FERPA signature + acknowledgment; regression for stale version.
  await page.getByRole('radio', { name: /Accept now, pay by the deadline/ }).check();
  await next();
  await capture('onboarding-finished');
  await page.getByRole('button', { name: 'Go to My Enrollment', exact: true }).click();
  await page.waitForURL('**/enrollment', { timeout: 60000 });
  await page.getByRole('heading', { name: 'Your next steps', exact: true }).waitFor();
  const first = await readProgress();
  expect(first.bootstrap.onboarding).toMatchObject({ status: 'completed', required: false });
  const states = Object.fromEntries(first.requirements.items.map(item => [item.code, item.status]));
  expect(states.profile_verification).toBe('completed');
  expect(states.family_permissions).toBe('completed');
  expect(states.identity_document).toBe('ready');
  expect(states.enrollment_deposit).toBe('ready');
  const completed = first.requirements.items.filter(item => item.status === 'completed').length;
  await expect(page.getByText(`${completed} of ${first.requirements.items.length} steps complete`, { exact: true })).toBeVisible();
  await capture('enrollment');
  await context.storageState({ path: `${out}/completed-session.json` });

  // A new browser session must retain completion and the same real requirements.
  await context.clearCookies();
  await page.goto('http://localhost:3000/sign-in');
  await page.locator('input[name=email]').fill(email);
  await page.locator('input[name=password]').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(url => !['/sign-in', '/onboarding'].includes(url.pathname));
  await page.goto('http://localhost:3000/enrollment');
  await page.getByRole('heading', { name: 'Your next steps', exact: true }).waitFor();
  const resumed = await readProgress();
  expect(resumed.bootstrap.onboarding).toEqual(first.bootstrap.onboarding);
  expect(resumed.requirements.items.map(item => [item.id, item.status])).toEqual(
    first.requirements.items.map(item => [item.id, item.status]),
  );
  expect(apiErrors).toEqual([]);
  await fs.writeFile(`${out}/completion.json`, JSON.stringify({
    pass: true, route: '/enrollment', reloginPreservesProgress: true,
    viewportWidths: [1440, 1280, 390], apiErrors,
    onboarding: first.bootstrap.onboarding,
    requirements: first.requirements.items.map(item => ({ code: item.code, status: item.status })),
  }, null, 2));
  console.log('PASS: fresh signup, signing, real remaining requirements, and sign-in resume.');
} catch (error) {
  console.log('Failed layout', await page.evaluate(() => ({width: innerWidth, scroll: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 15).map(el => ({tag:el.tagName, class:el.className, right:el.getBoundingClientRect().right}))})));
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
  throw error;
} finally {
  await browser.close();
}
