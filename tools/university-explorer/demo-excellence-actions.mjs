// Real browser confirmation and direct manipulation against the isolated seeded DB.
import {chromium,request,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const api='http://127.0.0.1:45649',root='artifacts/demo-excellence/final',staff='01973261-954a-5019-8e9e-24a699abea7b';
const c=await request.newContext({baseURL:api,timeout:120000,extraHTTPHeaders:{'x-demo-tenant-id':'00000000-0000-7000-8000-000000000003'}});
await c.post('/v1/auth/demo/staff/sign-in-as',{data:{staffRef:'AU-55ff7e408818'}});
const b=await chromium.launch(),p=await b.newPage({storageState:await c.storageState(),viewport:{width:1512,height:982}});const evidence=[];
await p.route('**/v1/**',async r=>{const u=new URL(r.request().url());if(u.pathname.endsWith('/events'))return r.abort();u.port='45649';await r.fulfill({response:await r.fetch({url:u.toString()})});});
const read=async key=>(await (await c.get('/v1/staff/work-board?search='+key)).json()).cards[0];
const atlas=async id=>(await (await c.get('http://127.0.0.1:4339/api/work-item?work_item_id='+id)).json()).workItem;
const ask=async message=>{const response=p.waitForResponse(r=>r.url().endsWith('/v1/staff/assistant/messages')&&r.request().method()==='POST',{timeout:120000});await p.locator('#staff-edward-message').fill(message);await p.getByRole('button',{name:'Send message',exact:true}).click();const r=await response;expect(r.status()).toBe(200);return r.json();};
try{
 for(const [key,changes] of [['DEMO-126',{priority:'high',status:'todo',dueAt:'2026-09-14T21:00:00Z'}],['DEMO-129',{assigneeId:null}]]){const item=await read(key);const reset=await c.patch('/v1/staff/work-items/'+item.id,{data:{expectedVersion:item.version,...changes}});expect(reset.ok()).toBeTruthy();}
 await p.goto('http://127.0.0.1:3009/staff#tasks');const f=p.frameLocator('#approved-task-board');await expect(f.locator('[data-task]').first()).toBeVisible({timeout:45000});await p.locator('[data-approved-board="en-requests"]').filter({visible:true}).first().click();await expect(f.locator('[data-task="DEMO-126"]')).toBeVisible();
 await f.getByRole('button',{name:'Work status board',exact:true}).click();await p.locator('.edward-launcher').click();
 for(const [key,message,field,desired] of [
  ['DEMO-126','Change DEMO-126 priority to Low.','priority','Low'],
  ['DEMO-126','Move DEMO-126 to In Progress.','operationalStatus','in_progress'],
  ['DEMO-129','Assign DEMO-129 to me.','owner',staff],
  ['DEMO-126','Change DEMO-126 due date to tomorrow.','due',null],
 ]){
  const before=await read(key);const oldAnswer=await ask('What is the priority, operational status, owner and due date of '+key+'?');const preview=await ask(message);expect(preview.actionIntents?.[0]?.status).toBe('pending_confirmation');expect((await read(key)).version).toBe(before.version);
  await p.screenshot({path:root+'/preview-'+field+'.png'});
  await p.getByRole('checkbox',{name:'I reviewed the target, scope, and exact effect.'}).last().check();
  const confirmation=p.waitForResponse(r=>r.url().includes('/action-intents/')&&r.url().endsWith('/confirm'));await p.getByRole('button',{name:'Confirm task update',exact:true}).last().click();const receipt=await (await confirmation).json();expect(receipt.status).toBe('succeeded');
  const after=await read(key);expect(after.version).toBe(before.version+1);if(desired)expect(after[field]).toBe(desired);else expect(after.due).not.toBe(before.due);
  await expect(f.locator('[data-task="'+key+'"]')).toBeVisible({timeout:15000});
  if(field==='priority')await expect(f.locator('[data-task="'+key+'"]')).toContainText('Low');
  if(field==='operationalStatus')await expect(f.locator('[data-column="in_progress"] [data-task="'+key+'"]')).toBeVisible();
  const observed=await atlas(after.id);expect(observed.priority).toBe(after.priority.toLowerCase());expect(observed.status).toBe(after.operationalStatus);expect(observed.assignee?.id??'TEAM').toBe(after.owner);expect(Date.parse(observed.dueAt)).toBe(Date.parse(after.due));
  const newAnswer=await ask('Read '+key+' again. What is its current priority, operational status, owner and due date?');
  evidence.push({key,message,field,before,after,receiptId:receipt.id,oldAnswer:oldAnswer.message,newAnswer:newAnswer.message,atlasMatches:true});
  await fs.writeFile(root+'/synchronization.json',JSON.stringify(evidence,null,2));
 }
 await p.getByRole('button',{name:'Close Edward',exact:true}).click();await f.locator('[data-task="DEMO-126"]').click();await expect(f.locator('#execution-form')).toBeVisible();await f.locator('#execution-form select[name="priority"]').selectOption('high');await f.locator('#execution-form select[name="status"]').selectOption('todo');await f.getByRole('button',{name:'Save changes',exact:true}).click();await expect(f.locator('#toast')).toContainText('Canonical record saved.');await expect(f.locator('#execution-form select[name="priority"]')).toHaveValue('high');await f.locator('[data-close]').click();
 const afterUi=await read('DEMO-126');expect(afterUi.priority).toBe('High');expect(afterUi.operationalStatus).toBe('todo');expect((await atlas(afterUi.id)).priority).toBe('high');await p.locator('.edward-launcher').click();const answer=await ask('Read DEMO-126 again. What priority and operational status does it have now?');expect(answer.message.toLowerCase()).toContain('high');expect(answer.message.toLowerCase()).toMatch(/to.do|todo/);await p.screenshot({path:root+'/direct-ui-edward-reread.png'});evidence.push({directUi:true,after:afterUi,answer:answer.message,atlasMatches:true});
 await fs.writeFile(root+'/synchronization.json',JSON.stringify(evidence,null,2));console.log('Four preview/confirmation writes plus reverse UI changes passed; Atlas agrees.');
}finally{await p.unrouteAll({behavior:'ignoreErrors'});await b.close();await c.dispose();}
