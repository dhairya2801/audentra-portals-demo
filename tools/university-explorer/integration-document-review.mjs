import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
// This mutates only the dedicated test runtime on 45629, never interactive vNext.
const fixture=JSON.parse(await fs.readFile('artifacts/integration/document-review-fixture.json','utf8'));
const tenant='00000000-0000-7000-8000-000000000003',staff='01973261-954a-5019-8e9e-24a699abea7b';
const staffHeaders={'x-demo-tenant-id':tenant,'x-demo-actor-type':'staff','x-demo-actor-id':staff};
const studentHeaders={'x-demo-tenant-id':tenant,'x-demo-actor-type':'student','x-demo-actor-id':fixture.student,'x-demo-student-id':fixture.student};
const api='http://127.0.0.1:45629',atlas='http://127.0.0.1:4329';
const guidance=`Please upload every page of submission ${fixture.key}.`;
const internal='INTERNAL-BROWSER-REVIEW-NOTE';
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1512,height:982}});
try{
 await page.route('**/v1/**',async route=>{const source=new URL(route.request().url());await route.continue({url:api+source.pathname+source.search});});
 await page.setExtraHTTPHeaders(staffHeaders);await page.goto('http://localhost:3009/staff#tasks');
 const board=page.frameLocator('#approved-task-board');await expect(board.locator('[data-task]').first()).toBeVisible({timeout:45000});
 await board.getByRole('textbox',{name:'Search this board'}).fill(fixture.key);
 await expect(board.locator('[data-task="'+fixture.key+'"]')).toBeVisible({timeout:30000});
 await board.locator('[data-task="'+fixture.key+'"]').click();await expect(board.locator('#task-dialog')).toBeVisible();
 await board.getByRole('tab',{name:'Review workspace'}).click();
 const selectedDocument=board.locator('[data-document-id="'+fixture.document+'"]');
 await expect(selectedDocument.getByRole('heading',{name:'Extracted fields'})).toBeVisible();
 const form=board.locator('#review-form');await form.locator('[name=decision]').selectOption('rejected');
 await expect(form.locator('[name=reasonCode]')).toHaveAttribute('required','');
 await form.locator('[name=reasonCode]').selectOption('incomplete');await form.locator('[name=reason]').fill(guidance);await form.locator('[name=internalNote]').fill(internal);
 await page.screenshot({path:'artifacts/integration/screenshots/document-review-preview.png'});
 // Filling and choosing a decision must not mutate evidence before confirmation.
 let documents=await (await fetch(api+'/v1/student/documents',{headers:studentHeaders})).json();
 expect(documents.items.find(d=>d.id===fixture.document).reviewHistory??[]).toEqual([]);
 await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Record document decision'}).click();
 await expect(board.locator('.detail-meta')).toContainText(/correction|changes/i,{timeout:30000});
 await board.getByRole('tab',{name:'Review workspace'}).click();await expect(selectedDocument.getByRole('heading',{name:'Official decision history'})).toBeVisible();
 await expect(selectedDocument.locator('.document-decision-history')).toContainText(guidance);
 await page.screenshot({path:'artifacts/integration/screenshots/document-review-decision.png'});
 documents=await (await fetch(api+'/v1/student/documents',{headers:studentHeaders})).json();
 const decided=documents.items.find(d=>d.id===fixture.document);expect(decided.reviewHistory).toHaveLength(1);expect(decided.reviewHistory[0].note).toBe(guidance);expect(JSON.stringify(documents)).not.toContain(internal);
 const observed=await (await fetch(atlas+'/api/documents?student_id='+fixture.student)).json();
 const decision=observed.reviewDecisions.find(d=>d.documentId===fixture.document);const {documentId,...sharedDecision}=decision;
 expect(documentId).toBe(fixture.document);expect(sharedDecision).toEqual(decided.reviewHistory[0]);expect(JSON.stringify(observed)).not.toContain(internal);
 await page.setExtraHTTPHeaders(studentHeaders);await page.goto('http://localhost:3009/documents');
 await expect(page.getByText(guidance,{exact:false}).first()).toBeVisible({timeout:30000});
 await page.screenshot({path:'artifacts/integration/screenshots/student-document-guidance.png'});
 await page.goto(atlas+'/#student/'+fixture.student);await page.getByRole('tab',{name:'Documents',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Official submission decisions'})).toBeVisible({timeout:30000});await expect(page.getByText(guidance,{exact:true})).toBeVisible();
 await page.screenshot({path:'artifacts/integration/screenshots/atlas-document-history.png'});
 console.log('Confirmed document review, immutable history, staff/student/Atlas parity and internal-note privacy passed');
}finally{await browser.close();}
