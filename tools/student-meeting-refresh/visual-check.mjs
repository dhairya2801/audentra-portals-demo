import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const base=process.env.STUDENT_PORTAL_URL || 'http://localhost:3012';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local portal required.');
const out='artifacts/student-meeting-refresh';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000},storageState:process.env.STUDENT_SESSION || '/tmp/student-refresh-session.json',reducedMotion:'reduce'});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const [name,path] of [['enrollment','/enrollment'],['appointments','/appointments'],['financials','/financials'],['aid','/financials/aid'],['payments','/financials/payments']]) {
 await page.goto(base+path);await page.waitForTimeout(1600);await page.waitForTimeout(350);await page.screenshot({animations:'disabled',path:`${out}/${name}-desktop.png`,fullPage:true});
 if(name==='appointments'){await page.getByRole('button',{name:'Find a time'}).first().click();await page.getByRole('group',{name:'Available times'}).waitFor();await page.waitForTimeout(350);await page.screenshot({animations:'disabled',path:`${out}/booking-desktop.png`});await page.keyboard.press('Escape');}
 if(name==='aid'){const f=page.frameLocator('iframe');await f.getByRole('button',{name:'Choose amount',exact:true}).first().click();await f.getByRole('dialog').waitFor();await page.waitForTimeout(350);await page.screenshot({animations:'disabled',path:`${out}/loan-desktop.png`});await page.keyboard.press('Escape');}
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);await page.screenshot({animations:'disabled',path:`${out}/${name}-mobile.png`,fullPage:true});
 if(name==='appointments'){await page.getByRole('button',{name:'Find a time'}).first().click();await page.getByRole('group',{name:'Available times'}).waitFor();await page.waitForTimeout(350);await page.screenshot({animations:'disabled',path:`${out}/booking-mobile.png`});await page.keyboard.press('Escape');}
 await page.setViewportSize({width:1440,height:1000});
}
console.log(JSON.stringify({errors}));await browser.close();
