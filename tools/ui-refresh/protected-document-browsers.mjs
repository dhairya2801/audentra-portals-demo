/** Read-only real Chrome/WebKit checks. No files, cookies or document screenshots are saved. */
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {chromium,webkit,expect as baseExpect,devices} from '@playwright/test';
const expect=baseExpect.configure({timeout:20000});
const base=process.env.PORTAL_BASE||'http://localhost:3000';
for(const engine of [chromium,webkit].filter(e=>!process.env.BROWSER_ENGINE||e.name()===process.env.BROWSER_ENGINE)) {
 const browser=await engine.launch(engine===chromium?{channel:'chrome'}:{});
 try {
  for(const mobile of [false,true].filter(m=>!process.env.VIEWPORT_MODE||process.env.VIEWPORT_MODE===(m?'mobile':'desktop'))) {
   const context=await browser.newContext(mobile?devices['iPhone 13']:{viewport:{width:1440,height:1000}});
   const page=await context.newPage();page.setDefaultTimeout(20000);
   const errors=[],requests=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(r.url().includes('/documents/')&&r.url().endsWith('/content'))requests.push(r.url());});
   await page.addInitScript(()=>{window.__boardReplies=[];window.addEventListener('message',e=>{if(e.data?.type==='audentra:board:response')window.__boardReplies.push({parent:e.source===parent,origin:e.origin===location.origin});});});
   const login=async()=>assert.ok((await page.request.post(base+'/v1/auth/demo/staff/sign-in-as',{data:{staffRef:'AU-55ff7e408818'}})).ok());
   await login();
   const snapshot=await(await page.request.get(base+'/v1/staff/demo-task-board')).json();
   const cards=snapshot.cards.filter(c=>c.board==='en-docs'&&c.documents[0]?.mimeType==='application/pdf');
   assert.ok(cards.length>=2);
   const frame=page.frameLocator('#approved-task-board');
   const boardReady=()=>expect(frame.locator('[data-task]').first()).toBeVisible();
   const openBoard=async card=>{
    const target=frame.locator(`[data-task="${card.key}"]`);
    if(mobile){await target.scrollIntoViewIfNeeded();const size=await target.boundingBox();await target.tap({position:{x:20,y:size.height-16}});}
    else await target.click();
   };
   const boardPreview=async card=>{
    const canvas=frame.locator('#task-dialog [data-original-document] canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('aria-label',new RegExp(card.documents[0].fileName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.ok(await canvas.evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i+=4)if(d[i+3]&&d[i]<100&&d[i+1]<100&&d[i+2]<100)return true;return false;}));
   };
   const closeBoard=()=>frame.getByRole('button',{name:'Close task',exact:true}).click();
   await page.route('**/v1/staff/demo-task-board',r=>r.fulfill({status:503,json:{error:{code:'TEMPORARILY_UNAVAILABLE',message:'Test unavailable'}}}));
   await page.goto(base+'/staff#tasks');
   await expect(frame.getByRole('heading',{name:'Task board unavailable'})).toBeVisible();
   await page.unroute('**/v1/staff/demo-task-board');
   await frame.getByRole('button',{name:'Retry',exact:true}).click();await boardReady();
   for(const card of [cards[0],cards[1],cards[0]]) {await openBoard(card);await boardPreview(card);await closeBoard();}
   await page.reload();await boardReady();await openBoard(cards[0]);await boardPreview(cards[0]);
   const downloadReady=page.waitForEvent('download');
   await frame.getByRole('button',{name:'Download original document',exact:true}).click();
   const download=await downloadReady,downloaded=await readFile(await download.path());
   const original=await page.request.get(base+cards[0].documents[0].contentPath);
   const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
   assert.equal(hash(downloaded),hash(await original.body()));
   // Expanding renders the same authorized original, not a synthetic specimen.
   await frame.getByRole('button',{name:'Expand document',exact:true}).click();
   await expect(frame.locator('#action-dialog [data-original-document] canvas')).toBeVisible();
   await frame.locator('#action-dialog').getByRole('button',{name:'Close dialog',exact:true}).click();await closeBoard();
   const replies=await frame.locator('body').evaluate(()=>window.__boardReplies);
   assert.ok(replies.length&&replies.every(r=>r.parent&&r.origin));
   console.log('PASS',engine.name(),mobile?'mobile':'desktop','board load/reload, repeated/switching previews, PDF rendering, expansion, sender verification');

   // Interrupted read, retry, and closure while a slow response is outstanding.
   const routePattern='**/v1/staff/documents/*/content';
   await page.route(routePattern,r=>r.abort('failed'));
   await openBoard(cards[0]);await expect(frame.locator('[data-original-document]')).toContainText('could not be displayed');
   await page.unroute(routePattern);await frame.locator('[data-original-document]').getByRole('button',{name:'Retry',exact:true}).click();await boardPreview(cards[0]);await closeBoard();
   let release;const stalled=new Promise(resolve=>release=resolve);let entered;
   const started=new Promise(resolve=>entered=resolve);
   await page.route(routePattern,async r=>{entered();await stalled;await r.continue().catch(()=>{});});
   await openBoard(cards[0]);await started;await closeBoard();await page.unroute(routePattern);release();
   await openBoard(cards[1]);await boardPreview(cards[1]);await closeBoard();

   // Dropping the staff cookie models expiry without changing server records.
   const staffCookies=await context.cookies();
   await context.clearCookies();
   await openBoard(cards[0]);await expect(frame.locator('[data-original-document]')).toContainText('session has expired');
   await login();await frame.locator('[data-original-document]').getByRole('button',{name:'Retry',exact:true}).click();await boardPreview(cards[0]);await closeBoard();
   assert.ok(staffCookies.some(c=>c.httpOnly));
   console.log('PASS',engine.name(),mobile?'mobile':'desktop','board interrupted/slow reads, close/switch race, expired session, fresh-login retry');

   // Both staff and student cookies coexist; staff preview must still use staff URLs.
   assert.ok((await page.request.post(base+'/v1/auth/demo/sign-in-as',{data:{studentRef:'SYN-000061'}})).ok());
   const studentTab=()=>page.getByRole('navigation',{name:'Student record sections'}).getByRole('button',{name:'Documents',exact:true});
   const closeStudent=()=>page.getByRole('button',{name:'Close document preview',exact:true}).click();
   const studentReady=()=>expect(page.locator('dialog[open] canvas')).toBeVisible();
   for(const card of [cards[0],cards[1]]) {
    await page.goto(base+'/staff?studentId='+card.student.id+'#students');await studentTab().click();
    const previews=page.getByRole('button',{name:'Preview',exact:true});await expect(previews.first()).toBeVisible();
    for(const index of [0,Math.min(1,(await previews.count())-1),0]) {
     await previews.nth(index).click();await studentReady();
     const title=await page.locator('#student-document-title').innerText();
     await expect(page.locator('dialog[open] canvas')).toHaveAttribute('aria-label',new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
     await closeStudent();
    }
   }
   await page.reload();await studentTab().click();await page.getByRole('button',{name:'Preview',exact:true}).first().click();await studentReady();await closeStudent();
   await page.route(routePattern,r=>r.fulfill({status:503,json:{error:{code:'DOCUMENT_STORAGE_UNAVAILABLE',message:'Temporarily unavailable'}}}));
   await page.getByRole('button',{name:'Preview',exact:true}).first().click();await expect(page.locator('dialog[open]').getByRole('alert')).toContainText('could not be loaded');
   await page.unroute(routePattern);await page.getByRole('button',{name:'Retry preview',exact:true}).click();await studentReady();await closeStudent();
   await context.clearCookies();await page.getByRole('button',{name:'Preview',exact:true}).first().click();await expect(page.locator('dialog[open]').getByRole('alert')).toContainText('session has expired');
   await login();await page.getByRole('button',{name:'Retry preview',exact:true}).click();await studentReady();await closeStudent();
   assert.ok(requests.length>10&&requests.every(u=>u.includes('/v1/staff/documents/')));
   assert.deepEqual(errors,[]);
   console.log('PASS',engine.name(),mobile?'mobile':'desktop','Student 360 direct navigation/reload, document/student switching, PDF rendering, storage retry, expiry/login retry, no student-session requests');

   // All current demo uploads are PDFs. Exercise PNG/JPEG renderers with explicit
   // generated response fixtures; these checks do not claim an image upload flow.
   for(const format of ['png','jpeg']) {
    const bytes=await sharp({create:{width:32,height:24,channels:3,background:'#546ca8'}})[format]().toBuffer();
    const image={...cards[0].documents[0],mimeType:'image/'+format,fileName:'preview-regression.'+format,sizeBytes:bytes.length};
    await page.route('**/v1/staff/demo-task-board',async route=>{
     const response=await route.fetch(),data=await response.json();
     for(const c of data.cards)if(c.id===cards[0].id)c.documents=[image];
     await route.fulfill({response,json:data});
    });
    await page.route('**'+image.contentPath,r=>r.fulfill({status:200,contentType:image.mimeType,body:bytes}));
    await page.goto(base+'/staff#tasks');await boardReady();await openBoard(cards[0]);
    const picture=frame.locator('[data-original-document] img');await expect(picture).toBeVisible();
    assert.equal(await picture.evaluate(i=>i.naturalWidth),32);await closeBoard();
    await page.unroute('**/v1/staff/demo-task-board');
    const recordPath='**/v1/staff/students/'+cards[0].student.id;
    await page.route(recordPath,async route=>{
     const response=await route.fetch(),data=await response.json();
     data.documents.items=[{id:image.id,fileName:image.fileName,mimeType:image.mimeType,sizeBytes:bytes.length,category:'other',processingMode:'manual',status:'under_review',createdAt:new Date().toISOString(),contentUrl:image.contentPath}];data.documents.total=1;
     await route.fulfill({response,json:data});
    });
    await page.goto(base+'/staff?studentId='+cards[0].student.id+'#students');await studentTab().click();
    await page.getByRole('button',{name:'Preview',exact:true}).click();
    const studentImage=page.locator('dialog[open] img');await expect(studentImage).toBeVisible();
    assert.equal(await studentImage.evaluate(i=>i.naturalWidth),32);await closeStudent();
    await page.unroute(recordPath);await page.unroute('**'+image.contentPath);
   }
   assert.deepEqual(errors,[]);
   console.log('PASS',engine.name(),mobile?'mobile':'desktop','PNG/JPEG response fixtures in both preview entry points');
   // Explicit access-denial checks go to the real API, not a route fixture.
   const anon=await browser.newContext();
   assert.equal((await anon.request.get(base+cards[0].documents[0].contentPath)).status(),401);
   await anon.request.post(base+'/v1/auth/demo/sign-in-as',{data:{studentRef:'SYN-000061'}});
   assert.equal((await anon.request.get(base+cards[0].documents[0].contentPath)).status(),401);
   await anon.close();
   const missing=await page.request.get(base+'/v1/staff/documents/00000000-0000-4000-8000-000000000000/content');
   assert.equal(missing.status(),404);
   console.log('PASS',engine.name(),mobile?'mobile':'desktop','anonymous/student-only denied; unknown document unavailable');
   await context.close();
  }
 } finally {await browser.close();}
}
