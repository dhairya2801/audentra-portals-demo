import {chromium,firefox,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const base=process.env.STUDENT_PORTAL_URL||'http://localhost:3012';
const browser=await(process.env.BROWSER==='firefox'?firefox.launch():chromium.launch({channel:'chrome'}));
const page=await browser.newPage({storageState:process.env.STUDENT_SESSION||'/tmp/student-refresh-session.json',viewport:{width:1440,height:1000}});
const errors=[],writes=[];page.on('request',r=>{if(r.url().includes('/v1/student/')&&['POST','PUT','PATCH','DELETE'].includes(r.method())&&!r.url().includes('/session'))writes.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
await fs.mkdir('/tmp/oct9-dsm-artifacts',{recursive:true});
async function visit(route){await page.goto(base+route);if(route.startsWith('/financials'))await page.frameLocator('iframe').locator('#tab-root [data-detail]').first().waitFor();else await page.locator('main h1').waitFor();}
try{
for(const width of [390,768,1440,1920]){
 await page.setViewportSize({width,height:1000});
 await visit('/enrollment');
 const help=page.locator('.task-help-actions').first();await expect(help.getByRole('button',{name:'How this works',exact:true})).toBeVisible();
 await help.getByRole('button',{name:'How this works',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
 const contacts=page.locator('.enrollment-contact-actions');await expect(contacts.locator('a')).toHaveCount(3);
 await contacts.getByRole('link',{name:'Book a Meeting'}).click();const booking=page.locator('.booking-modal-drawer');
 await expect(booking.locator('.booking-contact')).toContainText('Bennett Abernathy');await expect(booking.locator('.booking-people')).toHaveCount(0);await expect(booking.locator('.booking-footer-person')).toHaveCount(0);
 await booking.getByRole('button',{name:'See others',exact:true}).click();const people=booking.locator('.booking-person');await expect(people.first()).toBeVisible();
 const images=await people.locator('img').evaluateAll(es=>es.map(e=>e.getAttribute('src')));expect(new Set(images).size).toBe(images.length);expect(images.length).toBeGreaterThan(3);
 await people.first().click();await expect(booking.locator('.booking-people')).toHaveCount(0);await page.screenshot({path:`/tmp/oct9-dsm-artifacts/booking-${width}.png`});await page.keyboard.press('Escape');
 await visit('/financials');let f=page.frameLocator('iframe');await expect(f.locator('.academic-context')).toContainText('recorded credits');await expect(f.locator('.open-offers')).toHaveCount(0);await expect(f.locator('#budget-employmentIncomeCents')).toHaveCount(0);await expect(f.locator('.locked-resource')).toContainText('Federal Work-Study');
 const facts=await page.frames().find(f=>f.url().includes('concept-4')).evaluate(()=>({sources:model().sources.filter(r=>r.pending).map(r=>({potential:!!r.potential,label:r.label})),load:academicFacts()}));expect(facts.sources.every(r=>r.potential)).toBe(true);expect(facts.load.credits).toBeGreaterThan(0);
 for(const ring of await f.locator('.comparison-ring').all()){const row=ring.locator('[data-ring-key]:not(path)').first();await row.hover();const key=await row.getAttribute('data-ring-key');await expect(ring.locator(`path[data-ring-key="${key}"]`)).toHaveClass(/is-highlighted/);}
 await f.locator('.funding-decisions [data-decision="accept"]').first().click();await expect(f.getByRole('dialog')).toContainText('no award changes will be submitted');await f.getByRole('button',{name:'Preview acceptance →',exact:true}).click();await expect(f.locator('.scenario-banner')).toBeVisible();
 const preview=await page.frames().find(f=>f.url().includes('concept-4')).evaluate(()=>model().sources.filter(r=>r.sub==='Accepted in preview · not submitted').every(r=>!r.pending));expect(preview).toBe(true);
 await visit('/financials/aid');f=page.frameLocator('iframe');await expect(f.locator('.aid-package-donut')).toBeVisible();await f.getByRole('button',{name:'Your financial aid map →',exact:true}).click();await expect(f.getByRole('dialog')).toContainText('Needs review');await page.screenshot({path:`/tmp/oct9-dsm-artifacts/aid-map-${width}.png`});await page.keyboard.press('Escape');
 await f.locator('.award-amount [data-detail]').first().click();await expect(f.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
 await visit('/financials/payments');f=page.frameLocator('iframe');await expect(f.locator('.payment-summary-grid')).toBeVisible();await f.getByRole('button',{name:'Make a payment →',exact:true}).click();await expect(f.getByRole('dialog')).toContainText('provider link has not been published');await expect(f.getByRole('dialog').getByRole('link',{name:'Contact Student Accounts →'})).toBeVisible();await page.keyboard.press('Escape');
 await visit('/financials/expenses');f=page.frameLocator('iframe');await f.getByRole('link',{name:'Explore housing →',exact:true}).click();await expect(f.locator('.campus-hero')).toBeVisible();
 await visit('/classrooms');const slider=page.getByRole('slider',{name:/Planning credit load/});await slider.fill('9');await expect(page.locator('.course-load-impact')).toContainText('Check your aid before reducing your load');await page.getByRole('link',{name:'Review the financial impact →'}).click();f=page.frameLocator('iframe');await expect(f.locator('.planning-load-note')).toContainText('Planning preview · 9 credits');
 console.log('PASS October 9 interactions',width);
}
expect(errors).toEqual([]);expect(writes).toEqual([]);
}finally{await browser.close();}
