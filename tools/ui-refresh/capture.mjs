import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const phase=process.env.PHASE||'before';
const out=`artifacts/ui-refresh/${phase}`; await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();const base=process.env.PORTAL_BASE||'http://localhost:3000';
page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
const shot=async name=>{await page.waitForTimeout(2500);await page.screenshot({path:`${out}/${name}.png`,fullPage:true});console.log(name, page.url(),(await page.locator('body').innerText()).slice(0,160));};
await page.goto(base+'/sign-in');await page.getByRole('button',{name:/Continue as Ada/}).waitFor({timeout:90000});await shot('student-sign-in');
await page.getByRole('button',{name:/Continue as Ada/}).click();await page.waitForURL('**/enrollment',{timeout:60000});await page.getByRole('heading',{name:'Your next steps',exact:true}).waitFor({timeout:90000});await shot('student-enrollment');
await page.locator('.edward-launcher').click();await page.waitForTimeout(2000);await shot('student-edward');await page.locator('.edward-panel').screenshot({path:`${out}/student-edward-panel.png`}).catch(()=>{});
console.log('EDWARD',await page.locator('[class*=edward]').evaluateAll(es=>es.filter(e=>e.getAttribute('role')==='dialog').map(e=>e.className)));
await page.goto(base+'/financials');await page.waitForTimeout(10000);await shot('student-financials');
await page.goto(base+'/staff');await page.getByRole('button',{name:/Camila Abernathy/}).waitFor({timeout:60000});await shot('staff-sign-in');await page.getByRole('button',{name:/Camila Abernathy/}).click();await page.locator('.staff-shell--workspace').waitFor({timeout:90000});
await shot('staff-brew-setup');
if (await page.getByRole('button',{name:/Looks good/}).count()) {
  await page.getByRole('button',{name:/Looks good/}).click();
  await page.getByRole('button',{name:/Make my Morning Brew/}).click();
}
await page.locator('.brew-hero').waitFor({timeout:90000});await shot('staff-brew');
await context.storageState({path:`artifacts/ui-refresh/session-${phase}.json`});
await page.getByRole('button',{name:/^Task Board/}).filter({visible:true}).click();
const board=page.frameLocator('#approved-task-board');await board.locator('[data-task]').first().waitFor({timeout:90000});await shot('staff-board');
await board.locator('[data-task]').first().click();await board.locator('#task-dialog').waitFor();await shot('staff-task-detail');await page.keyboard.press('Escape');
await page.getByRole('button',{name:'Student 360',exact:true}).filter({visible:true}).click();await page.locator('.student360-layout').waitFor({timeout:90000});await shot('staff-student360');
for (const width of [1280,390]) {
  await page.setViewportSize({width,height:900});
  await page.goto(base+'/enrollment');await page.getByRole('heading',{name:'Your next steps',exact:true}).waitFor({timeout:90000});await shot(`student-enrollment-${width}`);
  await page.goto(base+'/financials');await page.waitForTimeout(10000);await shot(`student-financials-${width}`);
}
console.log((await page.locator('body').innerText()).slice(0,7000));
await context.storageState({path:`artifacts/ui-refresh/session-${phase}.json`});if(phase==='after') await context.storageState({path:'artifacts/ui-refresh/session.json'});await browser.close();
