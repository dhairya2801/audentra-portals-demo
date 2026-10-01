import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const base=process.env.PORTAL_BASE||'http://127.0.0.1:3019';
const apiBase=process.env.API_BASE||'http://127.0.0.1:45619';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1512,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const calls=[];page.on('request',r=>{if(r.url().endsWith('/v1/staff/assistant/messages'))calls.push(r.postDataJSON());});
try {
 await page.request.post(apiBase+'/v1/auth/demo/staff/sign-in-as',{data:{staffRef:'AU-55ff7e408818'}});
 await page.goto(base+'/staff');await page.locator('.staff-shell--workspace').waitFor();
 const navigation=await (await page.request.get(apiBase+'/v1/staff/workspace?projection=navigation')).json();
 const full=await (await page.request.get(apiBase+'/v1/staff/workspace')).json();
 assert.equal(navigation.currentStaff.id,full.currentStaff.id);
 assert.deepEqual(navigation.actionCenter.scopes,full.actionCenter.scopes);
 assert.equal(navigation.newInquiries,full.inquiries.filter(item=>item.status==='new').length);
 assert.ok(!('students' in navigation),'Navigation must not return the roster');
 await page.evaluate(()=>localStorage.setItem('audentra:morning-brew:v7:demo:01973261-954a-5019-8e9e-24a699abea7b',JSON.stringify({version:7,topics:['financial_aid','admissions','enrollment','housing','campus_life'],sources:Object.fromEntries(['pulse','news','calendar','email','actions','intelligence'].map(x=>[x,{enabled:true,detail:'deep'}])),deliveryTime:'06:00',onboardingComplete:true,updatedAt:new Date().toISOString()})));
 await page.reload();await page.locator('.brew-hero').waitFor();
 const panel=page.locator('#staff-edward-panel');
 const entries=page.locator('button.brew-kpi__edward, .brew-edward-chip, .brew-feedback');
 console.log('entry inventory',await entries.count());
 for(let i=0;i<(process.env.VERIFY_EDWARD==='1'?0:await entries.count());i++) {
  console.log("entry",i);await entries.nth(i).click();await expect(panel).toBeVisible();await expect(page.locator('.brew-edward-layer')).toHaveCount(0);
  await expect(panel).toContainText('Hi! What would you like to know');
  const count=await panel.locator('.edward-message').count();
  await panel.getByRole('button',{name:'Close Edward',exact:true}).click();
  await entries.nth(i).click();await expect(panel.locator('.edward-message')).toHaveCount(count);
  await panel.getByRole('button',{name:'Close Edward',exact:true}).click();
 }
 assert.equal(calls.length,0,'Opening cards never submits');
 // Every expanded KPI/insight retains the same context as its card.
 const details=page.locator('.brew-kpi .brew-stretch, .brew-insight .brew-stretch');
 for(let i=0;i<(process.env.VERIFY_EDWARD==='1'?0:await details.count());i++) {
  await details.nth(i).click();await page.locator('.brew-detail').waitFor();
  const count=await page.locator('.brew-detail').getByRole('button',{name:/Ask Edward/}).count();
  for(let j=0;j<count;j++) {
   if(j)await details.nth(i).click();
   await page.locator('.brew-detail').getByRole('button',{name:/Ask Edward/}).nth(j).click();
   await expect(panel).toBeVisible();await expect(page.locator('.brew-detail-layer')).toHaveCount(0);
   await panel.getByRole('button',{name:'Close Edward',exact:true}).click();
  }
 }
 assert.equal(calls.length,0);
 if(process.env.VERIFY_EDWARD!=='1') {
  const rows=page.locator('.brew-calendar-row .brew-stretch, .brew-email-row .brew-stretch, li:has(> .brew-priority-flag) .brew-stretch');
  for(let i=0;i<await rows.count();i++) {
   await rows.nth(i).click();
   const revision=page.getByRole('textbox',{name:'Say what to change'});
   if(await revision.count()) await revision.fill('Make this shorter');
   const count=await page.locator('.brew-detail').getByRole('button',{name:/Ask Edward/}).count();
   for(let j=0;j<count;j++) {
    if(j)await rows.nth(i).click();
    await page.locator('.brew-detail').getByRole('button',{name:/Ask Edward/}).nth(j).click();
    await expect(panel).toBeVisible();await expect(page.locator('.brew-detail-layer')).toHaveCount(0);
    await panel.getByRole('button',{name:'Close Edward',exact:true}).click();
   }
  }
  assert.equal(calls.length,0);
 }
 async function ask(question) {
  await panel.locator('textarea').fill(question);
  const response=page.waitForResponse(r=>r.url().endsWith('/v1/staff/assistant/messages')&&r.request().method()==='POST',{timeout:180000});
  await panel.locator('.edward-send-button').click();const r=await response;
  assert.equal(r.status(),200,await r.text());const data=await r.json();
  assert.ok(!data.message.includes('matching “Morning Brew”'),data.message);
  console.log('answer',question,JSON.stringify({provider:data.provider,resolvedStudent:data.resolvedStudent,receipts:data.contextReceipts,message:data.message.slice(0,900)}));
  await expect(panel.locator('.edward-send-button')).toBeDisabled();return data;
 }
 if(process.env.VERIFY_EDWARD==='1') {
  await page.locator('.brew-kpi').filter({has:page.getByRole('button',{name:'Verification Queue',exact:true})}).locator('.brew-kpi__edward').click();
  const aid=await ask('Which students have an open financial aid verification, and what is each waiting on?');
  assert.equal(calls.at(-1).pageContext.label,'Verification Queue');assert.equal(calls.at(-1).message,'Which students have an open financial aid verification, and what is each waiting on?');
  const aidAnchor=calls.at(-1).historyAfter;
  await ask('Which students are affected?');assert.equal(calls.at(-1).historyAfter,aidAnchor);
  await panel.getByRole('button',{name:'Close Edward',exact:true}).click();
  await page.locator('.brew-kpi').filter({has:page.getByRole('button',{name:'Orientation Registered',exact:true})}).locator('.brew-kpi__edward').click();
  const orientation=await ask('Which deposited students have not registered for orientation?');
  assert.notEqual(calls.at(-1).historyAfter,aidAnchor);assert.equal(calls.at(-1).pageContext.label,'Orientation Registered');
  assert.ok(aid.contextReceipts.length||/unavailable|couldn.t|cannot|not available/i.test(aid.message));
  assert.ok(orientation.contextReceipts.length||/unavailable|couldn.t|cannot|not available/i.test(orientation.message));
  await ask('What are my urgent Task Board items?');
  assert.equal(calls.at(-1).message,'What are my urgent Task Board items?');
  await expect(panel.getByRole('button',{name:'Clear card context'})).toHaveCount(0);
  await panel.getByRole('button',{name:'Close Edward',exact:true}).click();
 }
 await page.locator('.edward-launcher').click();await expect(panel).toBeVisible();
 await panel.getByRole('button',{name:'Close Edward',exact:true}).click();
 await page.locator('[data-portal-item="tasks"]').filter({visible:true}).click();
 const frame=page.frameLocator('#approved-task-board');
 for (const avatar of [true,false]) {
  if(!avatar)await page.locator('[data-portal-item="tasks"]').filter({visible:true}).click();
  await frame.locator('.task-card').first().click();
  await frame.locator('[data-action="student-record"]').click();
  const links=frame.locator('[data-student-record]');await expect(links).toHaveCount(2);
  const id=await links.first().getAttribute('data-student-record');
  const studentRequests=[];const observe=r=>{if(r.url().includes('/v1/staff/students'))studentRequests.push(r.url());};
  page.on('request',observe);
  if(avatar)await links.first().click();else {await links.last().focus();await page.keyboard.press('Enter');}
  await expect(page.getByText('Back to all students',{exact:false})).toBeVisible();
  await expect.poll(()=>studentRequests.some(u=>u.includes('studentId='+id))).toBe(true);
  assert.ok(!studentRequests.some(u=>u.includes('limit=7')),'Direct detail does not fetch roster');
  assert.equal(new URL(page.url()).searchParams.get('studentId'),id);
  page.off('request',observe);
 }
 await page.getByText('Back to all students',{exact:false}).click();
 const later=await (await page.request.get(apiBase+'/v1/staff/students?offset=210&limit=7')).json();
 assert.ok(later.total>2000);
 await page.getByPlaceholder('Search by student, ID, or program').fill(later.items[0].externalRef);
 await expect(page.locator('tbody')).toContainText(later.items[0].externalRef);
 await page.goto(base+'/staff?studentId=00000000-0000-4000-8000-000000000000#students');
 await expect(page.getByRole('heading',{name:'Student not found',exact:true})).toBeVisible();
 await page.getByText('Back to all students',{exact:false}).click();
 await expect(page.locator('tbody tr').first()).toBeVisible();
 assert.deepEqual(errors,[]);console.log('PASS inventory, no automatic requests, detail openings, floating launcher, canonical summary links, direct detail, global search');
} finally {await browser.close();}
