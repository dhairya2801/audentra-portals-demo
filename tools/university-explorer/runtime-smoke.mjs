/** Browser verification against the local v3 API; never invokes an AI provider. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const origin=process.env.UNIVERSITY_PORTAL_URL || 'http://localhost:3000';
const output=new URL('../../artifacts/university-explorer/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({extraHTTPHeaders:{
  'x-demo-tenant-id':'00000000-0000-7000-8000-000000000003',
  'x-demo-student-id':'ac2fa509-b4e3-402d-900b-ffb8440fc430',
  'x-demo-actor-id':'ac2fa509-b4e3-402d-900b-ffb8440fc430',
}});
const page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try {
  for(const path of ['/dashboard','/classrooms','/financials']){
    await page.goto(origin+path);
    await page.getByRole('heading',{name:'My university record',exact:true}).waitFor({timeout:30000});
    const reminder=page.getByRole('button',{name:'Remind me later',exact:true});
    if(await reminder.isVisible()) await reminder.click();
    assert.match(await page.locator('body').innerText(),/Computer Science/);
    await page.screenshot({path:new URL(path.slice(1)+'-runtime.png',output).pathname,fullPage:true});
    console.log(path+' university record rendered');
  }
  await context.setExtraHTTPHeaders({
    'x-demo-tenant-id':'00000000-0000-7000-8000-000000000003',
    'x-demo-actor-type':'staff','x-demo-actor-id':'01973261-954a-5019-8e9e-24a699abea7b',
  });
  await page.goto(origin+'/staff');
  await page.getByRole('heading',{name:'My university operations',exact:true}).waitFor({timeout:30000});
  assert.match(await page.locator('body').innerText(),/Academic Advising Center case review/);
  await page.screenshot({path:new URL('staff-runtime.png',output).pathname,fullPage:true});
  const catalogReady=page.waitForResponse(response=>response.url().includes('/api/edward-lab/tools'));
  await page.goto(origin+'/dev/staff-edward');
  assert.equal((await catalogReady).status(),200,'Lab must reach the authenticated runtime tool catalog');
  await page.getByRole('tab',{name:'Architecture',exact:true}).click();
  await page.getByRole('region',{name:'University evidence architecture'}).waitFor();
  assert.match(await page.locator('body').innerText(),/Institutional document evidence/);
  await page.screenshot({path:new URL('lab-runtime.png',output).pathname,fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Student portals, staff operations and Edward Lab architecture passed; no browser errors.');
} finally { await browser.close(); }
