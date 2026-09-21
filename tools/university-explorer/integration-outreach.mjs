import {chromium,expect} from '@playwright/test';
// Mutations are confined to the separately imported test API on 45629.
const api='http://127.0.0.1:45629',atlas='http://127.0.0.1:4329';
const tenant='00000000-0000-7000-8000-000000000003',staff='01973261-954a-5019-8e9e-24a699abea7b';
const headers={'x-demo-tenant-id':tenant,'x-demo-actor-type':'staff','x-demo-actor-id':staff};
async function json(url,h=headers){const r=await fetch(url,{headers:h});expect(r.ok).toBeTruthy();return r.json();}
const boardData=await json(api+'/v1/staff/work-board?project=en-requests');
const card=boardData.cards.find(c=>!['done','cancelled'].includes(c.operationalStatus));expect(card).toBeTruthy();
const studentHeaders={...headers,'x-demo-actor-type':'student','x-demo-actor-id':card.studentId,'x-demo-student-id':card.studentId};
const subject='Portal outreach check '+Array.from(crypto.getRandomValues(new Uint8Array(10)),x=>String.fromCharCode(97+x%26)).join('');
const body='Your next step remains under review. This message does not complete your institutional case. '+subject;
const before=await json(api+'/v1/student/messages',studentHeaders);
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1512,height:982}});
let sends=0;
try{
 await page.route('**/v1/**',async route=>{
  const source=new URL(route.request().url()),url=api+source.pathname+source.search;
  if(source.pathname.endsWith('/communications')&&route.request().method()==='POST'){
   sends++;
   if(sends===1){const response=await route.fetch({url});expect(response.ok()).toBeTruthy();await response.dispose();await route.abort('failed');return;}
  }
  await route.continue({url});
 });
 await page.setExtraHTTPHeaders(headers);await page.goto('http://localhost:3009/staff#tasks');
 const board=page.frameLocator('#approved-task-board');await expect(board.locator('[data-task]').first()).toBeVisible({timeout:45000});
 await page.locator('[data-approved-board="en-requests"]').filter({visible:true}).first().click();
 await board.getByRole('textbox',{name:'Search this board'}).fill(card.key);
 await board.locator('[data-task="'+card.key+'"]').click();await board.getByRole('tab',{name:'Communications',exact:true}).click();
 let form=board.locator('#outreach-form');await form.locator('[name=outreachSubject]').fill(subject);await form.locator('[name=outreachBody]').fill(body);

 await form.getByRole('button',{name:'Save draft',exact:true}).click();
 await expect.poll(async()=> (await json(api+'/v1/staff/work-items/'+card.id)).outreachDraft?.body,{timeout:30000}).toBe(body);
 await expect(form.getByRole('button',{name:'Save draft',exact:true})).toBeEnabled();
 await expect(board.locator('.draft-state')).toContainText('Saved draft',{timeout:30000});
 const firstSaved=await json(api+'/v1/staff/work-items/'+card.id);expect(firstSaved.outreachDraft.status).toBe('draft');expect(firstSaved.outreachDraft.body).toBe(body);
 expect((await json(atlas+'/api/work-item?work_item_id='+card.id,{})).outreachDraft).toEqual(firstSaved.outreachDraft);
 expect((await json(atlas+'/api/relationships?student_id='+card.studentId,{})).portalInbox.some(m=>m.body===body)).toBe(false);
 await page.screenshot({animations:'disabled',path:'artifacts/integration/screenshots/outreach-saved-draft.png'});
 await page.reload();await expect(board.locator('[data-task]').first()).toBeVisible({timeout:45000});
 await page.locator('[data-approved-board="en-requests"]').filter({visible:true}).first().click();await board.getByRole('textbox',{name:'Search this board'}).fill(card.key);await board.locator('[data-task="'+card.key+'"]').click();await board.getByRole('tab',{name:'Communications',exact:true}).click();
 form=board.locator('#outreach-form');await expect(form.locator('[name=outreachBody]')).toHaveValue(body);
 await form.locator('[name=outreachBody]').fill('Local unsaved edit '+body);
 const changed=await fetch(api+'/v1/staff/work-items/'+card.id+'/outreach-draft',{method:'PUT',headers:{...headers,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({expectedWorkItemVersion:firstSaved.workItem.version,expectedDraftVersion:firstSaved.outreachDraft.version,subject,body:'Concurrent saved edit '+body})});expect(changed.ok).toBeTruthy();
 await form.getByRole('button',{name:'Save draft',exact:true}).click();await expect(board.locator('#toast')).toContainText('could not complete',{timeout:30000});await expect(form.locator('[name=outreachBody]')).toHaveValue('Local unsaved edit '+body);
 await form.getByRole('button',{name:'Reload saved draft',exact:true}).click();await expect(form.locator('[name=outreachBody]')).toHaveValue('Concurrent saved edit '+body,{timeout:30000});
 await form.locator('[name=outreachBody]').fill(body);await form.getByRole('button',{name:'Save draft',exact:true}).click();await expect(board.locator('#toast')).toContainText('Draft saved',{timeout:30000});
 expect(sends).toBe(0);expect((await json(api+'/v1/student/messages',studentHeaders)).items).toEqual(before.items);
 await page.screenshot({animations:'disabled',path:'artifacts/integration/screenshots/outreach-preview.png'});
 await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Send portal message'}).click();
 await expect(board.locator('#toast')).toContainText('could not complete',{timeout:30000});
 form=board.locator('#outreach-form');await expect(form.locator('[name=outreachBody]')).toHaveValue(body);
 await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Send portal message'}).click();
 await expect(board.locator('.conversation').getByText(body,{exact:true})).toBeVisible({timeout:30000});
 expect(sends).toBe(2);await expect(form.locator('[name=outreachBody]')).toHaveValue('');
 const messages=await json(api+'/v1/student/messages',studentHeaders);expect(messages.items.filter(m=>m.body===body)).toHaveLength(1);
 const detail=await json(api+'/v1/staff/work-items/'+card.id);const communications=detail.interactions.flatMap(i=>i.communications).filter(c=>c.body===body);expect(communications).toHaveLength(1);expect(communications[0].deliveryStatus).toBe('delivered');expect(detail.outreachDraft.status).toBe('sent');expect(detail.outreachDraft.communicationId).toBe(communications[0].id);expect(detail.workItem.status).not.toBe('done');
 await page.screenshot({animations:'disabled',path:'artifacts/integration/screenshots/outreach-delivered.png'});
 const operator=await browser.newPage();await operator.goto(atlas+'/#operations?workItem='+card.id);await expect(operator.locator('#live-work-detail').getByText(body,{exact:true})).toBeVisible({timeout:30000});await operator.screenshot({animations:'disabled',path:'artifacts/integration/screenshots/atlas-outreach-draft.png'});await operator.close();
 const observed=await json(atlas+'/api/relationships?student_id='+card.studentId,{});expect(observed.portalInbox.filter(m=>m.body===body)).toHaveLength(1);
 await page.setExtraHTTPHeaders(studentHeaders);await page.goto('http://localhost:3009/messages');await page.getByRole('button').filter({hasText:subject}).click();await expect(page.getByText(body,{exact:true})).toBeVisible({timeout:30000});await page.screenshot({animations:'disabled',path:'artifacts/integration/screenshots/student-outreach-inbox.png'});
 await page.goto(atlas+'/#student/'+card.studentId);await page.getByRole('tab',{name:'Relationships',exact:true}).click();await expect(page.getByText(body,{exact:true})).toBeVisible({timeout:30000});
 await page.screenshot({animations:'disabled',path:'artifacts/integration/screenshots/atlas-outreach.png'});
 console.log('Durable drafts, reload/conflict recovery, confirmed delivery, lost-response retry and portal/Atlas parity passed');
}finally{await browser.close();}
