import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,expect,request} from '@playwright/test';

const base=process.env.PORTAL_BASE;
assert.equal(process.env.CAMILA_CONNECTED_TESTS,'1','Explicitly enable against an isolated database and runtime');
assert.ok(base&&['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert.notEqual(new URL(base).port,'3009','Never mutate the interactive demo in tests');
const output='artifacts/demo-task-board-parity/connected';await fs.mkdir(output,{recursive:true});
function pdf(label){
 const stream=`BT /F1 18 Tf 40 740 Td (${label}) Tj ET`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let value='%PDF-1.4\n';const offsets=[0];for(const [i,o] of objects.entries()){offsets.push(Buffer.byteLength(value));value+=`${i+1} 0 obj\n${o}\nendobj\n`;}
 const xref=Buffer.byteLength(value);value+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return Buffer.from(value);
}
const staffApi=await request.newContext({baseURL:base}),studentApi=await request.newContext({baseURL:base});
assert.ok((await staffApi.post('/v1/auth/demo/staff/sign-in-as',{data:{staffRef:'AU-55ff7e408818'}})).ok());
assert.ok((await studentApi.post('/v1/auth/demo/sign-in-as',{data:{studentRef:'SYN-000061'}})).ok());
const read=async()=>{const r=await staffApi.get('/v1/staff/demo-task-board');assert.ok(r.ok(),await r.text());return r.json();};
const before=await read();assert.equal(before.total,64);assert.equal(before.studentCount,10);
const hero=()=>read().then(x=>x.cards.find(c=>c.templateKey==='ENR-184'));
const first=await hero();const req=first.requirements[0].id;
const browser=await chromium.launch();const errors=[];let checks=0;
try{
 const staff=await browser.newPage({storageState:await staffApi.storageState(),viewport:{width:1512,height:982}});
 const student=await browser.newPage({storageState:await studentApi.storageState(),viewport:{width:1512,height:982}});
 staff.on('pageerror',e=>errors.push(e.message));student.on('pageerror',e=>errors.push(e.message));
 await staff.goto(base+'/staff#tasks');const board=staff.frameLocator('#approved-task-board');
 await board.locator('[data-task="ENR-184"]').click();
 await board.getByRole('tab',{name:/Activity/}).click();
 const message='Camila connected test '+Date.now();
 await board.getByRole('textbox',{name:'Portal message',exact:true}).fill(message);
 await board.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(board.locator('.conversation')).toContainText(message);checks++;
 let current=await hero();const thread=current.conversations[0];
 await student.goto(base+'/help?conversation='+thread.id);
 await expect(student.getByRole('dialog')).toContainText(message);
 const reply='Ada reply '+Date.now();await student.locator('#request-reply').fill(reply);
 await student.getByRole('dialog').getByRole('button',{name:/Send to/}).click();
 await expect(student.getByRole('dialog')).toContainText(reply);
 await expect(board.locator('.conversation')).toContainText(reply,{timeout:25000});checks++;
 const privateNote='Private note '+Date.now();
 await board.getByRole('textbox',{name:'Write a comment'}).fill(privateNote);
 await board.getByRole('button',{name:'Post comment',exact:true}).click();
 await expect(board.locator('.activity-stream')).toContainText(privateNote);
 assert.ok(!JSON.stringify(await (await studentApi.get('/v1/student/help')).json()).includes(privateNote));checks++;
 // A failed send retains the draft, and retry produces exactly one canonical reply.
 const retryText='Retained draft '+Date.now();let fail=true;
 await staff.route('**/v1/staff/demo-task-board/*/activity',async route=>{
   if(fail){fail=false;await route.fulfill({status:503,json:{error:{message:'Temporary failure'}}});}
   else await route.continue();
 });
 await board.getByRole('textbox',{name:'Portal message',exact:true}).fill(retryText);
 await board.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(board.getByRole('textbox',{name:'Portal message',exact:true})).toHaveValue(retryText);
 await expect(board.getByRole('button',{name:'Send message',exact:true})).toBeEnabled();
 await board.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(board.locator('.conversation')).toContainText(retryText);
 assert.equal((await hero()).conversations[0].messages.filter(m=>m.body===retryText).length,1);checks++;
 await staff.unroute('**/v1/staff/demo-task-board/*/activity');
 // Commit succeeds but its response is lost. A refreshed version must reuse the first receipt.
 const uncertain='Committed response lost '+Date.now();let loseResponse=true;
 await staff.route('**/v1/staff/demo-task-board/*/activity',async route=>{
   if(loseResponse){loseResponse=false;const r=await route.fetch();assert.ok(r.ok());await route.fulfill({status:503,json:{error:{message:'Response lost'}}});}
   else await route.continue();
 });
 await board.getByRole('textbox',{name:'Portal message',exact:true}).fill(uncertain);
 await board.getByRole('button',{name:'Send message',exact:true}).click();
 await expect.poll(async()=>(await hero()).conversations[0].messages.filter(m=>m.body===uncertain).length).toBe(1);
 await expect(board.locator('.conversation')).toContainText(uncertain,{timeout:25000});
 await expect(board.getByRole('textbox',{name:'Portal message',exact:true})).toHaveValue(uncertain);
 await board.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(board.getByRole('textbox',{name:'Portal message',exact:true})).toHaveValue('');
 assert.equal((await hero()).conversations[0].messages.filter(m=>m.body===uncertain).length,1);checks++;
 await staff.unroute('**/v1/staff/demo-task-board/*/activity');

 // Normal requirement upload, then reject and resubmit through the actual student UI.
 await student.goto(base+'/enrollment/requirements/ada-updated-transcript');
 async function upload(name,bytes){
  await student.locator('input[type=file]').setInputFiles({name,mimeType:'application/pdf',buffer:bytes});
  const response=student.waitForResponse(r=>r.url().includes('/v1/student/documents/upload')&&r.request().method()==='POST');
  await student.getByRole('button',{name:'Send to Aster',exact:true}).click();
  const r=await response;assert.ok(r.ok(),await r.text());return r.json();
 }
 const initialName='Ada-initial-'+Date.now()+'.pdf';const bytes=pdf('ADA ORIGINAL - INITIAL SUBMISSION');const doc=await upload(initialName,bytes);
 await expect.poll(async()=>(await hero()).documents[0]?.id).toBe(doc.id);
 await board.getByRole('tab',{name:/Review workspace/}).click();
 await expect(board.locator('.document-file')).toContainText(initialName,{timeout:25000});
 await expect(board.locator('[data-original-document]')).toHaveAttribute('data-original-document',doc.id,{timeout:25000});
 await expect(board.locator('[data-original-document] canvas')).toBeVisible();
 assert.deepEqual(await (await staffApi.get((await hero()).documents[0].contentPath)).body(),bytes);checks++;
 await board.getByRole('button',{name:'Request changes',exact:true}).click();
 const modal=board.locator('#action-dialog');
 await modal.getByRole('textbox',{name:'Review message'}).fill('Please include all pages of the transcript.');
 await modal.locator('input[type=checkbox]').check();
 await modal.getByRole('button',{name:'Request changes',exact:true}).click();
 await expect(modal).not.toBeVisible();
 await expect(board.locator('.review-finish')).toContainText('Changes requested');
 let documents=(await (await studentApi.get('/v1/student/documents')).json()).items;
 assert.equal(documents.find(d=>d.id===doc.id).status,'rejected');
 let requirement=await (await studentApi.get('/v1/student/requirements/'+req)).json();assert.equal(requirement.status,'rejected');checks++;
 await student.reload();await expect(student.locator('body')).toContainText('Please include all pages');
 const replacementBytes=pdf('ADA ORIGINAL - REPLACEMENT WITH ALL PAGES');
 const replacement=await upload('Ada-replacement.pdf',replacementBytes);
 await expect(board.locator('.document-file')).toContainText('Ada-replacement.pdf',{timeout:25000});
 current=await hero();assert.equal(current.id,first.id);assert.equal((await read()).total,64);
 assert.ok(current.documents.some(d=>d.id===doc.id));assert.equal(current.documents[0].id,replacement.id);
 assert.deepEqual(await (await staffApi.get(current.documents.find(d=>d.id===doc.id).contentPath)).body(),bytes);
 assert.deepEqual(await (await staffApi.get(current.documents[0].contentPath)).body(),replacementBytes);checks++;
 // Parallel duplicate decisions commit once; a competing stale command is rejected.
 const input={workItemId:current.id,expectedWorkItemVersion:current.version,decision:'accepted',note:'All original pages reviewed and accepted.',notifyStudent:true,originalReviewed:true};
 const key=crypto.randomUUID();const endpoint='/v1/staff/demo-task-board/documents/'+replacement.id+'/decision';
 const responses=await Promise.all([1,2].map(()=>staffApi.post(endpoint,{data:input,headers:{'Idempotency-Key':key}})));
 for(const r of responses)assert.equal(r.status(),201,await r.text());
 const stale=await staffApi.post(endpoint,{data:input,headers:{'Idempotency-Key':crypto.randomUUID()}});assert.equal(stale.status(),409);
 assert.equal((await hero()).documents[0].decisions.length,1);checks++;
 await expect(board.locator('.review-finish')).toContainText('Document approved',{timeout:25000});
 await student.reload();requirement=await (await studentApi.get('/v1/student/requirements/'+req)).json();assert.equal(requirement.status,'completed');
 // Original approved records remain accepted; extraction has never run.
 documents=(await (await studentApi.get('/v1/student/documents')).json()).items;
 const original=documents.find(d=>d.id===replacement.id);assert.equal(original.status,'accepted');assert.ok(!original.extraction);checks++;
 await staff.reload();await board.locator('[data-task="ENR-184"]').click();
 await expect(board.locator('.review-finish')).toContainText('Document approved');
 await board.getByRole('tab',{name:/Activity/}).click();await expect(board.locator('.conversation')).toContainText(reply);
 await staff.screenshot({path:output+'/conversation.png'});
 await board.getByRole('tab',{name:/Review workspace/}).click();await staff.screenshot({path:output+'/review.png'});
 assert.deepEqual(errors,[]);checks++;
 console.log(JSON.stringify({checks,cards:64,students:10,doc:doc.id,replacement:replacement.id,result:'passed'}));
}finally{await browser.close();await staffApi.dispose();await studentApi.dispose();}
