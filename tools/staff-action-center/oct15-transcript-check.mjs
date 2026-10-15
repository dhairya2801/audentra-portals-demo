// Mutates only the explicitly isolated local UI-test database; never resets records.
import {chromium,expect,request} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const base=process.env.STAFF_BASE_URL||'http://localhost:3012';
assert.equal(process.env.ISOLATED_TRANSCRIPT_TEST,'1');
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output='artifacts/staff-action-center-oct15/transcript';await mkdir(output,{recursive:true});
const api=await request.newContext({baseURL:base});
for(const [path,data] of [['staff/sign-in-as',{staffRef:'AU-55ff7e408818'}],['sign-in-as',{studentRef:'SYN-000061'}]])assert.ok((await api.post('/v1/auth/demo/'+path,{data})).ok());
async function get(path){const response=await api.get(path);assert.ok(response.ok(),`${path}: ${response.status()}`);return response.json();}
const requirements=await get('/v1/student/requirements'),primary=requirements.items.find(r=>r.code==='ada_updated_transcript');assert.ok(primary);
const before=await get('/v1/student/documents');
const browser=await chromium.launch({channel:'chrome'}),context=await browser.newContext({storageState:await api.storageState(),viewport:{width:1440,height:1000}});
context.setDefaultTimeout(30000);
const student=await context.newPage(),staff=await context.newPage(),errors=[];for(const p of [student,staff])p.on('pageerror',e=>errors.push(e.message));
try{
 await staff.goto(base+'/staff#tasks');const frame=staff.frameLocator('#approved-task-board');await frame.locator('.board-heading').waitFor();
 await student.goto(base+'/enrollment');await student.getByRole('heading',{name:'Your enrollment checklist',exact:true}).waitFor();
 let doc;
 if(process.env.TRANSCRIPT_RESUME==='1'){
  doc=before.items.find(d=>d.requirementId===primary.id);assert.ok(doc,'Existing test upload required');
 }else{
  const card=student.getByRole('heading',{name:'Submit your final transcript',exact:true}).locator('xpath=ancestor::article[1]');await expect(card).toHaveCount(1);
  await card.locator('.task-action>button').click();await expect(student).toHaveURL(/ada-updated-transcript/);
  const upload=student.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/v1/student/documents/upload'));
  await student.getByRole('button',{name:'Use demo document',exact:true}).click();
  const response=await upload;assert.ok(response.ok(),`Upload failed: ${response.status()}`);doc=await response.json();assert.equal(doc.requirementId,primary.id);
 }
 await expect.poll(async()=>{doc=(await get('/v1/student/documents')).items.find(d=>d.id===doc.id);return doc.extraction?.status;},{timeout:90000}).toBe('pending_staff');
 assert.equal(doc.extraction.fields.length,0);
 let staffCard;await expect.poll(async()=>{staffCard=(await get('/v1/staff/demo-task-board')).cards.find(c=>c.documents.some(d=>d.id===doc.id));return Boolean(staffCard);},{timeout:30000}).toBe(true);
 await staff.locator(`[data-approved-board="${staffCard.board}"]:visible`).click();
 await frame.locator(`[data-task="${staffCard.key}"]`).first().click({timeout:45000});
 await expect(frame.locator('[data-original-document] canvas')).toBeVisible({timeout:30000});
 const original=await api.get(staffCard.documents.find(d=>d.id===doc.id).contentPath);assert.ok(original.ok());
 assert.deepEqual(await original.body(),await readFile('apps/web/public/demo-documents/ada/transcript.pdf'));
 await frame.getByRole('button',{name:'Run Edward parsing',exact:true}).click();
 await expect.poll(async()=>{doc=(await get('/v1/student/documents')).items.find(d=>d.id===doc.id);return doc.extraction.status;},{timeout:180000,intervals:[1000,2000,5000]}).toBe('completed');
 assert.equal(doc.extraction.institutionName,'Cedar Vale Academy');assert.equal(doc.extraction.courses.length,8);assert.equal(doc.status,'needs_review');
 await expect(frame.locator('.document-value').filter({hasText:'Cedar Vale Academy'})).toBeVisible({timeout:30000});
 await staff.screenshot({path:`${output}/staff-parsed-transcript.png`});
 await student.goto(base+'/enrollment');await student.getByRole('heading',{name:'Your enrollment checklist',exact:true}).waitFor();
 await expect(student.getByRole('heading',{name:'Submit your final transcript',exact:true})).toHaveCount(0);
 const toggle=student.locator('button[aria-controls="enrollment-reviewing"]');
 if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
 await expect(student.getByRole('heading',{name:'Your final transcript is under review',exact:true})).toBeVisible();
 await expect(student.getByText('We’re reviewing your transcript for transfer credit and course planning.',{exact:true})).toBeVisible();
 const after=await get('/v1/student/documents');for(const d of before.items)assert.ok(after.items.some(x=>x.id===d.id),'Historical document retained');
 assert.deepEqual(errors,[]);
 await writeFile(`${output}/results.json`,JSON.stringify({requirementId:primary.id,documentId:doc.id,staffCard:staffCard.key,extractionStatus:doc.extraction.status,courseCount:doc.extraction.courses.length,priorDocumentsRetained:before.items.length,errors},null,2));
 console.log('PASS single transcript card → canonical upload → staff original → real parsing (8 courses) → single under-review card; prior documents retained');
}finally{await browser.close();await api.dispose();}
