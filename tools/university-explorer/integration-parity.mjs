import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const tenant='00000000-0000-7000-8000-000000000003',student='ac2fa509-b4e3-402d-900b-ffb8440fc430',staff='01973261-954a-5019-8e9e-24a699abea7b';
const api='http://127.0.0.1:45619',atlas='http://127.0.0.1:4321';
const headers={'x-demo-tenant-id':tenant,'x-demo-actor-type':'student','x-demo-actor-id':student,'x-demo-student-id':student};
async function json(url,h={}){const r=await fetch(url,{headers:h});if(!r.ok)throw Error(`${url}: ${r.status}`);return r.json();}
const [plan,observed]=await Promise.all([json(api+'/v1/student/financial-plan',headers),json(atlas+'/api/financial-plan?student_id='+student)]);
expect(observed).toEqual(plan);
const [queue,atlasQueue]=await Promise.all([json(api+'/v1/staff/work-board',{'x-demo-tenant-id':tenant,'x-demo-actor-type':'staff','x-demo-actor-id':staff}),json(atlas+'/api/work-board')]);
expect(atlasQueue.cards).toEqual(queue.cards);expect(atlasQueue.projectCounts).toEqual(queue.projectCounts);
expect(atlasQueue.projects).toEqual(queue.projects);expect(atlasQueue.paymentStateCounts).toEqual(queue.paymentStateCounts);
expect((await fetch(atlas+'/api/sandboxes',{method:'POST'})).status).toBe(403);
expect((await fetch(atlas+'/api/scenarios')).status).toBe(403);
const [campus,atlasCampus]=await Promise.all([json(api+'/v1/student/campus-life',headers),json(atlas+'/api/campus-life?student_id='+student)]);
expect(campus.clubs).toHaveLength(12);
for(const key of ['events','clubs','services'])if(key in campus)expect(atlasCampus[key]).toEqual(campus[key]);
const [profile,atlasProfile]=await Promise.all([json(api+'/v1/student/profile',headers),json(atlas+'/api/student-profile?student_id='+student)]);
expect(atlasProfile).toEqual(profile);
const [documents,atlasDocuments,dossier]=await Promise.all([json(api+'/v1/student/documents',headers),json(atlas+'/api/documents?student_id='+student),json(atlas+'/api/students/'+student)]);
expect(dossier.student.id).toBe(student);
const [messages,relationships]=await Promise.all([json(api+'/v1/student/messages',headers),json(atlas+'/api/relationships?student_id='+student)]);
expect(relationships.portalInbox.map(m=>({id:m.id,subject:m.subject,body:m.body,sender:m.sender_name})))
  .toEqual(messages.items.slice(0,50).map(m=>({id:m.id,subject:m.subject,body:m.body,sender:m.senderName})));
for(const document of documents.items) {
  const decisions=atlasDocuments.reviewDecisions.filter(item=>item.documentId===document.id).map(({documentId,...decision})=>decision);
  expect(decisions).toEqual(document.reviewHistory);
}
const staffHeaders={'x-demo-tenant-id':tenant,'x-demo-actor-type':'staff','x-demo-actor-id':staff};
const [staffProfile,atlasStaffProfile]=await Promise.all([json(api+'/v1/staff/me',staffHeaders),json(atlas+'/api/staff-profile')]);
// Request timestamps differ; every institutional/profile field must match.
const {generatedAt: apiGeneratedAt,...staffFacts}=staffProfile;
const {generatedAt: atlasGeneratedAt,...atlasStaffFacts}=atlasStaffProfile;
expect(apiGeneratedAt).toBeTruthy();expect(atlasGeneratedAt).toBeTruthy();
expect(atlasStaffFacts).toEqual(staffFacts);
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1512,height:982}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
const root='artifacts/integration/screenshots/';
try {
await p.setExtraHTTPHeaders({'x-demo-tenant-id':tenant,'x-demo-actor-type':'student','x-demo-actor-id':student,'x-demo-student-id':student});
await p.goto('http://localhost:3009/financials');const f=p.frameLocator('iframe[title*="My Financials"]');await expect(f.locator('#sum-figure')).toHaveText('$0.00',{timeout:45000});await p.screenshot({path:root+'financial-ready.png'});
await f.getByRole('link',{name:'Explore a planning scenario'}).click();await expect(f.getByRole('button',{name:'Preview this scenario'})).toBeVisible();await f.getByRole('button',{name:'Preview this scenario'}).click();await expect(f.locator('#scenario-result')).toContainText('Estimated funding gap',{timeout:30000});await p.screenshot({path:root+'simulator-ready.png'});
await p.goto('http://localhost:3009/campus-life?view=clubs');await expect(p.getByText('Aster Robotics',{exact:true}).first()).toBeVisible({timeout:30000});await p.screenshot({path:root+'campus-clubs.png'});
await p.goto('http://localhost:3009/profile');await expect(p.getByText('About me',{exact:true}).first()).toBeVisible({timeout:30000});await p.screenshot({path:root+'student-profile.png'});
await p.setExtraHTTPHeaders({'x-demo-tenant-id':tenant,'x-demo-actor-type':'staff','x-demo-actor-id':staff});
await p.goto('http://localhost:3009/staff#tasks');const board=p.frameLocator('#approved-task-board');await expect(board.locator('[data-task]').first()).toBeVisible({timeout:45000});await p.screenshot({path:root+'board-canonical.png'});await board.locator('[data-task]').first().click();await expect(board.locator('#task-dialog')).toBeVisible();await p.screenshot({path:root+'board-detail.png'});
await board.locator('[data-close]').click();await p.locator('[data-approved-board="fa-payments"]').filter({visible:true}).first().click();await expect(board.locator('[data-task]').first()).toBeVisible();await expect(board.locator('.board-footer')).toContainText('matching work items');await p.screenshot({path:root+'board-payments.png'});
await p.goto('http://localhost:3009/staff#profile');await p.waitForTimeout(2000);await p.screenshot({path:root+'staff-profile.png'});
await p.goto('http://localhost:3009/staff#morning_brew');await p.waitForTimeout(2000);await p.screenshot({path:root+'morning-brew.png'});
await p.getByRole('button',{name:'Looks good'}).click();await p.getByRole('button',{name:'Make my Morning Brew'}).click();await expect(p.getByRole('heading',{name:/Good Morning Vivian/})).toBeVisible({timeout:30000});await p.screenshot({path:root+'morning-brew-dashboard.png'});
await p.goto('http://127.0.0.1:4321');await expect(p.getByRole('heading',{name:'A living world. A better proving ground.'})).toBeVisible({timeout:30000});await p.screenshot({path:root+'atlas-live.png'});
await p.setViewportSize({width:390,height:844});await p.setExtraHTTPHeaders({'x-demo-tenant-id':tenant,'x-demo-actor-type':'student','x-demo-actor-id':student,'x-demo-student-id':student});await p.goto('http://localhost:3009/financials');await expect(p.frameLocator('iframe[title*="My Financials"]').locator('#sum-figure')).toHaveText('$0.00',{timeout:45000});await p.screenshot({path:root+'financial-mobile.png'});
await fs.writeFile('artifacts/integration/browser-parity-results.json',JSON.stringify({passed:true,errors},null,2));if(errors.length)throw Error(errors.join('\n'));console.log('Browser canonical surfaces and scenario preview passed');
} finally {await b.close();}
