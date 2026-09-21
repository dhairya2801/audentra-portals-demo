import assert from 'node:assert/strict';
import {chromium,expect,request} from '@playwright/test';
const base=process.env.PORTAL_BASE;
assert.equal(process.env.CAMILA_CONNECTED_TESTS,'1');
assert.ok(base&&['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert.notEqual(new URL(base).port,'3009');
const api=await request.newContext({baseURL:base});
assert.ok((await api.post('/v1/auth/demo/staff/sign-in-as',{data:{staffRef:'AU-55ff7e408818'}})).ok());
const initial=await (await api.get('/v1/staff/demo-task-board')).json();
const card=initial.cards.find(c=>c.board==='en-docs'&&c.student.externalRef!=='SYN-000061'&&c.documents[0]?.status==='under_review');
assert.ok(card,'Needs a seeded document awaiting review');
const browser=await chromium.launch();
try{
 const page=await browser.newPage({storageState:await api.storageState(),viewport:{width:1512,height:982}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/staff#tasks');const board=page.frameLocator('#approved-task-board');
 await board.locator(`[data-task="${card.key}"]`).click();
 await expect(board.locator('[data-original-document] canvas')).toBeVisible();
 await board.getByRole('button',{name:'Approve document',exact:true}).click();
 const modal=board.locator('#action-dialog');
 await modal.getByRole('textbox',{name:'Review message'}).fill('Original reviewed by Camila and accepted.');
 // Browser and HTTP both require explicit review of the original.
 await modal.getByRole('button',{name:'Approve document',exact:true}).click();
 await expect(modal).toBeVisible();
 const refused=await api.post('/v1/staff/demo-task-board/documents/'+card.documents[0].id+'/decision',{
  headers:{'Idempotency-Key':crypto.randomUUID()},data:{workItemId:card.id,expectedWorkItemVersion:card.version,
   decision:'accepted',note:'Not confirmed',notifyStudent:true,originalReviewed:false}});
 assert.equal(refused.status(),400);
 await modal.locator('input[type=checkbox]').check();
 await modal.getByRole('button',{name:'Approve document',exact:true}).click();
 await expect(modal).not.toBeVisible();await expect(board.locator('.review-finish')).toContainText('Document approved');
 await expect(board.locator('.sla-remaining')).toContainText('SLA met');
 const after=await (await api.get('/v1/staff/demo-task-board')).json();const saved=after.cards.find(c=>c.id===card.id);
 assert.equal(after.total,64);assert.equal(saved.documents[0].status,'accepted');assert.equal(saved.requirements[0].status,'completed');
 assert.equal(saved.documents[0].decisions.length,1);assert.deepEqual(errors,[]);
 await page.screenshot({path:'artifacts/demo-task-board-parity/connected/approval.png'});
 await board.getByRole('tab',{name:/Activity/}).click();
 const note='Save succeeds but refresh fails '+Date.now();
 await page.route('**/v1/staff/demo-task-board',route=>route.fulfill({status:503,json:{error:{message:'Read unavailable'}}}));
 await board.getByRole('textbox',{name:'Write a comment'}).fill(note);
 await board.getByRole('button',{name:'Post comment',exact:true}).click();
 await expect(board.getByRole('textbox',{name:'Write a comment'})).toHaveValue('');
 await expect(board.getByRole('button',{name:'Post comment',exact:true})).toBeEnabled();
 const committed=await (await api.get('/v1/staff/demo-task-board')).json();
 assert.equal(committed.cards.find(c=>c.id===card.id).activity.filter(e=>e.message===note).length,1);
 await page.unroute('**/v1/staff/demo-task-board');

 console.log(JSON.stringify({approved:card.key,confirmationRequired:true,cardCount:64,result:'passed'}));
}finally{await browser.close();await api.dispose();}
