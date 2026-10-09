import {chromium,expect} from '@playwright/test';
const base=process.env.STUDENT_PORTAL_URL||'http://localhost:3012';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local portal only');
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage({storageState:process.env.STUDENT_SESSION||'/tmp/student-refresh-session.json',viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const errors=[],writes=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/\/v1\/student\/(appointments|financial)/.test(request.url())&&['POST','PUT','PATCH','DELETE'].includes(request.method()))writes.push(request.url());});
const shot=name=>page.screenshot({path:`artifacts/student-meeting-refresh/remaining-${name}.png`,animations:'disabled'});
try{
 await page.goto(base+'/enrollment');
 await expect(page.getByRole('button',{name:/Your momentum,.*points/})).toBeVisible();
 await expect(page.locator('.momentum-card')).toContainText('1,250');
 await page.getByRole('button',{name:'How points work',exact:true}).click();
 await page.locator('#reward-day').fill('5');await expect(page.locator('.reward-example-result')).toContainText('75 points');await shot('points');await page.keyboard.press('Escape');
 const deadline=page.locator('.enrollment-month .has-deadline').first();await deadline.click();await expect(page.locator('.calendar-list-label')).toContainText('Due on');await page.locator('.enrollment-calendar-task').first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'How smart order works'}).click();await expect(page.getByRole('dialog')).toContainText('longest chain');await shot('smart-order');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'How this works',exact:true}).first().click();await page.getByRole('button',{name:'Use sample transcript'}).click();await expect(page.locator('.sample-transcript-result')).toContainText('no document uploaded');await page.keyboard.press('Escape');
 console.log('PASS restored rewards, decay example, deadline calendar, sample transcript and critical-path explanation');
 await page.goto(base+'/appointments');
 await expect(page.locator('.support-service-grid article')).toHaveCount(6);
 for(const card of await page.locator('.support-service-grid article').all()){
  await card.getByRole('button',{name:'Explore times'}).click();
  await expect(page.getByRole('dialog')).toContainText('SAMPLE AVAILABILITY');
  await page.locator('.support-days button').last().click();await page.locator('.support-times button').last().click();
  await page.getByRole('combobox',{name:'What would you like help with?'}).selectOption({index:1});const purpose=await page.locator('.support-purpose option:checked').textContent();
  await page.getByRole('button',{name:'Preview this appointment'}).click();await expect(page.getByRole('dialog')).toContainText('has not booked a real appointment');await expect(page.getByRole('dialog')).toContainText(purpose);
  await page.getByRole('button',{name:'Preview meeting room'}).click();await expect(page.getByRole('dialog')).toContainText('Your conversation space');await page.keyboard.press('Escape');
 }
 await page.goto(base+'/appointments?topic=student_accounts');await expect(page.getByRole('dialog')).toContainText('Student Accounts');await shot('student-accounts');await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});
 await page.locator('.support-service-grid article').filter({hasText:'Counseling & emotional'}).getByRole('button').click();await expect(page.getByRole('dialog')).toContainText('No medical records');await shot('counseling-mobile');await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1440,height:1000});
 console.log('PASS all six added service flows, private intake, Student Accounts routing, mobile');
 await page.goto(base+'/financials');const f=page.frameLocator('iframe');await f.locator('#budget-form').waitFor();
 await expect(f.locator('.src-row').filter({hasText:'Not accepted · potential coverage'})).toHaveCount(2);
 await f.locator('.src-row').filter({hasText:'Tuition'}).first().click();await f.getByRole('slider',{name:'Example credit load'}).fill('9');await expect(f.locator('#tuition-example-rule')).toContainText('part-time');await f.getByRole('slider',{name:'Example credit load'}).fill('21');await expect(f.locator('#tuition-example-rule')).toContainText('overload');await shot('tuition-math');await page.keyboard.press('Escape');
 await f.getByRole('button',{name:'Review offer'}).click();await expect(f.getByRole('dialog')).toContainText('Keeping your grant');await page.keyboard.press('Escape');await f.locator('.kpi2').filter({hasText:'Scholarships & grants'}).getByRole('button').click();await f.getByRole('dialog').getByRole('button',{name:'Award details'}).first().click();await expect(f.getByRole('dialog')).toContainText('Minimum GPA');await expect(f.getByRole('dialog')).toContainText('8 semesters');await shot('scholarship-conditions');await page.keyboard.press('Escape');
 await expect(f.getByRole('spinbutton',{name:'Federal Work-Study amount'})).toHaveAttribute('readonly','');
 await f.getByRole('combobox',{name:'Family allowance period'}).selectOption('day');await f.getByRole('spinbutton',{name:'Family allowance amount'}).fill('10');await f.getByRole('combobox',{name:'Family allowance period'}).selectOption('term');await expect(f.getByRole('spinbutton',{name:'Family allowance amount'})).toHaveValue('1100');
 await page.goto(base+'/financials/aid');await f.locator('.award-row').first().waitFor();
 const grant=f.locator('.award-row').filter({hasText:'Aster Need Grant'});await grant.getByRole('button',{name:'Accept',exact:true}).click();await f.getByRole('button',{name:'Preview acceptance'}).click();await page.keyboard.press('Escape');
 await expect(f.locator('.scenario-banner')).toBeVisible();await expect(grant).toContainText('Accepted · preview');await expect(f.locator('#band')).toContainText('loan offer');
 await f.getByRole('button',{name:'Back to my actual plan'}).click();await expect(f.locator('#band')).toContainText('gift aid');
 await f.getByRole('button',{name:'What if offers expire?'}).click();await expect(grant).toContainText('expired');
 await f.locator('body').evaluate(()=>{location.hash='overview';});await expect(f.locator('path[data-detail="gap"]')).toHaveAttribute('fill',/pending-university-gap/);
 await f.getByRole('button',{name:'Back to my actual plan'}).click();
 await f.locator('body').evaluate(()=>{location.hash='aid';});await f.getByRole('button',{name:'Explore this scenario'}).click();await expect(f.locator('#band')).toContainText('payment');await shot('all-offers');
 await f.getByRole('button',{name:'Back to my actual plan'}).click();await f.getByRole('button',{name:/Exploring options with your family/}).click();await expect(f.getByRole('dialog')).toContainText('Direct Consolidation');await page.keyboard.press('Escape');
 console.log('PASS personalized detail examples, daily units, work-study match, accept/reset/expire scenarios and loan guide');
 await page.goto(base+'/financials/payments');await f.locator('#payment-state-preview').waitFor();
 for(const [value,copy] of [['plan','Your balance has a plan'],['paid','You’re covered this semester'],['credit','A credit, ready'],['refund_received','Your refund has arrived']]){
  await f.locator('#payment-state-preview').selectOption(value);await expect(f.locator('.balance-action')).toContainText(copy);
  if(value==='plan')await expect(f.getByRole('button',{name:'Set up a payment plan',exact:true})).toHaveCount(0);
  await shot('payments-'+value);
 }
 await f.locator('#payment-state-preview').selectOption('credit');await f.getByRole('button',{name:'Choose a refund method'}).click();await f.getByRole('combobox',{name:'Receive by'}).selectOption('Mailed check');await f.getByRole('button',{name:'Preview refund setup'}).click();await page.keyboard.press('Escape');await expect(f.locator('.balance-action')).toContainText('Mailed check');
 console.log('PASS active plan, paid, credit, received-refund and check-selection states');
 expect(writes).toEqual([]);
 expect(errors).toEqual([]);
}finally{await page.unrouteAll({behavior:'wait'});await browser.close();}
