// Mutations use only the separately provisioned disposable financial test API.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium, expect} from '@playwright/test';
const base='http://localhost:3009', api=process.env.FINANCIAL_TEST_API;
assert.equal(api, 'http://127.0.0.1:45639', 'Start the isolated financial test runtime on 45639');
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1600,height:1100}});
await context.route('**/v1/**', async route=>{
 const original=new URL(route.request().url());
 const response=await route.fetch({url:api+original.pathname+original.search});
 if(response.status()>=400) console.log(original.pathname,response.status(),await response.text());
 await route.fulfill({response});
});
const page=await context.newPage(), errors=[];
page.on('pageerror', e=>errors.push(e.message));
await page.goto(base+'/sign-in');
await page.getByRole('button',{name:/Continue as Ada/}).click();
await page.waitForURL(url=>url.pathname !== '/sign-in');
const initialRead=page.waitForResponse(r=>r.url().endsWith('/v1/student/financial-plan'));
await page.goto(base+'/financials');
const canonical=await(await initialRead).json();
const frame=page.frameLocator('iframe[title*="Financials"]');
await expect(frame.locator('#sum-figure')).toContainText('$4,401.55');
await expect(frame.getByText('$24,930',{exact:true})).toBeVisible();
assert.equal(await frame.locator('svg.ring path').count(),19);
const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:cents%100?2:0,maximumFractionDigits:2}).format(cents/100);
for(const charge of canonical.visualization.charges){
 const row=frame.locator('button.src-row').filter({hasText:charge.label});
 await expect(row).toContainText(money(charge.amountCents));
}
assert.equal(canonical.account.postedBalanceCents,canonical.ledger.reduce((total,row)=>total+row.amount_cents,0));
await frame.locator('.kpi2 [data-detail="gap"]').click();
await expect(frame.locator('#pop')).toContainText('$7,133 posted balance');
await frame.getByRole('button',{name:'Close',exact:true}).click();
const graph=frame.locator('path[data-detail]').first();await graph.focus();await page.keyboard.press('Enter');await expect(frame.locator('#pop')).toBeVisible();await page.keyboard.press('Escape');
// Saved budget persists after navigation and reload. Restore the original cents.
await frame.getByRole('spinbutton',{name:'Books & supplies amount',exact:true}).fill('650');
await frame.getByRole('spinbutton',{name:'Books & supplies amount',exact:true}).press('Tab');
await expect(frame.getByText('$2,880',{exact:true}).first()).toBeVisible();
await frame.getByRole('button',{name:'Save term estimates',exact:true}).click();
await expect(frame.locator('#budget-status')).toHaveText('Your term estimates are saved.');
await page.reload();await expect(frame.getByRole('spinbutton',{name:'Books & supplies amount',exact:true})).toHaveValue('650');
await frame.getByRole('spinbutton',{name:'Books & supplies amount',exact:true}).fill('600');await frame.getByRole('spinbutton',{name:'Books & supplies amount',exact:true}).press('Tab');await frame.getByRole('button',{name:'Save term estimates',exact:true}).click();await expect(frame.locator('#budget-status')).toHaveText('Your term estimates are saved.');
await frame.locator('#living-period').selectOption('month');await expect(frame.getByRole('spinbutton',{name:'Books & supplies amount',exact:true})).toHaveValue('133.33');await frame.locator('#living-period').selectOption('term');
for(const [route, heading] of [['payments','Your out-of-pocket payments'],['expenses','Your expenses, explained.'],['aid','Scholarships & grants · money you don’t pay back']]){
 await page.goto(base+'/financials/'+route);await expect(frame.getByRole('heading',{name:heading,exact:true})).toBeVisible();await page.screenshot({path:`artifacts/financials/verified-${route}.png`});
}
await frame.locator('#aid-period').selectOption('year');await expect(frame.getByText('Annual accepted / offered',{exact:true}).first()).toBeVisible();
await page.goto(base+'/financials/expenses/simulator');
// Routing accepts the workspace's canonical URL mapping.
await expect(frame.getByRole('heading',{name:'Plan Studio · What if?'})).toBeVisible();
await frame.locator('select[name="mealRateId"]').selectOption('MP-10');await frame.getByRole('button',{name:'Preview this scenario',exact:true}).click();
await expect(frame.locator('#scenario-result')).toContainText('$2,831.55');
await expect(frame.locator('#scenario-result')).toContainText('-$425');
await page.goto(base+'/financials');await expect(frame.locator('#sum-figure')).toContainText('$4,401.55');
await page.screenshot({path:'artifacts/financials/verified-overview.png'});
// Mobile layout and navigation; frame must not overflow the viewport.
await page.setViewportSize({width:390,height:844});await page.reload();await expect(frame.locator('#sum-figure')).toContainText('$4,401.55');
const dimensions=await frame.locator('body').evaluate(el=>({scroll:el.scrollWidth,width:innerWidth}));assert.ok(dimensions.scroll<=dimensions.width+2,JSON.stringify(dimensions));
await page.screenshot({path:'artifacts/financials/verified-mobile.png'});
assert.deepEqual(errors,[]);
await fs.writeFile('artifacts/financials/browser-result.json',JSON.stringify({status:'passed',checks:['API/ledger/visible charge equality','chart details and keyboard','budget save and reload','monthly average','four routes','annual aid','server simulation','mobile overflow'],errors},null,2));
await context.unrouteAll({behavior:'ignoreErrors'});
await browser.close();console.log('Financial browser checks passed.');
