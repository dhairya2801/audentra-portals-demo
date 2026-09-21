import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,expect,request} from '@playwright/test';

// Uploads mutate records: use an explicitly provisioned, disposable database/API/portal.
const base=process.env.PORTAL_BASE;
assert.equal(process.env.CAMILA_UPLOAD_TESTS,'1','Explicitly enable against an isolated test runtime');
assert.ok(base && ['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert.notEqual(new URL(base).port,'3009','Do not run upload tests against the interactive demo');
const output='artifacts/demo-task-board-parity/uploads';await fs.mkdir(output,{recursive:true});
function pdf(){
 const stream='BT /F1 18 Tf 40 740 Td (ADA UPLOAD - ORIGINAL TEST FILE) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 const second='BT /F1 18 Tf 40 740 Td (SECOND ORIGINAL PAGE) Tj ET';
 objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 7 0 R >>',`<< /Length ${second.length} >>\nstream\n${second}\nendstream`);
 let value='%PDF-1.4\n';const offsets=[0];for(const [i,object] of objects.entries()){offsets.push(Buffer.byteLength(value));value+=`${i+1} 0 obj\n${object}\nendobj\n`;}
 const xref=Buffer.byteLength(value);value+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return Buffer.from(value);
}
const staffApi=await request.newContext({baseURL:base}),studentApi=await request.newContext({baseURL:base});
assert.ok((await staffApi.post('/v1/auth/demo/staff/sign-in-as',{data:{staffRef:'AU-55ff7e408818'}})).ok());
assert.ok((await studentApi.post('/v1/auth/demo/sign-in-as',{data:{studentRef:'SYN-000061'}})).ok());
const before=await (await staffApi.get('/v1/staff/demo-task-board')).json();
const browser=await chromium.launch();const errors=[],writes=[];
try{
 const staff=await browser.newPage({storageState:await staffApi.storageState(),viewport:{width:1512,height:982}});
 staff.on('pageerror',error=>errors.push(error.message));
 staff.on('request',req=>{if(req.url().includes('/v1/')&&['POST','PATCH','PUT','DELETE'].includes(req.method()))writes.push(req.url());});
 await staff.goto(base+'/staff#tasks');const board=staff.frameLocator('#approved-task-board');
 await expect(board.locator('[data-task="ENR-184"]')).toContainText('Ada Kettleby');
 const student=await browser.newPage({storageState:await studentApi.storageState()});
 student.on('pageerror',error=>errors.push(error.message));
 await student.goto(base+'/profile?section=documents');
 await student.getByRole('button',{name:/Send Aster a document/}).click();
 const bytes=pdf(),name=`Ada-original-${Date.now()}.pdf`;
 await student.locator('input[type="file"]').setInputFiles({name,mimeType:'application/pdf',buffer:bytes});
 const uploadResult=student.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/v1/student/documents/upload'));
 await student.getByRole('button',{name:'Submit files',exact:true}).click();
 const response=await uploadResult;assert.ok(response.ok(),await response.text());const uploaded=await response.json();
 assert.equal(uploaded.status,'under_review');assert.equal(uploaded.processingMode,'manual_review');assert.ok(!uploaded.extraction);

 let current,card;
 await expect.poll(async()=>{current=await (await staffApi.get('/v1/staff/demo-task-board')).json();card=current.cards.find(c=>c.documents.some(d=>d.id===uploaded.id));return !!card;}).toBe(true);
 assert.equal(current.total,before.total+(before.cards.some(c=>c.board==='en-docs'&&c.student.externalRef==='SYN-000061'&&!c.documents.length)?0:1));
 await expect(board.locator(`[data-task="${card.key}"]`)).toContainText(name,{timeout:25000});
 await board.locator(`[data-task="${card.key}"]`).click();
 await expect(board.locator('.document-file')).toContainText(name);
 await expect(board.locator('.source-caption')).toContainText('simulated');
 await expect(board.locator('[data-original-document] canvas')).toBeVisible();
 const original=await staffApi.get(card.documents[0].contentPath);assert.ok(original.ok());assert.deepEqual(await original.body(),bytes);
 const downloadEvent=staff.waitForEvent('download');await board.getByRole('button',{name:'Download original document',exact:true}).click();
 const download=await downloadEvent;assert.equal(download.suggestedFilename(),name);assert.deepEqual(await fs.readFile(await download.path()),bytes);
 const ink=await board.locator('[data-original-document] canvas').evaluate(canvas=>{
  const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  let dark=0;for(let i=0;i<data.length;i+=4)if(data[i+3]>0&&data[i]<100&&data[i+1]<100&&data[i+2]<100)dark++;
  return dark;
 });assert.ok(ink>20,'The actual PDF must render visible text, not a blank pane');
 await staff.screenshot({path:`${output}/original-pdf.png`});
 await board.getByRole('button',{name:'Next document page',exact:true}).click();
 await expect(board.locator('[data-original-document] canvas')).toHaveAttribute('aria-label',/Page 2 of 2/);
 await board.getByRole('button',{name:'Previous document page',exact:true}).click();
 await expect(board.locator('[data-original-document] canvas')).toHaveAttribute('aria-label',/Page 1 of 2/);
 await board.getByRole('button',{name:'Fit width',exact:true}).click();
 await expect(board.locator('[data-original-document] canvas')).toBeVisible();
 await board.getByRole('button',{name:'100%',exact:true}).click();
 // Processing/review controls remain preview-only, with the original retained.
 await board.getByRole('button',{name:'Extract & run checks',exact:true}).click();
 await expect(board.locator('[data-original-document] canvas')).toBeVisible();
 assert.deepEqual(await (await staffApi.get('/v1/staff/demo-task-board')).json(),current);
 const studentDocuments=await (await studentApi.get('/v1/student/documents')).json();
 assert.equal(studentDocuments.items.find(d=>d.id===uploaded.id).status,'under_review');
 // Failure/retry must never silently substitute the sample document.
 await staff.route('**/v1/staff/documents/*/content',route=>route.fulfill({status:503,json:{error:{message:'Unavailable'}}}));
 await staff.reload();await board.locator(`[data-task="${card.key}"]`).click();
 await expect(board.locator('[data-original-document]')).toContainText('The original file could not be displayed');
 await expect(board.locator('.document-sheet')).toHaveCount(0);
 await staff.unroute('**/v1/staff/documents/*/content');await board.locator('[data-original-document]').getByRole('button',{name:'Retry',exact:true}).click();
 await expect(board.locator('[data-original-document] canvas')).toBeVisible();
 await board.getByRole('button',{name:'Expand document',exact:true}).click();await expect(board.locator('#action-dialog [data-original-document] canvas')).toBeVisible();
 await board.locator('#action-dialog').getByRole('button',{name:'Close',exact:true}).click();
 // Image uploads use the same stored-original transport and render as images.
 await board.getByRole('button',{name:'Close task',exact:true}).click();
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1EAAAAASUVORK5CYII=','base64');
 const imageResponse=await studentApi.post('/v1/student/documents/upload',{headers:{'Idempotency-Key':crypto.randomUUID()},multipart:{file:{name:'Ada-image.png',mimeType:'image/png',buffer:png},category:'identity'}});
 assert.ok(imageResponse.ok(),await imageResponse.text());const imageDoc=await imageResponse.json();
 const imageBoard=await (await staffApi.get('/v1/staff/demo-task-board')).json();
 const imageCard=imageBoard.cards.find(c=>c.documents.some(d=>d.id===imageDoc.id));assert.ok(imageCard);
 await expect(board.locator(`[data-task="${imageCard.key}"]`)).toContainText('Ada-image.png',{timeout:25000});
 await board.locator(`[data-task="${imageCard.key}"]`).click();
 await expect(board.locator('[data-original-document] img')).toHaveAttribute('src',/^blob:/);
 await expect.poll(()=>board.locator('[data-original-document] img').evaluate(img=>img.naturalWidth)).toBe(1);
 assert.deepEqual(await (await staffApi.get(imageCard.documents[0].contentPath)).body(),png);
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
 await fs.writeFile(`${output}/results.json`,JSON.stringify({card:card.key,document:uploaded.id,count:current.total,checks:['student UI upload','stored original bytes','open staff board refresh','real filename and date','original PDF viewer','download bytes','mock parser isolation','file failure and retry','expanded original','image viewer'],writes,errors},null,2));
 console.log('Student upload → Camila card → stored original/download verified; parser and workflow remain simulated.');
}finally{await browser.close();await staffApi.dispose();await studentApi.dispose();}
