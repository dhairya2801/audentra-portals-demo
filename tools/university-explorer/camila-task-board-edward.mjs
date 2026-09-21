import assert from 'node:assert/strict';
import {chromium,expect,request} from '@playwright/test';
const base=process.env.PORTAL_BASE;
assert.equal(process.env.CAMILA_CONNECTED_TESTS,'1');
assert.ok(base&&['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert.equal(new URL(base).port,'3019','Use the isolated test proxy');
const api=await request.newContext({baseURL:base});
assert.ok((await api.post('/v1/auth/demo/staff/sign-in-as',{data:{staffRef:'AU-55ff7e408818'}})).ok());
const initial=await (await api.get('/v1/staff/demo-task-board')).json();
const card=initial.cards.find(c=>c.board==='en-docs'&&c.student.externalRef!=='SYN-000061'&&c.documents.length&&c.priority==='medium');
assert.ok(card,'Needs an unmodified seeded document task');
const browser=await chromium.launch();
try {
 const page=await browser.newPage({storageState:await api.storageState(),viewport:{width:1512,height:982}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/staff#tasks');
 const frame=page.frameLocator('#approved-task-board');
 await expect(page.getByRole('button',{name:/Ask Edward/})).toBeVisible();
 await frame.locator(`[data-task="${card.key}"]`).click();
 await expect(frame.locator('#task-dialog')).toBeVisible();
 await page.getByRole('button',{name:/Ask Edward/}).click();
 await expect(page.locator('#staff-edward-panel')).toBeVisible();
 const panelZ=await page.locator('#staff-edward-panel').evaluate(e=>Number(getComputedStyle(e).zIndex));
 const frameZ=await page.locator('#approved-task-board').evaluate(e=>Number(getComputedStyle(e).zIndex));
 assert.ok(panelZ>frameZ,'Edward remains usable above the expanded task card');
 async function ask(question) {
  await page.locator('#staff-edward-message').fill(question);
  const response=page.waitForResponse(r=>r.url().endsWith('/v1/staff/assistant/messages')&&r.request().method()==='POST',{timeout:180000});
  await page.locator('.edward-send-button').click();
  const r=await response;
  assert.ok(r.ok(),await r.text());
  assert.equal(r.request().postDataJSON().pageContext.workItemKey,card.key);
  return r.json();
 }
 const detail=await ask('What is this task about, and what did the student upload?');
 assert.ok(detail.message.includes(card.documents[0].fileName),detail.message);
 assert.ok(detail.message.includes(card.student.preferredName),detail.message);
 const preview=await ask('Change this task priority to high.');
 assert.equal(preview.actionIntents[0].preview.workItem.key,card.key);
 const before=await (await api.get('/v1/staff/demo-task-board')).json();
 assert.equal(before.cards.find(c=>c.id===card.id).priority,'medium');
 const confirm=page.getByRole('button',{name:'Confirm task update',exact:true});
 if(['strong_confirm','external_confirm'].includes(preview.actionIntents[0].confirmationMode)) {
  await expect(confirm).toBeDisabled();
  await page.getByRole('checkbox',{name:'I reviewed the target, scope, and exact effect.'}).check();
 }
 await confirm.click();
 await expect(page.locator('#staff-edward-panel')).toContainText('Completed',{timeout:30000});
 await expect.poll(async()=>{
  const state=await (await api.get('/v1/staff/demo-task-board')).json();return state.cards.find(c=>c.id===card.id).priority;
 }).toBe('high');
 const iframe=page.frames().find(f=>f.url().includes('/action-center-demo/index.html'));
 await expect.poll(()=>iframe.evaluate(async key=>(await import('./src/store.js')).store.tasks.find(t=>t.key===key).priority,card.key),{timeout:15000}).toBe('High');
 await page.screenshot({path:'/tmp/camila-edward-confirmed-task.png'});
 assert.deepEqual(errors,[]);
 await page.reload();
 await frame.locator(`[data-task="${card.key}"]`).click();
 await page.getByRole('button',{name:/Ask Edward/}).click();
 await expect(page.locator('#staff-edward-panel')).toContainText('Completed',{timeout:30000});
 console.log(JSON.stringify({result:'passed',card:card.key,checks:['launcher on board','launcher above open card','canonical selected-task payload','actual uploaded filename and student','preview does not mutate','confirmed priority persists','iframe canonical refresh','receipt survives reload','no browser errors']}));
} finally {await browser.close();await api.dispose();}
