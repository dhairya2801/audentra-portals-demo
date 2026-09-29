/** Check named demo sign-ins locally, then explicitly exercise the configured
 * OpenAI provider using ONLY the fictional account created by signup-onboarding.
 * No provider questions for Ada/Camila, no record writes, no raw response files.
 * Live model checks additionally require AUDENTRA_PROVIDER_CHECK=1 and consent.
 */
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
if (process.env.AUDENTRA_SIGNUP_E2E !== 'isolated') throw new Error('Requires isolated demo preview.');
const out = 'artifacts/ui-refresh/signup-edward';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  const student = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const ada = await student.newPage();
  await ada.goto('http://localhost:3000/sign-in');
  const adaButton = ada.getByRole('button', { name: /Continue as Ada/ });
  await expect(adaButton).toBeVisible();
  await ada.screenshot({ path: `${out}/ada-sign-in.png`, fullPage: true });
  await adaButton.click();
  await ada.getByRole('heading', { name: 'Your next steps', exact: true }).waitFor();
  results.push({ check: 'Ada demo sign-in', pass: true });
  await student.close();

  const staff = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const camila = await staff.newPage();
  await camila.goto('http://localhost:3000/staff');
  const camilaButton = camila.getByRole('button', { name: /Camila Abernathy/ });
  await expect(camilaButton).toBeVisible();
  await camila.screenshot({ path: `${out}/camila-sign-in.png`, fullPage: true });
  await camilaButton.click();
  await camila.locator('.staff-shell--workspace').waitFor();
  results.push({ check: 'Camila demo sign-in', pass: true });
  await staff.close();

  const fresh = await browser.newContext({
    storageState: 'artifacts/ui-refresh/signup/completed-session.json',
    viewport: { width: 1440, height: 1000 },
  });
  const page = await fresh.newPage();
  await page.goto('http://localhost:3000/enrollment');
  await page.getByRole('heading', { name: 'Your next steps', exact: true }).waitFor();
  const profile = await page.evaluate(async () => {
    const r = await fetch('/v1/student/profile', { headers: { 'X-Tenant-Slug': 'aster' } });
    if (!r.ok) throw new Error('Synthetic profile unavailable');
    return r.json();
  });
  // Fail closed rather than accidentally sending an existing user's record.
  expect(profile.firstName).toBe('Morgan');
  expect(profile.lastName).toBe('Test');
  expect(profile.email).toMatch(/^signup-\d+@example\.test$/);
  if (process.env.AUDENTRA_PROVIDER_CHECK === '1') {
    await page.locator('.edward-launcher').click();
    const panel = page.locator('.edward-panel').first();
    for (const [question, expected] of [
      ['What is my full name and what email address do you have for me?', /Morgan/],
      ['Which enrollment steps do I still need to complete?', /identity|transcript|deposit/i],
      ['What housing preference and emergency contact did I save during onboarding?', /off.campus/i],
    ]) {
      await panel.locator('textarea').fill(question);
      const responsePromise = page.waitForResponse(
        r => r.url().endsWith('/v1/student/assistant/messages') && r.request().method() === 'POST',
        { timeout: 120000 },
      );
      await panel.getByRole('button', { name: 'Send question', exact: true }).click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      const answer = await response.json();
      expect(answer.message).toMatch(expected);
      expect(answer.message).not.toMatch(/not found in this university|couldn.t.*record|unable to.*record/i);
      if (question.startsWith('What is my full name')) expect(answer.message).toContain(profile.email);
      if (question.startsWith('What housing')) expect(answer.message).toContain('Alex');
      results.push({ check: question, pass: true, provider: answer.provider, model: answer.model });
      console.log('PASS', question, answer.provider, answer.model);
    }
    await page.screenshot({ path: `${out}/fictional-account-edward.png`, fullPage: true });
  }
  await fresh.close();
  await fs.writeFile(`${out}/result.json`, JSON.stringify({ pass: true, providerCheck: process.env.AUDENTRA_PROVIDER_CHECK === '1', results }, null, 2));
} finally {
  await browser.close();
}
