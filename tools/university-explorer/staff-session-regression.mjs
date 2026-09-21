/** Real-session regression; use an isolated synthetic university API.
 * Run against both BROWSER_AUTH_REQUIRED=false and true. No identity headers
 * are supplied by the browser and no session material is saved to disk.
 */
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const portal = process.env.E2E_BASE_URL || 'http://127.0.0.1:3009';
const api = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:45659';
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const identityHeaders = [];
page.on('request', request => {
  if (new URL(request.url()).pathname.startsWith('/v1/staff')) {
    for (const key of ['x-demo-actor-type', 'x-demo-actor-id']) {
      if (request.headers()[key]) identityHeaders.push(key);
    }
  }
});
await context.route('**/v1/**', async route => {
  const url = new URL(route.request().url());
  // This test checks sessions, not the long-lived event stream.
  if (url.pathname.endsWith('/events')) return route.abort();
  const target = new URL(url.pathname + url.search, api);
  await route.fulfill({ response: await route.fetch({ url: target.toString() }) });
});

const choice = page.getByTitle('Open the staff portal as Camila Abernathy', { exact: true });
const account = page.getByRole('button', { name: /Account menu for/ });
async function expectSignedOut() {
  await expect(choice).toBeVisible({ timeout: 30000 });
  await expect(account).toHaveCount(0);
  assert.equal((await context.cookies()).some(c => c.name === 'vv_staff_session'), false);
}
async function signIn(name) {
  await page.getByTitle(`Open the staff portal as ${name}`, { exact: true }).click();
  await expect(account).toHaveAttribute('aria-label', `Account menu for ${name}`, { timeout: 30000 });
}

try {
  await page.goto(`${portal}/staff`);
  await expectSignedOut();
  await signIn('Camila Abernathy');
  const oldSession = (await context.cookies()).find(c => c.name === 'vv_staff_session');
  assert.ok(oldSession);
  await account.click();
  await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
  await expectSignedOut();
  await page.reload();
  await expectSignedOut();
  // A fresh tab must also stay signed out; this cannot rely on React state.
  const tab = await context.newPage();
  await tab.goto(`${portal}/staff#tasks`);
  await expect(tab.getByTitle('Open the staff portal as Camila Abernathy', { exact: true })).toBeVisible();
  await expect(tab.getByRole('button', { name: /Account menu for/ })).toHaveCount(0);
  await tab.close();
  // The server revokes the old credential, rather than merely hiding the UI.
  const revoked = await context.request.get(`${api}/v1/staff/me`, {
    headers: {
      'x-demo-tenant-id': '00000000-0000-7000-8000-000000000003',
      cookie: `vv_staff_session=${oldSession.value}`,
    },
  });
  assert.equal(revoked.status(), 401);
  // In unrestricted local mode, explicitly choosing another person must win.
  const names = await page.locator('.staff-demo-login__person strong').allTextContents();
  const other = names.find(name => name !== 'Camila Abernathy' && !name.includes('leave') && !name.includes('departed'));
  const selected = other || 'Camila Abernathy';
  await signIn(selected);
  await page.reload();
  await expect(account).toHaveAttribute('aria-label', `Account menu for ${selected}`, { timeout: 30000 });
  await account.click();
  await page.getByRole('menuitem', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expectSignedOut();
  assert.deepEqual(identityHeaders, []);
  console.log(`PASS: explicit sign-in, both sign-out controls, reload, new tab, revoked session, ${other ? 'alternate staff selection' : 'restricted persona re-entry'}; no browser identity fallback.`);
} finally {
  await context.unrouteAll({ behavior: 'ignoreErrors' });
  await browser.close();
}
