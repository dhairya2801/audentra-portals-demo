// Local UI regression: no messages, assignments, or canonical workflow changes are saved.
import {chromium,firefox,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.STAFF_BASE_URL||'http://localhost:3012',engine=process.env.STAFF_BROWSER||'chromium';
const output=`artifacts/staff-action-center-oct12/${engine}`;await mkdir(output,{recursive:true});
const browser=await ({chromium,firefox}[engine]).launch(engine==='chromium'?{channel:'chrome'}:{});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${base}/staff#tasks`);
 await page.getByTitle('Open the staff portal as Camila Abernathy',{exact:true}).click({timeout:30000});
 await page.locator('.staff-topbar').waitFor({timeout:30000});
 await page.goto(`${base}/staff#tasks`);
 await page.locator('#approved-task-board').waitFor({timeout:30000});
 const frame=page.frameLocator('#approved-task-board');await frame.locator('.board-heading').waitFor();
 await page.getByRole('button',{name:'For You',exact:true}).click();await frame.locator('#task-summary').waitFor();
 const f=page.frames().find(f=>f.url().includes('action-center-demo'));
 const sizes=[[320,740],[390,844],[600,900],[768,1024],[1024,768],[1280,800],[1440,1000],[1920,1080],[2560,1440],[844,390]];
 async function geometry(selector){return f.locator(selector).evaluateAll(elements=>elements.filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {name:e.className||e.tagName,width:e.clientWidth,scroll:e.scrollWidth,x:r.x,right:r.right,viewport:innerWidth};}));}
 async function within(selector,label){for(const box of await geometry(selector)){assert.ok(box.x>=-2&&box.right<=box.viewport+2,`${label}: outside viewport ${JSON.stringify(box)}`);assert.ok(box.scroll<=box.width+3,`${label}: clipped content ${JSON.stringify(box)}`);}}
 for(const [width,height] of sizes){
  await page.setViewportSize({width,height});
  await within('#task-summary,.fy-toolbar,.fy-overview,.fy-overview-card,.fy-metrics,.fy-metric,.fy-deadline-legend,.fy-deadline-key,.fy-work,.fy-work-row,.fy-context',`For You ${width}`);
  assert.equal(await frame.locator('.fy-scope-note').count(),0);
  assert.equal(await frame.locator('[data-group]').filter({hasText:'Review documents'}).count(),1);
  assert.equal(await frame.locator('[data-group]').filter({hasText:'Respond to students'}).count(),1);
  await frame.locator('#fy-sort').selectOption('quickest');
  await frame.locator('#fy-sort').selectOption('important');
  await frame.locator('#fy-sort').selectOption('due');
  for(const party of ['student','team','automation','all','completed','me']){
   await frame.locator(`[data-party="${party}"]`).click();
   await expect(frame.locator(`[data-party="${party}"]`)).toHaveAttribute('aria-pressed','true');
   await within('.fy-work,.fy-work-row',`${party} ${width}`);
  }
  const deadlineCounts=await frame.locator('.fy-deadline-key>strong').allTextContents();
  for(const [i,sla] of ['overdue','risk','track','none'].entries()){
   const key=frame.locator(`.fy-deadline-key[data-sla="${sla}"]`);
   await key.click();await expect(key).toHaveAttribute('aria-pressed','true');
   await expect(key).toBeFocused();
   await expect(frame.locator('.fy-filter-status')).toContainText(`${deadlineCounts[i]} open tasks`);
   assert.deepEqual(await frame.locator('.fy-deadline-key>strong').allTextContents(),deadlineCounts);
   const counts=await frame.locator('.fy-work-copy strong b').allTextContents();
   assert.equal(counts.reduce((n,value)=>n+Number(value),0),Number(deadlineCounts[i]));
   if(Number(deadlineCounts[i])===0)await expect(frame.locator('.fy-empty')).toBeVisible();
   else {
    await frame.locator('[data-group]').first().click();
    await expect(frame.locator('.detail-navigation>span').first()).toContainText(`of ${counts[0]}`);
    await frame.getByRole('button',{name:'Close task',exact:true}).click();
   }
   await key.focus();await page.keyboard.press('Enter');
   await expect(key).toHaveAttribute('aria-pressed','false');
  }
  await frame.locator('.fy-metric[data-party="student"]').hover();
  await expect(frame.locator('[data-segment="me"]')).toHaveCSS('opacity','0.25');
  await frame.locator('.fy-header').hover();
  await expect(frame.locator('[data-segment="me"]')).toHaveCSS('opacity','1');
  await frame.locator('.fy-insights>summary').click();
  await within('.fy-context,.fy-clocks,.fy-area',`Expanded insights ${width}`);
  await frame.locator('.fy-context details>summary').click();
  await within('.fy-clock-type',`Task type insights ${width}`);
  await frame.locator('.fy-insights>summary').click();
  await frame.locator('#fy-search').fill('no-result-xyz');await expect(frame.locator('.fy-empty')).toBeVisible();
  await frame.locator('#fy-search').fill('');
  const group=frame.locator('[data-group]').filter({hasText:'Respond to students'});
  await group.click();await expect(frame.locator('#task-dialog')).toBeVisible();
  for(let n=0;n<20&&!await frame.locator('#request-guidance').count();n++)await frame.getByRole('button',{name:'Next task',exact:true}).click();
  await expect(frame.locator('.context-panel')).toBeVisible();
  await within('#task-dialog,.rq-workspace,.rq-pane,.rq-mail-headers,.rq-record,.rq-progress',`Request ${width}`);
  assert.equal(await frame.locator('.request-operator,.rq-record').count(),0);
  await expect(frame.locator('.rq-workspace')).not.toContainText(/preview|illustrative|sample/i);
  const draft=`UI check at ${width}px. Keep this draft while moving between tasks.`;
  await frame.locator('#request-guidance').fill(draft);
  await frame.getByRole('button',{name:'Next task',exact:true}).click();
  await frame.getByRole('button',{name:'Previous task',exact:true}).click();
  await expect(frame.locator('#request-guidance')).toHaveValue(draft);
  await frame.locator('[data-request-pane="reply"]').click();
  await expect(frame.locator('.rq-reply h2')).toBeFocused();
  await frame.getByRole('tab',{name:'Workflow',exact:true}).click();
  await frame.locator('.rq-workflow-review [data-request-pane="evidence"]').click();
  await expect(frame.locator('.rq-evidence h2')).toBeFocused();
  await frame.getByRole('tab',{name:/Activity/}).click();
  await frame.getByRole('tab',{name:'Request workspace',exact:true}).click();
  await expect(frame.locator('#request-guidance')).toHaveValue(draft);
  if([390,768,1440,1920].includes(width)){
   await frame.locator('.detail-main').evaluate(e=>e.scrollTop=0);
   await frame.locator('.detail-layout').evaluate(e=>e.scrollTop=0);
   await page.screenshot({path:`${output}/request-${width}.png`});
  }
  await frame.getByRole('button',{name:'Close task',exact:true}).click();
  await expect(group).toBeFocused();
  await frame.locator('[data-explain]').click();await expect(frame.locator('.fy-dialog')).toBeVisible();
  await page.keyboard.press('Tab');assert.ok(await frame.locator('.fy-dialog').evaluate(e=>e.contains(document.activeElement)));
  await page.keyboard.press('Escape');await expect(frame.locator('.fy-dialog')).not.toBeVisible();
  await expect.poll(async()=> (await page.locator('#approved-task-board').boundingBox()).y).toBeGreaterThan(30);
  if([390,768,1440,1920].includes(width)){await frame.locator('#task-summary').evaluate(e=>e.scrollTop=0);await page.screenshot({path:`${output}/for-you-${width}.png`});}
  results.push({width,height,status:'pass'});console.log(`PASS ${engine} ${width}×${height}`);
 }
 // Walk the whole combined queue, including the request/outreach boundary.
 await page.setViewportSize({width:1440,height:1000});
 await frame.locator('[data-group]').filter({hasText:'Respond to students'}).click();
 const queueSize=Number((await frame.locator('.detail-navigation>span').first().innerText()).split('of')[1]);
 const workspaceTypes=new Set();
 for(let i=0;i<queueSize;i++){
  const type=await frame.locator('#task-dialog').getAttribute('data-type');workspaceTypes.add(type);
  if(type==='request')await expect(frame.locator('.rq-workspace')).toBeVisible();
  else if(type==='outreach')await expect(frame.locator('#connected-message-form')).toBeVisible();
  if(i<queueSize-1)await frame.getByRole('button',{name:'Next task',exact:true}).click();
 }
 assert.deepEqual(workspaceTypes,new Set(['request','outreach']));
 await expect(frame.getByRole('button',{name:'Next task',exact:true})).toBeDisabled();
 await frame.getByRole('button',{name:'Close task',exact:true}).click();
 // A preview check cannot be mistaken for confirmation of real delivery.
 await page.setViewportSize({width:1440,height:1000});
 await frame.locator('[data-group]').filter({hasText:'Respond to students'}).click();
 for(let n=0;n<20&&!await frame.locator('#request-guidance').count();n++)await frame.getByRole('button',{name:'Next task',exact:true}).click();
 await frame.locator('[data-request-action="checks"]').click();
 await frame.locator('[data-request-action="coordinate"]').click();
 await expect(frame.getByRole('button',{name:'Send to student portal',exact:true})).toBeEnabled();
 await frame.locator('#request-guidance').fill('Retain this reviewed response if the connection fails.');
 // Intercept only this context's save attempt; no server write occurs.
 await page.route('**/v1/staff/demo-task-board/*/activity',async route=>{
  assert.equal(route.request().method(),'POST');
  await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'REQUEST_FAILED',message:'Unavailable'}})});
 });
 await frame.getByRole('button',{name:'Send to student portal',exact:true}).click();
 await expect(frame.locator('#toast')).toContainText('could not complete');
 await expect(frame.locator('#request-guidance')).toHaveValue('Retain this reviewed response if the connection fails.');
 await expect(frame.getByRole('button',{name:'Send to student portal',exact:true})).toBeEnabled();
 await frame.getByRole('button',{name:'Close task',exact:true}).click();
 await frame.locator('[data-party="me"]').click();
 await frame.locator('#fy-space').selectOption('fa');await expect(frame.locator('.fy-work')).not.toContainText('Enrollment ·');
 await frame.locator('[data-reset]').click();await expect(frame.locator('#fy-owner')).toHaveValue('ML');
 await frame.locator('[data-refresh]').click();await expect(frame.locator('[data-refresh]')).toBeEnabled();
 assert.deepEqual(errors,[]);await writeFile(`${output}/results.json`,JSON.stringify({engine,results,errors},null,2));
 console.log('PASS charts, deadline filters, expanded insights, draft recovery, keyboard and queue navigation; no canonical writes');
}finally{await browser.close();}
