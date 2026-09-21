import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, expect, request } from '@playwright/test';

const base = process.env.PORTAL_BASE || 'http://localhost:3009';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output = 'artifacts/demo-task-board-parity/identities';
await fs.mkdir(output,{recursive:true});
const expectedCounts = {'en-docs':19,'en-outreach':8,'en-requests':7,'fa-docs':9,'fa-outreach':8,'fa-payments':8,'cl-housing':5};
const api = await request.newContext({baseURL:base});
const personas = await (await api.get('/v1/auth/demo/personas')).json();
assert.equal(personas.restricted,true);
assert.deepEqual(personas.students.map(p=>p.externalRef),['SYN-000061']);
assert.deepEqual(personas.staff.map(p=>p.name),['Camila Abernathy']);
for(const [path,data] of [['/v1/auth/demo/sign-in-as',{studentRef:'SYN-000000'}],['/v1/auth/demo/staff/sign-in-as',{staffRef:'AU-01d359a26056'}]]) {
  const response=await api.post(path,{data});assert.ok([403,404].includes(response.status()),`${path}: ${response.status()}`);
}
const login=await api.post('/v1/auth/demo/staff/sign-in-as',{data:{staffRef:'AU-55ff7e408818'}});
assert.ok(login.ok());
const record=await (await api.get('/v1/staff/demo-task-board')).json();
assert.equal(record.total,64);assert.equal(record.studentCount,10);
assert.equal(record.cards.find(c=>c.key==='ENR-184').student.externalRef,'SYN-000061');
const manifest=JSON.parse(await fs.readFile('apps/web/public/action-center-demo/source-manifest.json','utf8'));
const css=await fs.readFile('apps/web/public/action-center-demo/styles.css');
assert.equal(createHash('sha256').update(css).digest('hex'),manifest.files['styles.css']);
const browser=await chromium.launch();const errors=[],writes=[];
try{
  const page=await browser.newPage({storageState:await api.storageState(),viewport:{width:1512,height:982}});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',req=>{if(req.url().includes('/v1/') && ['POST','PATCH','PUT','DELETE'].includes(req.method()))writes.push(req.url());});
  await page.goto(base+'/staff#tasks');const board=page.frameLocator('#approved-task-board');
  await expect(board.locator('[data-task="ENR-184"]')).toContainText('Ada Kettleby');
  const screenshots=[];
  for(const [id,count] of Object.entries(expectedCounts)){
    if(id==='cl-housing')await page.locator('[data-board-space="cl"]').filter({visible:true}).click();
    const nav=page.locator(`[data-approved-board="${id}"]`).filter({visible:true});await nav.click();await expect(nav).toHaveAttribute('aria-current','page');
    await expect(board.locator('[data-task]')).toHaveCount(count);
    for(const card of record.cards.filter(c=>c.board===id)){
      const element=board.locator(`[data-task="${card.key}"]`);await expect(element).toContainText(card.student.name);await expect(element).toContainText(card.student.program);
    }
    await page.screenshot({path:`${output}/${id}.png`});screenshots.push(id);
    await board.locator('[data-task]').first().click();
    for(const tab of ['workspace','activity','workflow']){await board.locator(`[data-detail-tab="${tab}"]`).click();await expect(board.locator('#task-dialog')).toBeVisible();}
    await board.getByRole('button',{name:'Close task',exact:true}).click();
  }
  const frame=page.frames().find(f=>f.url().includes('/action-center-demo/'));
  const bindings=await frame.evaluate(async()=>{const {store}=await import('./src/store.js');return store.tasks.map(t=>({key:t.key,id:t.workItemId,student:t.studentRecordId}));});
  assert.deepEqual(bindings,record.cards.map(c=>({key:c.key,id:c.id,student:c.student.id})));
  await page.locator('[data-approved-board="en-docs"]').filter({visible:true}).click();
  await board.locator('[data-task="ENR-184"]').click();
  await expect(board.locator('.context-student')).toContainText('Ada Kettleby');
  await expect(board.locator('.context-student')).toContainText('SYN-000061');
  await expect(board.locator('#task-dialog')).not.toContainText('Maya');
  await board.locator('[data-detail-tab="activity"]').click();
  await board.getByRole('textbox',{name:'Write a comment'}).fill('Preview-only note');await board.getByRole('button',{name:'Post comment',exact:true}).click();
  await expect(board.locator('#task-dialog')).toContainText('Camila Abernathy');
  // A cached display name must never override a fresh backend identity.
  await frame.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('audentra.demo-board.preview:'));const state=JSON.parse(localStorage.getItem(key));state.tasks.find(t=>t.key==='ENR-184').student='Stale browser identity';localStorage.setItem(key,JSON.stringify(state));});
  await page.reload();await board.locator('[data-task="ENR-184"]').click();await board.locator('[data-detail-tab="activity"]').click();
  await expect(board.locator('#task-dialog')).toContainText('Preview-only note');await expect(board.locator('.context-student')).toContainText('Ada Kettleby');
  await board.getByRole('button',{name:'Close task',exact:true}).click();await board.getByRole('button',{name:'Reset demo',exact:true}).click();await board.locator('#action-dialog').getByRole('button',{name:'Reset demo',exact:true}).click();
  await board.locator('[data-task="ENR-184"]').click();await board.locator('[data-detail-tab="activity"]').click();await expect(board.locator('#task-dialog')).not.toContainText('Preview-only note');await expect(board.locator('.context-student')).toContainText('Ada Kettleby');
  await board.getByRole('button',{name:'Close task',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${output}/mobile.png`});
  await page.route('**/v1/staff/demo-task-board',route=>route.fulfill({status:503,json:{message:'Unavailable'}}));await page.reload();await expect(board.getByRole('heading',{name:'Task board unavailable'})).toBeVisible();await expect(board.locator('[data-task]')).toHaveCount(0);await page.unroute('**/v1/staff/demo-task-board');await board.getByRole('button',{name:'Retry',exact:true}).click();await expect(board.locator('[data-task="ENR-184"]')).toContainText('Ada Kettleby');
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  assert.deepEqual(await (await api.get('/v1/staff/demo-task-board')).json(),record);
  const studentPage=await browser.newPage();await studentPage.goto(base+'/sign-in');await expect(studentPage.getByRole('button',{name:/Continue as Ada/})).toBeVisible();await studentPage.getByRole('button',{name:/Continue as Ada/}).click();await expect.poll(()=>studentPage.url()).not.toContain('/sign-in');
  const studentMe=await studentPage.request.get(base+'/v1/student/profile');assert.ok(studentMe.ok());assert.equal((await studentMe.json()).externalRef,'SYN-000061');
  await fs.writeFile(`${output}/results.json`,JSON.stringify({cards:64,students:10,boards:expectedCounts,checks:['restricted sign-in','backend IDs','all card identities','detail tabs','preview isolation','cache rehydration','reset','mobile','failure/retry','Ada sign-in'],screenshots,writes,errors},null,2));
  console.log('64 backend-linked cards, ten students, restricted identities and preview isolation verified.');
}finally{await browser.close();await api.dispose();}
