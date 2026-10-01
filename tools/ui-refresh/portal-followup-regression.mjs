/** Existing local portal and matching API. Paid answers are opt-in; use a capped test runtime. */
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const base=process.env.PORTAL_BASE||'http://localhost:3000';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1512,height:1100}});
page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(30000);
const calls=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(r.url().endsWith('/v1/staff/assistant/messages'))calls.push(r.postDataJSON());});
const prompts=['What needs my attention today?','What are my urgent Task Board items?','Which documents are waiting on review?'];
try {
 assert.ok((await page.request.post(base+'/v1/auth/demo/staff/sign-in-as',{data:{staffRef:'AU-55ff7e408818'}})).ok());
 const roster=await (await page.request.get(base+'/v1/staff/students?limit=7')).json();
 assert.ok(roster.summary?.totalTasks>0,'The running API must return full-dataset summaries');
 assert.ok(roster.summary.blockingSteps>0);assert.ok(roster.summary.highRisk>0);
 await page.goto(base+'/staff#students');
 const metric=label=>page.locator('article').filter({has:page.getByText(label,{exact:true})});
 await expect(metric('Enrollment readiness').locator('strong')).toHaveText(`${Math.round(roster.summary.completedTasks/roster.summary.totalTasks*100)}%`);
 await expect(metric('Enrollment readiness')).toContainText(`${roster.summary.completedTasks.toLocaleString()} of ${roster.summary.totalTasks.toLocaleString()} milestones complete`);
 await expect(metric('Students at risk · mock').locator('strong')).toHaveText(String(roster.summary.highRisk));
 await expect(metric('Blocked enrollment steps').locator('strong')).toHaveText(String(roster.summary.blockingSteps));
 console.log('PASS canonical metrics',JSON.stringify(roster.summary));
 // An incomplete API response must never masquerade as zero canonical totals.
 await page.route('**/v1/staff/students?*',async route=>{
  const response=await route.fetch();const data=await response.json();delete data.summary;
  await route.fulfill({response,json:data});
 });
 console.log('checking missing summary');
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.getByText('Directory totals are unavailable.',{exact:false})).toBeVisible();
 await expect(metric('Enrollment readiness').locator('strong')).toHaveText('—');
 await expect(metric('Students at risk · mock').locator('strong')).toHaveText('—');
 await expect(metric('Blocked enrollment steps').locator('strong')).toHaveText('—');
 console.log('checking retry');
 await page.unroute('**/v1/staff/students?*');
 await page.getByRole('status').filter({hasText:'Directory totals are unavailable'}).getByRole('button',{name:'Retry'}).click();
 await expect(metric('Blocked enrollment steps').locator('strong')).toHaveText(String(roster.summary.blockingSteps));
 await page.evaluate(()=>localStorage.setItem('audentra:morning-brew:v7:demo:01973261-954a-5019-8e9e-24a699abea7b',JSON.stringify({version:7,topics:['financial_aid','admissions','enrollment','housing','campus_life'],sources:Object.fromEntries(['pulse','news','calendar','email','actions','intelligence'].map(x=>[x,{enabled:true,detail:'deep'}])),deliveryTime:'06:00',onboardingComplete:true,updatedAt:new Date().toISOString()})));
 console.log('checking card openings');
 await page.goto(base+'/staff#morning_brew',{waitUntil:'domcontentloaded'});
 const panel=page.locator('#staff-edward-panel');
 async function openCard(label){
  if(await panel.isVisible())await panel.getByRole('button',{name:'Close Edward',exact:true}).click();
  await page.locator('.brew-kpi').filter({has:page.getByRole('button',{name:label,exact:true})}).locator('.brew-kpi__edward').click();
  await expect(panel.locator('[data-card-greeting]')).toHaveCount(1);
  await expect(panel.getByText(/^Hi! What would you like to know/)).toHaveCount(1);
  await expect(panel.getByText(/Demo display; answers use/)).toHaveCount(0);
  await expect(panel.getByRole('button',{name:'Clear card context'})).toHaveCount(0);
  for(const prompt of prompts)await expect(panel.getByRole('button',{name:prompt,exact:true})).toBeVisible();
 }
 for(const label of ['Deposit Paid','Verification Queue','Orientation Registered']) await openCard(label);
 assert.equal(calls.length,0,'Card openings do not submit');
 if(process.env.VERIFY_EDWARD==='1') {
  async function ask(question,button=false){
   const response=page.waitForResponse(r=>r.url().endsWith('/v1/staff/assistant/messages')&&r.request().method()==='POST',{timeout:180000});
   if(button)await panel.getByRole('button',{name:question,exact:true}).click();
   else {await panel.locator('textarea').fill(question);await panel.getByRole('button',{name:'Send message',exact:true}).click();}
   const r=await response;assert.equal(r.status(),200,await r.text());const data=await r.json();
   assert.ok(data.message);assert.ok(!/Extra inputs are not permitted|matching [“"]Morning Brew/i.test(data.message));
   assert.ok(data.contextReceipts?.length||/cannot|unavailable|couldn.t|not available/i.test(data.message));
   await expect(panel.getByRole('button',{name:'Stop waiting',exact:true})).toHaveCount(0);
   console.log('PASS answer',{question,provider:data.provider,sources:data.contextReceipts?.map(x=>x.source)});
   return data;
  }
  await openCard('Verification Queue');
  await ask('Which students have an open financial aid verification, and what is each waiting on?');
  const first=calls.at(-1);await ask('Which students are affected?');
  assert.equal(calls.at(-1).historyAfter,first.historyAfter);
  await openCard('Orientation Registered');
  await expect(panel.getByText(first.message,{exact:true})).toBeVisible();
  await ask('Which deposited students have not registered for orientation?');
  assert.notEqual(calls.at(-1).historyAfter,first.historyAfter);
  await ask(prompts[1],true);
 }
 await panel.getByRole('button',{name:'Close Edward',exact:true}).click();
 await page.locator('.edward-launcher').click();
 await expect(panel.locator('[data-card-greeting]')).toHaveCount(1);
 assert.deepEqual(errors,[]);
 console.log('PASS single greeting, retained history, no banner, three suggestions, normal assistant requests, floating reopen');
}finally{await browser.close();}
