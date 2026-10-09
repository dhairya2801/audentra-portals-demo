// Read-only API variants verify eligibility, links, review reasons and schedule isolation.
import {chromium,expect} from '@playwright/test';
const base=process.env.STUDENT_PORTAL_URL||'http://localhost:3012';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local portal only');
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage({storageState:process.env.STUDENT_SESSION||'/tmp/student-refresh-session.json',viewport:{width:1440,height:1000},reducedMotion:'reduce'});
try{
 await page.route('**/v1/student/onboarding',async route=>{const response=await route.fetch(),data=await response.json();data.data={...data.data,residencyStatus:'domestic',citizenshipStatus:'us_citizen'};await route.fulfill({response,json:data});});
 await page.goto(base+'/appointments');await page.locator('.topic-row').first().waitFor();await expect(page.locator('.topic-row').filter({hasText:'International check-in'})).toHaveCount(0);
 await page.getByRole('button',{name:'See all university services'}).click();await expect(page.locator('.topic-row').filter({hasText:'International check-in'})).toHaveCount(1);
 await page.unrouteAll({behavior:'wait'});
 await page.route('**/v1/student/appointments',route=>route.fulfill({json:{items:[{id:'read-only-meeting',type:'academic_advising',startsAt:new Date(Date.now()+86400000).toISOString(),endsAt:new Date(Date.now()+88200000).toISOString(),notes:'Sample meeting',status:'scheduled',createdAt:new Date().toISOString(),modality:'virtual',location:'https://meet.example.edu/sample',staff:{id:'sample-adviser',name:'Demo Adviser',title:'Academic adviser',component:'Advising',email:null,employmentStatus:'active'}}],total:1}}));
 await page.reload();await expect(page.getByRole('link',{name:'Join meeting',exact:false})).toHaveAttribute('href','https://meet.example.edu/sample');
 await page.locator('.agenda-list .row-link').click();await expect(page.getByRole('link',{name:'Join online meeting'})).toHaveAttribute('rel','noopener noreferrer');await page.keyboard.press('Escape');
 await page.unrouteAll({behavior:'wait'});
 let returnedId;
 await page.route('**/v1/student/requirements',async route=>{const response=await route.fetch(),data=await response.json();const row=data.items.find(item=>item.submissionType==='document');returnedId=row.id;row.status='rejected';await route.fulfill({response,json:data});});
 await page.route('**/v1/student/documents',async route=>{for(let attempts=0;!returnedId&&attempts<200;attempts++)await new Promise(resolve=>setTimeout(resolve,10));if(!returnedId)throw Error('Requirement fixture did not load');await route.fulfill({json:{items:[{id:'sample-doc',requirementId:returnedId,fileName:'Sample.pdf',mimeType:'application/pdf',sizeBytes:10,category:'transcript',status:'rejected',review:{decision:'changes_requested',decidedAt:new Date().toISOString(),note:'Please include all pages of your transcript.',reasonCode:'missing_pages',reasonLabel:'Missing pages',reviewerName:'Sample reviewer'}}],total:1}});});
 await page.goto(base+'/enrollment');await expect(page.locator('.task-return-note')).toContainText('Please include all pages');
 await page.unrouteAll({behavior:'wait'});
 await page.route('**/v1/student/financial-plan',async route=>{const response=await route.fetch(),data=await response.json();data.paymentAgreements.push({id:'cancelled-plan',status:'cancelled',fee_cents:0});data.installments.push({id:'unrelated-installment',agreement_id:'cancelled-plan',due_at:'2026-10-10T12:00:00Z',amount_cents:999999});await route.fulfill({response,json:data});});
 await page.goto(base+'/financials/payments');const f=page.frameLocator('iframe');await f.locator('.next-list').waitFor();await expect(f.locator('.next-list')).not.toContainText('9,999.99');await expect(f.locator('.next-list li')).toHaveCount(4);
 console.log('PASS domestic filtering, all-services access, Join links, visible canonical review reason, selected-plan schedule');
}finally{await page.unrouteAll({behavior:'wait'});await browser.close();}
