/** Read-only screen-state rendering. Replays captured API reads, never writes to
 * an institutional record. The real fresh-account reproduction is documented
 * separately in signup-onboarding.mjs; these fixtures isolate presentation states. */
import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const out='artifacts/ui-refresh/onboarding';
const reads=JSON.parse(await fs.readFile(`${out}/reads.json`,'utf8'));
const original=reads['/v1/student/onboarding'].body;
const steps=['offer','about_you','housing','campus_life','emergency_contacts','family_permissions','review_and_sign','deposit'];
const screens=[['offer',0],['details',1],['contact',1],['housing',2],['health',3],['emergency',4],['permissions',5],['photo',6],['review',6],['deposit',7]];
const browser=await chromium.launch();const results=[];
for(const [screen,index] of screens){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.route('**/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(route.request().method()!=='GET') return route.fulfill({status:503,json:{error:{code:'UI_TEST_WRITE_BLOCKED',message:'Read-only presentation fixture'}}});
  const response=structuredClone(reads[path]||{status:404,body:{error:{code:'NOT_FOUND',message:'No fixture'}}});
  if(path==='/v1/student/onboarding') {response.body.completedSteps=steps.slice(0,index);response.body.currentStep=steps[index];response.body.data={...response.body.data,firstName:'Morgan',lastName:'Alexanderson-Williams',preferredName:'Morgan',personalEmail:'morgan@example.test',mobilePhone:'+12025550179',citizenshipStatus:'us_citizen',housingPreference:'on_campus'};}
  if(path==='/v1/student/dashboard'&&index>0)response.body.offer.status='accepted';
  await route.fulfill({status:response.status,json:response.body});
 });
 await context.addInitScript(({id,screen})=>sessionStorage.setItem(`audentra:onboarding-draft:v2:${id}`,JSON.stringify({data:{},local:{done:screen==='contact'?['details']:[],skipped:['review','deposit'].includes(screen)?['photo']:[]}})),{id:original.studentId,screen});
 const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3000/onboarding');await page.locator('.page-hero h1').waitFor();
 for(const width of [1440,1280,390]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(400);await page.screenshot({path:`${out}/${screen}-${width}.png`,fullPage:true});
  const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,fontSize:getComputedStyle(document.querySelector('.page-hero h1')).fontSize,heading:document.querySelector('.page-hero h1').textContent}));
  expect(metrics.overflow,`${screen} ${width} overflow`).toBe(false);expect(metrics.fontSize).toBe(width===390?'27px':'34px');results.push({screen,width,...metrics,errors});
 }
 await page.setViewportSize({width:1440,height:1000});
 if(screen==='details'){
  await expect(page.getByRole('combobox',{name:'Pronouns, optional'})).toBeDisabled();
  const field=page.locator('input[autocomplete=given-name]');await field.fill('');await page.getByRole('button',{name:'Save and continue'}).click();await expect(page.locator('.step-failed')).toBeVisible();
  await field.fill('Morgan');await field.press('Tab');expect(await page.evaluate(()=>document.activeElement!==document.body)).toBe(true);
  const select=page.getByRole('combobox',{name:'Citizenship status'});await select.click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');await expect(select).toBeFocused();
 }
 if(screen==='offer'){
  await page.getByRole('button',{name:'Ask for help'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.screenshot({path:`${out}/help.png`});for(let i=0;i<12;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement.closest('[role=dialog]'))).toBe(true);}await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'No, I won’t be joining'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.screenshot({path:`${out}/decline.png`});await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});const disclosure=page.getByRole('button',{name:/Steps in this flow/});await disclosure.click();await expect(page.getByRole('navigation',{name:'Steps in this flow'})).toBeVisible();await page.getByRole('button',{name:'Ask for help'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.screenshot({path:`${out}/help-mobile.png`});await page.keyboard.press('Escape');
 }
 if(screen==='housing'){
  await page.getByRole('button',{name:'Look inside'}).first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.screenshot({path:`${out}/housing-drawer.png`});await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Rank this hall'}).first().click();await page.getByRole('button',{name:'Rank this hall'}).first().click();await expect(page.getByRole('complementary',{name:'Your ranked halls'})).toBeVisible();await page.getByRole('button',{name:/Move .* up/}).filter({visible:true}).last().click();await page.screenshot({path:`${out}/housing-ranked.png`,fullPage:true});
 }
 if(screen==='deposit'){
  await page.getByRole('radio',{name:/Ask for a waiver/}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.screenshot({path:`${out}/waiver.png`});await page.keyboard.press('Escape');
 }
 console.log(screen,'passed');await context.close();
}
await fs.writeFile(`${out}/screen-results.json`,JSON.stringify({mode:'Read-only API fixtures; no submissions',results},null,2));await browser.close();console.log(`${results.length} rendered screen/viewport checks passed`);
