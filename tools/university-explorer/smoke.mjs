/** Browser integration checks against a running, locally generated world. */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const base = process.env.UNIVERSITY_URL || 'http://127.0.0.1:4310';
const out = new URL('../../artifacts/university-explorer/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1512, height: 1050 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon'))
    errors.push(m.text()); });
try {
    await page.goto(base);
    await page.getByRole('heading', { name: 'A living world. A better proving ground.' }).waitFor();
    await page.screenshot({ path: out + 'observatory.png', fullPage: true });
    for (const [route, text] of [['staff', 'An office is only the beginning.'], ['academics', 'A path is more than a credit count.'], ['workflows', 'The work between the offices.'], ['policies', 'Read the institution’s own words.'], ['calendar', 'A calendar of consequences.'], ['housing', 'Rooms are real inventory.'], ['scenarios', 'Ask the questions that matter.'], ['model', 'Trust the world. Inspect the seams.']]) {
        await page.goto(base + '/#' + route);
        await page.getByRole('heading', { name: text }).waitFor();
        assert.equal(await page.locator('.error').count(), 0);
    }
    await page.goto(base + '/#students');
    await page.getByRole('textbox', { name: 'Search students' }).fill('SYN-000004');
    await page.getByRole('button', { name: 'Find students' }).click();
    await page.waitForFunction(() => document.querySelector('tbody')?.querySelectorAll('tr').length === 1);
    await page.locator('tbody a').first().click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('tab', { name: 'Academics' }).click();
    await page.locator('tr').filter({ hasText: 'CS 101' }).getByRole('button', { name: 'What if I drop?' }).click();
    await page.getByRole('heading', { name: 'A hypothetical, with its consequences' }).waitFor();
    assert.match(await page.locator('#whatif-result').innerText(), /12.*8/s);
    await page.screenshot({ path: out + 'student-what-if.png', fullPage: true });
    await page.getByRole('tab', { name: 'Timeline' }).click();
    await page.getByRole('button', { name: 'Apply time lens' }).click();
    await page.getByRole('button', { name: 'Close student dossier' }).click();
    await page.goto(base + '/#scenario/late-arriving-fact');
    await page.getByRole('button', { name: 'Reveal evaluator rubric' }).click();
    await page.locator('.rubric').waitFor();
    assert.match(await page.locator('.rubric').innerText(), /4 September/);
    await page.goto(base + '/#policies');
    await page.getByRole('textbox', { name: 'Search policy corpus' }).fill('Account settlement');
    await page.getByLabel('Include superseded versions').check();
    await page.getByRole('button', { name: 'Search sources' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.policy-item').length === 2);
    await page.screenshot({ path: out + 'policy-versions.png', fullPage: true });
    await page.goto(base + '/#scenario/safe-release');
    await page.getByRole('button', { name: 'Create action sandbox' }).click();
    await page.waitForFunction(() => document.querySelector('#sandbox-status').textContent.startsWith('Sandbox'));
    await page.getByRole('link', { name: 'Open student dossier' }).click();
    await page.getByRole('tab', { name: 'Financials' }).click();
    await page.getByRole('button', { name: 'Review release · version 1' }).click();
    await page.getByLabel('I confirm this specific hold release').check();
    await page.getByRole('button', { name: 'Confirm & execute' }).click();
    await page.getByText('No active financial hold to release').waitFor();
    const baseline = await page.request.get(base + '/api/evidence?student_id=' + ((await (await page.request.get(base + '/api/scenarios')).json()).find(s => s.id === 'safe-release').student_id));
    assert.equal((await baseline.json()).holds.find(h => h.id === 'ready-release').released_at, null);
    await page.getByRole('button', { name: 'Close student dossier' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    await page.getByRole('heading', { name: 'A living world. A better proving ground.' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Mobile page overflows horizontally');
    await page.screenshot({ path: out + 'mobile.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS: 10 views, student search, what-if, time lens, policy history, rubric, sandbox release, baseline isolation, mobile overflow, browser errors.');
    console.log('Screenshots: ' + out);
}
finally {
    await browser.close();
}
