import {chromium,request,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const api=process.env.DEMO_API||'http://127.0.0.1:45649',base='http://127.0.0.1:3009',root='artifacts/demo-excellence/final';
await fs.mkdir(root,{recursive:true});
const browser=await chromium.launch();const checks=[],errors=[];
for(const role of ['student','staff']){
 const c=await request.newContext({baseURL:api,extraHTTPHeaders:{'x-demo-tenant-id':'00000000-0000-7000-8000-000000000003'}});
 const auth=await c.post('/v1/auth/demo/'+(role==='staff'?'staff/':'')+'sign-in-as',{data:role==='staff'?{staffRef:'AU-55ff7e408818'}:{studentRef:'SYN-000000'}});expect(auth.ok()).toBeTruthy();
 const ctx=await browser.newContext({storageState:await c.storageState(),viewport:{width:1512,height:982}});const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/v1/**',async route=>{const u=new URL(route.request().url());if(u.pathname.endsWith('/events'))return route.abort();u.port=new URL(api).port;await route.fulfill({response:await route.fetch({url:u.toString()})});});
 const snap=async name=>{await p.screenshot({path:root+'/'+name+'.png',fullPage:true});checks.push(name);};
 if(role==='student'){
  await p.goto(base+'/financials');const f=p.frameLocator('iframe[title*="My Financials"]');await expect(f.locator('#sum-figure')).toHaveText('$7,697.50',{timeout:45000});
  await snap('financials-initial');
  for(const [tab,path] of Object.entries({overview:'/financials',payments:'/financials/payments',expenses:'/financials/expenses',aid:'/financials/aid',housing:'/financials/expenses/housing',meals:'/financials/expenses/meals',coverage:'/financials/expenses#coverage',simulator:'/financials/expenses/simulator'})){await p.goto(base+path);await expect(f.locator('#sum-figure')).toHaveText('$7,697.50',{timeout:45000});await snap('financials-'+tab);}
  for(const path of ['profile','dashboard','classrooms','documents','housing','appointments','campus-life?view=clubs']){await p.goto(base+'/'+path);await p.waitForTimeout(1200);await snap('student-'+path.split('?')[0]);}
  await p.setViewportSize({width:390,height:844});await p.goto(base+'/financials');await expect(f.locator('#sum-figure')).toHaveText('$7,697.50',{timeout:45000});await snap('financials-mobile');
 }else{
  await p.goto(base+'/staff#tasks');const f=p.frameLocator('#approved-task-board');await expect(f.locator('[data-task]').first()).toBeVisible({timeout:45000});
  for(const project of ['fa-docs','fa-outreach','fa-payments','en-docs','en-outreach','en-requests','cl-housing']){
   if(project==='cl-housing')await p.locator('[data-board-space="cl"]').filter({visible:true}).first().click();
   await p.locator('[data-approved-board="'+project+'"]').filter({visible:true}).first().click();await expect(f.locator('.board-footer')).toContainText('5 matching work items');await expect(f.locator('[data-task]')).toHaveCount(5);await snap(project+'-board');
   const key={'fa-docs':'DEMO-101','fa-outreach':'DEMO-106','fa-payments':'DEMO-111','en-docs':'DEMO-116','en-outreach':'DEMO-121','en-requests':'DEMO-126','cl-housing':'DEMO-131'}[project];await f.locator('[data-task="'+key+'"]').click();await expect(f.locator('#task-dialog')).toBeVisible();await snap(project+'-drawer');await f.locator('[data-close]').click();
  }
  await f.getByRole('tab',{name:'List',exact:true}).click();await snap('board-list');
  await p.goto(base+'/staff#students');await expect(p.getByText('Wren Halloway',{exact:true}).first()).toBeVisible({timeout:30000});await p.waitForTimeout(2000);await snap('student360');await p.getByText('Student workspace · documents, requirements & communications',{exact:true}).click();await snap('student360-workspace');await p.getByRole('region',{name:'Student at a glance'}).getByRole('button',{name:'Ask Edward'}).click();await expect(p.locator('#staff-edward-message')).toHaveValue(/Wren Halloway/);await p.getByRole('button',{name:'Close Edward',exact:true}).click();
  await p.goto(base+'/staff#profile');await p.waitForTimeout(1500);await snap('staff-profile');
  await p.goto(base+'/staff#morning_brew');await p.waitForTimeout(1500);await snap('morning-brew');
  await p.goto(base+'/staff#tasks');await expect(f.locator('[data-task]').first()).toBeVisible({timeout:30000});await fs.writeFile(root+'/staff-controls.txt',await p.locator('body').innerText());
  await p.setViewportSize({width:390,height:844});await snap('board-mobile');await p.goto(base+'/staff#students');await expect(p.getByText('Wren Halloway',{exact:true}).first()).toBeVisible({timeout:30000});await p.waitForTimeout(1000);await snap('student360-mobile');
 }
 await p.unrouteAll({behavior:'ignoreErrors'});await ctx.close();await c.dispose();
}
await browser.close();await fs.writeFile(root+'/browser-results.json',JSON.stringify({checks,errors},null,2));expect(errors).toEqual([]);console.log('Verified',checks.length,'screens');
