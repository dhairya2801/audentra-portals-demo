/** Slow/aborted student reads, PDF paging and optional stored signed originals. */
import assert from 'node:assert/strict';
import {chromium,webkit,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:20000}),base=process.env.PORTAL_BASE||'http://localhost:3000';
for(const engine of [chromium,webkit]){
 const browser=await engine.launch(engine===chromium?{channel:'chrome'}:{});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.request.post(base+'/v1/auth/demo/staff/sign-in-as',{data:{staffRef:'AU-55ff7e408818'}});
  const board=await(await page.request.get(base+'/v1/staff/demo-task-board')).json();
  const card=board.cards.find(c=>c.board==='en-docs'&&c.documents[0]?.mimeType==='application/pdf');
  const record=await(await page.request.get(base+'/v1/staff/students/'+card.student.id)).json();
  const first=record.documents.items.find(d=>d.id===card.documents[0].id),second=record.documents.items.find(d=>d.id!==first.id&&d.mimeType==='application/pdf');
  assert.ok(first&&second);
  const docs=()=>page.getByRole('navigation',{name:'Student record sections'}).getByRole('button',{name:'Documents',exact:true});
  const open=async file=>page.getByRole('region',{name:'Documents content',exact:true}).locator('article').filter({has:page.getByText(file.fileName,{exact:true})}).getByRole('button',{name:'Preview',exact:true}).click();
  const close=()=>page.getByRole('button',{name:'Close document preview',exact:true}).click();
  const ready=async file=>{await expect(page.locator('dialog[open] canvas')).toBeVisible();await expect(page.locator('#student-document-title')).toHaveText(file.fileName);};
  await page.goto(base+'/staff?studentId='+card.student.id+'#students');await docs().click();
  await open(first);await ready(first);
  if(await page.getByRole('navigation',{name:'Document pages'}).count()){
   await page.getByRole('button',{name:'Next page',exact:true}).click();await expect(page.locator('dialog[open] canvas')).toHaveAttribute('aria-label',/Page 2 of/);await expect(page.locator('dialog[open] canvas')).toBeVisible();
   await page.getByRole('button',{name:'Previous page',exact:true}).click();await expect(page.locator('dialog[open] canvas')).toHaveAttribute('aria-label',/Page 1 of/);
  }
  await close();
  let started,release;const pending=new Promise(r=>started=r),stalled=new Promise(r=>release=r);
  await page.route('**'+first.contentUrl,async route=>{started();await stalled;await route.continue().catch(()=>{});});
  await open(first);await pending;await close();await page.unroute('**'+first.contentUrl);
  await open(second);await ready(second);release();await page.waitForTimeout(250);await ready(second);await close();
  await page.route('**'+first.contentUrl,route=>route.abort('failed'));
  await open(first);await expect(page.locator('dialog[open]').getByRole('alert')).toContainText('could not be loaded');await page.unroute('**'+first.contentUrl);
  await page.getByRole('button',{name:'Retry preview'}).click();await ready(first);await close();
  // Advance only the browser timer; no session/database clock is changed.
  await page.clock.install();
  let finish,entered;const hold=new Promise(r=>finish=r),waiting=new Promise(r=>entered=r);
  await page.route('**'+first.contentUrl,async route=>{entered();await hold;await route.continue().catch(()=>{});});
  await open(first);await waiting;await page.clock.fastForward(21000);
  await expect(page.locator('dialog[open]').getByRole('alert')).toContainText('could not be loaded');
  await page.unroute('**'+first.contentUrl);finish();await page.clock.resume();
  await page.getByRole('button',{name:'Retry preview'}).click();await ready(first);await close();
  console.log('PASS',engine.name(),'Student 360 PDF paging, close/switch with delayed response, interrupted request and retry, bounded timeout and retry');
  if(process.env.SIGNED_STUDENT_ID){
   const id=process.env.SIGNED_STUDENT_ID,signedRecord=await(await page.request.get(base+'/v1/staff/students/'+id)).json();
   const signed=signedRecord.documents.items.find(d=>d.signature);
   assert.ok(signed);assert.ok(signed.contentUrl.startsWith('/v1/staff/documents/'));
   const source=await page.request.get(base+signed.contentUrl);assert.equal(source.status(),200);assert.equal(source.headers()['cache-control'],'private, no-store');assert.equal((await source.body()).length,signed.sizeBytes);
   await page.goto(base+'/staff?studentId='+id+'#students');await docs().click();await open(signed);await ready(signed);await close();
   console.log('PASS',engine.name(),'stored signed original through canonical staff endpoint and Student 360 PDF preview');
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
