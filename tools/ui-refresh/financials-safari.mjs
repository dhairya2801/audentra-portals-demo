/** Read-only financial navigation and bridge regression in WebKit and Chromium. */
import assert from 'node:assert/strict';
import {chromium,webkit,devices,expect} from '@playwright/test';
const base=process.env.PORTAL_BASE||'http://localhost:3000';
const routes=['/financials','/financials/payments','/financials/expenses','/financials/aid','/financials/expenses/housing','/financials/expenses/meals','/financials/expenses/simulator','/financials/expenses#coverage','/financials/payments#timeline'];
for(const engine of [webkit,chromium]) {
 const browser=await engine.launch();
 try {
  for(const mobile of [true,false]) {
   const context=await browser.newContext(mobile?devices['iPhone 13']:{viewport:{width:1440,height:1000}});
   const page=await context.newPage();page.setDefaultTimeout(20000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{
    window.__financialBridge=[];
    window.addEventListener('message',event=>{
     if(event.data?.type==='financial-plan:response')window.__financialBridge.push({fromParent:event.source===parent,sameOrigin:event.origin===location.origin});
    });
   });
   assert.ok((await page.request.post(base+'/v1/auth/demo/sign-in-as',{data:{studentRef:'SYN-000061'}})).ok());
   const frame=page.frameLocator('iframe[title*="Financials"]');
   const ready=async()=>{
    await expect(frame.locator('#tab-root h2').first()).toBeVisible();
    await expect(frame.locator('#tab-root')).not.toContainText('Your financial plan is unavailable');
    await expect(frame.locator('#sum-figure')).toContainText('$');
    const receipts=await frame.locator('body').evaluate(()=>window.__financialBridge);
    assert.ok(receipts.length);assert.ok(receipts.every(r=>r.fromParent&&r.sameOrigin));
   };
   await page.goto(base+'/financials');await ready();
   for(const [label,section] of [['Expenses','expenses'],['Loans & aid','aid'],['Overview','overview']]) {
    if(mobile)await page.getByRole('button',{name:'Open navigation',exact:true}).tap();
    const link=page.locator('.sidebar').getByRole('link',{name:label,exact:true});
    if(mobile)await link.tap();else await link.click();
    await expect.poll(()=>frame.locator('body').evaluate(()=>location.hash)).toBe('#'+section);
    await ready();
   }
   for(const route of routes.slice(1)) {
    await page.goto(base+route,{waitUntil:'domcontentloaded'});await ready();
   }
   // Both successful reads and errors must reach the actual parent-verified receiver.
   await page.route('**/v1/student/financial-plan',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'TEMPORARILY_UNAVAILABLE',message:'Test read failure'}})}));
   await page.goto(base+'/financials');
   await expect(frame.getByRole('heading',{name:'Your financial plan is unavailable'})).toBeVisible();
   await expect(frame.locator('#tab-root')).not.toContainText('The university service did not respond');
   await page.unroute('**/v1/student/financial-plan');
   await frame.getByRole('button',{name:'Retry',exact:true}).click();await ready();
   assert.deepEqual(errors,[]);
   console.log('PASS',engine.name(),mobile?'iPhone-sized touch':'desktop','sidebar tabs, nine routes, correct reply sender, failure/retry');
   await context.close();
  }
 }finally{await browser.close();}
}
