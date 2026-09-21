// Run only with the dedicated audentra_demo_verify API on 45649 (see platform runbook).
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium, expect} from '@playwright/test';
const api=process.env.DEMO_RESET_TEST_API;
assert.equal(api,'http://localhost:45649','Use the isolated reset verification API');
const base='http://localhost:3009';
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1500,height:1080}});
await context.route('**/v1/**',async route=>{
 const url=new URL(route.request().url());
 const response=await route.fetch({url:api+url.pathname+url.search});
 await route.fulfill({response});
});
const req=context.request;
async function read(path){const r=await req.get(api+path);assert.ok(r.ok(),await r.text());return r.json();}
async function signIn(){
 for(const [path,data] of [['/v1/auth/demo/sign-in-as',{studentRef:'SYN-000061'}],['/v1/auth/demo/staff/sign-in-as',{staffRef:'AU-55ff7e408818'}]]){
  const r=await req.post(api+path,{data});assert.ok(r.ok(),await r.text());
 }
}
const page=await context.newPage();const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await signIn();
 assert.equal((await read('/v1/staff/demo/reset')).enabled,true);
 const initial=(await read('/v1/student/bootstrap')).rewards;
 assert.ok(initial);
 const ready=()=>read('/v1/student/requirements').then(d=>d.items.filter(x=>['ready','in_progress','rejected'].includes(x.status)));
 assert.equal((await ready()).length,4);
 await page.goto(base+'/enrollment');
 await expect(page.getByRole('heading',{name:'Your next steps',exact:true})).toBeVisible();
 for(const text of ['Upload your latest transcript','Confirm your emergency contact','Share your first-semester goal','Register for orientation']) await expect(page.getByText(text,{exact:true})).toBeVisible();
 await expect(page.locator('.point-reward')).toHaveCount(4);
 await expect(page.getByRole('button',{name:`Your momentum, ${initial.lifetimePoints} points`})).toBeVisible();
 await fs.mkdir('artifacts/demo-reset',{recursive:true});
 await page.screenshot({path:'artifacts/demo-reset/four-steps.png',fullPage:true});
 const goal=(await ready()).find(x=>x.code==='ada_enrollment_goal');
 await page.goto(base+'/enrollment/requirements/'+goal.slug);
 await expect(page.getByLabel('Your goal')).toBeVisible();
 await page.getByLabel('Your goal').fill('Complete my first semester with confidence.');
 const submit=page.waitForResponse(r=>r.url().endsWith('/responses')&&r.request().method()==='POST');
 await page.getByRole('button',{name:/Submit|Save|Complete/}).last().click();
 const submitted=await submit;assert.ok(submitted.ok(),await submitted.text());
 assert.equal((await ready()).length,3);
 assert.equal((await read('/v1/student/bootstrap')).rewards.lifetimePoints,initial.lifetimePoints+25);
 // Replaying a stale response must not earn another reward.
 await req.post(api+'/v1/student/requirements/'+goal.id+'/responses',{data:{expectedVersion:goal.version,response:{values:{goal:'Duplicate'}}}});
 assert.equal((await read('/v1/student/bootstrap')).rewards.lifetimePoints,initial.lifetimePoints+25);
 const transcript=(await ready()).find(x=>x.code==='ada_demo_transcript');
 await page.goto(base+'/enrollment/requirements/'+transcript.slug);
 const file=await fs.readFile('../platform/apps/api/assets/onboarding/aster-ferpa-release.pdf');
 await page.locator('input[type=file]').setInputFiles({name:'Demo-reset-transcript.pdf',mimeType:'application/pdf',buffer:file});
 const upload=page.waitForResponse(r=>r.url().includes('/v1/student/documents/upload')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Send to Aster',exact:true}).click();
 const uploaded=await upload;assert.ok(uploaded.ok(),await uploaded.text());const doc=await uploaded.json();
 let board=await read('/v1/staff/demo-task-board');
 let card=board.cards.find(x=>x.templateKey==='ENR-184');
 assert.equal(board.total,64);assert.ok(card.documents.some(d=>d.id===doc.id));
 const decision=await req.post(api+'/v1/staff/demo-task-board/documents/'+doc.id+'/decision',{headers:{'Idempotency-Key':crypto.randomUUID()},data:{workItemId:card.id,expectedWorkItemVersion:card.version,decision:'accepted',note:'Original reviewed for reset verification.',notifyStudent:true,originalReviewed:true}});
 assert.equal(decision.status(),201,await decision.text());
 assert.equal((await read('/v1/student/requirements/'+transcript.id)).status,'completed');
 assert.equal((await read('/v1/student/bootstrap')).rewards.lifetimePoints,initial.lifetimePoints+105);
 await page.goto(base+'/staff#tasks');
 await page.getByRole('button',{name:'Reset demo',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Start a fresh demo?'});
 await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.equal((await ready()).length,2);
 await page.getByRole('button',{name:'Reset demo',exact:true}).click();
 const reset=page.waitForResponse(r=>r.url().endsWith('/v1/staff/demo/reset')&&r.request().method()==='POST');
 await dialog.getByRole('button',{name:'Reset demo',exact:true}).click();
 const result=await reset;assert.equal(result.status(),200);
 assert.equal((await req.get(api+'/v1/student/bootstrap')).status(),401);
 assert.equal((await req.get(api+'/v1/staff/me')).status(),401);
 await signIn();
 assert.equal((await ready()).length,4);
 assert.deepEqual((await read('/v1/student/bootstrap')).rewards,initial);
 board=await read('/v1/staff/demo-task-board');card=board.cards.find(x=>x.templateKey==='ENR-184');
 assert.ok(!card.documents.some(d=>d.id===doc.id));
 await page.goto(base+'/enrollment');await expect(page.locator('.point-reward')).toHaveCount(4);
 assert.deepEqual(errors,[]);
 console.log('Passed: four cards, points UI, form +25 once, upload/reflection/review +80, cancel, explicit reset, sign-out, full starting-state restoration.');
}finally{await context.unrouteAll({behavior:'ignoreErrors'});await browser.close();}
