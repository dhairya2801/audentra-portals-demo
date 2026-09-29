import {chromium, expect} from '@playwright/test';
import fs from 'node:fs/promises';
const base=process.env.PORTAL_BASE||'http://localhost:3000';
const out='artifacts/ui-refresh/interactions'; await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
const context=await browser.newContext({storageState:'artifacts/ui-refresh/session-after.json',viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage(),results=[],errors=[],blockedWrites=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/v1/**',route=>{
  const req=route.request();
  if(!['GET','HEAD','OPTIONS'].includes(req.method())&&!req.url().includes('/activity-events/')) {
    blockedWrites.push({method:req.method(),url:req.url()});return route.abort();
  }
  return route.continue();
});
async function check(name,work){try{await work();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false,error:e.message});console.log('FAIL',name,e.message.slice(0,240));}await fs.writeFile(`${out}/results.json`,JSON.stringify({results,errors,blockedWrites},null,2));}
const shot=name=>page.screenshot({path:`${out}/${name}.png`,fullPage:true});
try {
await check('Task Board: board/list, search, empty state, priority, clear, keyboard details and all detail tabs',async()=>{
  await page.goto(base+'/staff#tasks');const board=page.frameLocator('#approved-task-board');
  await board.locator('[data-task]').first().waitFor({timeout:60000});
  const count=await board.locator('[data-task]').count();
  await board.getByRole('tab',{name:'List',exact:true}).click();
  await expect(board.getByRole('tab',{name:'List',exact:true})).toHaveAttribute('aria-selected','true');
  await shot('board-list');
  await board.getByRole('tab',{name:'Board',exact:true}).click();
  await board.getByRole('textbox',{name:'Search this board'}).fill('NoSuchStudentRefreshCheck');
  await expect(board.locator('[data-task]')).toHaveCount(0);await shot('board-empty');
  await board.locator('[data-action="clear-filters"]').click();
  await expect(board.locator('[data-task]')).toHaveCount(count);
  await board.getByLabel('Priority',{exact:true}).selectOption('Low');
  await expect(board.getByLabel('Priority',{exact:true})).toHaveValue('Low');await shot('board-filtered');
  await board.locator('[data-action="clear-filters"]').click();
  await board.locator('[data-task]').first().focus();await page.keyboard.press('Enter');
  await expect(board.locator('#task-dialog')).toBeVisible();
  for(const tab of await board.locator('[data-detail-tab]').evaluateAll(es=>es.map(e=>e.dataset.detailTab))){await board.locator(`[data-detail-tab="${tab}"]`).click();await expect(board.locator(`[data-detail-tab="${tab}"]`)).toHaveAttribute('aria-selected','true');await shot('task-'+tab);}
  await page.keyboard.press('Escape');await expect(board.locator('#task-dialog')).not.toBeVisible();
});
await check('All seven configured boards remain reachable',async()=>{
  for(const id of ['fa-docs','fa-outreach','fa-payments','en-docs','en-outreach','en-requests','cl-housing']){
    if(id==='cl-housing')await page.locator('[data-board-space="cl"]').filter({visible:true}).click();
    await page.locator(`[data-approved-board="${id}"]`).filter({visible:true}).click();
    await expect(page.locator(`[data-approved-board="${id}"]`).filter({visible:true})).toHaveAttribute('aria-current','page');
    await shot(id);
  }
});
await check('Existing drag/drop on a browser-local outreach preview, with all API writes blocked',async()=>{
  await page.locator('[data-approved-board="en-outreach"]').filter({visible:true}).click();
  const frame=page.frames().find(f=>f.url().includes('/action-center-demo/'));
  const candidate=await frame.evaluate(async()=>{
    const {store}=await import('/action-center-demo/src/store.js');
    const {transitionsFor,columnFor}=await import('/action-center-demo/src/data.js');
    const t=store.tasks.find(t=>t.board==='en-outreach'&&!t.actualDocument&&t.type==='outreach'&&t.status==='identified'&&transitionsFor(t).length);
    if(!t)return null;const to=transitionsFor(t)[0].to;return {key:t.key,from:t.status,to,column:columnFor(to),storage:JSON.stringify(localStorage)};
  });
  expect(candidate).toBeTruthy();
  const card=frame.locator(`[data-task="${candidate.key}"]`),column=frame.locator(`[data-column="${candidate.column}"]`);
  await card.dragTo(column,{sourcePosition:{x:50,y:25},targetPosition:{x:25,y:35}});
  await expect.poll(()=>frame.evaluate(async key=>(await import('/action-center-demo/src/store.js')).store.tasks.find(t=>t.key===key).status,candidate.key)).toBe(candidate.to);
  await shot('drag-drop-local-preview');
  await frame.evaluate(raw=>{localStorage.clear();for(const [k,v] of Object.entries(JSON.parse(raw)))localStorage.setItem(k,v);},candidate.storage);
  await page.reload();
});
await check('Morning Brew: metric, insight, meeting and email dialogs; Escape and focus return',async()=>{
  await page.goto(base+'/staff#morning_brew');await page.locator('.brew-hero').waitFor({timeout:60000});
  for(const [name,selector] of [['metric','.brew-kpi__head .brew-stretch'],['insight','.brew-insight__top .brew-stretch'],['meeting','.brew-calendar-row .brew-stretch'],['email','.brew-email-row .brew-stretch']]){
    const trigger=page.locator(selector).first();await trigger.click();await expect(page.locator('.brew-detail').last()).toBeVisible();
    await page.keyboard.press('Tab');expect(await page.evaluate(()=>Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
    await shot('brew-'+name);await page.keyboard.press('Escape');await expect(page.locator('.brew-detail')).toHaveCount(0);await expect(trigger).toBeFocused();
  }
});
await check('Morning Brew customization: cancel and save browser-local preferences',async()=>{
  await page.goto(base+'/staff#morning_brew');await page.getByRole('button',{name:'Customize brief',exact:true}).click();
  await page.locator('.brew-setup').waitFor();await shot('brew-customize');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('.brew-hero')).toBeVisible();
  await page.getByRole('button',{name:'Customize brief',exact:true}).click();await page.getByRole('button',{name:/Looks good/}).click();
  await page.getByRole('button',{name:/Save it/}).click();await expect(page.locator('.brew-hero')).toBeVisible();
});
await check('Student task drawer, sorting, and requirement form navigation',async()=>{
  await page.goto(base+'/enrollment');await page.getByRole('heading',{name:'Your next steps',exact:true}).waitFor({timeout:60000});
  await page.getByRole('button',{name:'Due soon',exact:true}).click();await shot('enrollment-due-soon');
  await page.getByRole('button',{name:'How this works',exact:true}).first().click();await expect(page.locator('[role="dialog"]').last()).toBeVisible();await shot('enrollment-task-drawer');await page.keyboard.press('Escape');
  const link=page.getByRole('button',{name:/Complete form/}).first();await link.click();await page.locator('.external-panel a').click();await page.waitForTimeout(1500);expect(page.url()).toContain('/enrollment/requirements/');await shot('requirement-form');
});
await check('Financial breakdown dialog and all nine existing sections',async()=>{
  await page.goto(base+'/financials');const f=page.frameLocator('iframe');await f.locator('.kpi2').first().waitFor({timeout:60000});
  await f.getByRole('button',{name:/View breakdown/}).first().click();await expect(f.locator('#pop')).toBeVisible();await shot('financial-breakdown');await page.keyboard.press('Escape');await expect(f.locator('#pop')).not.toBeVisible();
  for(const route of ['/financials/payments','/financials/payments#timeline','/financials/aid','/financials/expenses','/financials/expenses#coverage','/financials/expenses/housing','/financials/expenses/meals','/financials/expenses/simulator']){await page.goto(base+route);await f.locator('#tab-root h2').first().waitFor({timeout:60000});await shot(route.replaceAll('/','-').replace('#','-'));}
});
await check('Phone financial navigation link and staff board horizontal scrolling',async()=>{
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/financials');const f=page.frameLocator('iframe');
  await f.locator('.kpi2').first().waitFor({timeout:60000});await f.getByRole('link',{name:/Review payments/}).click();await expect.poll(()=>page.url()).toContain('/financials/payments');await shot('phone-financial-payments');
  await page.goto(base+'/staff#tasks');const b=page.frameLocator('#approved-task-board');await b.locator('[data-task]').first().waitFor({timeout:60000});
  const scroll=await b.locator('#board-area').evaluate(e=>{const max=e.scrollWidth-e.clientWidth;e.scrollLeft=max;return {max,left:e.scrollLeft};});expect(scroll.max).toBeGreaterThan(0);expect(scroll.left).toBeGreaterThan(0);await shot('phone-board-scrolled');
});
await check('Phone navigation: open, keyboard containment, Escape and focus return',async()=>{
  await page.goto(base+'/enrollment');const trigger=page.getByRole('button',{name:'Open navigation',exact:true});await trigger.click();
  await expect(page.locator('.sidebar-open')).toBeVisible();
  for(let i=0;i<25;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>Boolean(document.activeElement?.closest('.sidebar-open')))).toBe(true);}
  await shot('phone-navigation');await page.keyboard.press('Escape');await expect(page.locator('.sidebar-open')).toHaveCount(0);await expect(trigger).toBeFocused();
});
await check('Enrollment loading/error/retry (isolated failed-read simulation)',async()=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.route('**/v1/student/requirements',async route=>{await new Promise(resolve=>setTimeout(resolve,1200));await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'TEMPORARILY_UNAVAILABLE',message:'Visual review simulated unavailable read'}})});});
  await page.goto(base+'/enrollment');await shot('enrollment-loading');
  const retry=page.getByRole('button',{name:/Try again|Retry/i});await retry.waitFor({timeout:60000});await shot('enrollment-error');
  await page.unroute('**/v1/student/requirements');await retry.click();await page.getByRole('heading',{name:'Your next steps',exact:true}).waitFor({timeout:60000});
  const styles=await page.locator('.page-hero').evaluate(e=>({background:getComputedStyle(e).backgroundImage,fontLoaded:[...document.fonts].some(f=>f.family==='Geist Variable'&&f.status==='loaded')}));
  expect(styles.background).toContain('linear-gradient');expect(styles.fontLoaded).toBe(true);
  expect(await page.locator('.task-action .primary-button').first().evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(106, 56, 255)');
});

} finally {await fs.writeFile(`${out}/results.json`,JSON.stringify({results,errors,blockedWrites},null,2));await browser.close();}
