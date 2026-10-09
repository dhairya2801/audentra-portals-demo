import {chromium,firefox,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const base=process.env.STUDENT_PORTAL_URL||'http://localhost:3012';
const engine=process.env.BROWSER||'chromium';
const browser=await(engine==='firefox'?firefox.launch():chromium.launch({channel:'chrome'}));
const page=await browser.newPage({storageState:process.env.STUDENT_SESSION||'/tmp/student-refresh-session.json',reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await fs.mkdir('/tmp/enrollment-walkthrough',{recursive:true});
try {
 for(const [width,height] of [[320,740],[390,844],[768,1024],[844,390],[1024,768],[1440,900],[1920,1080]]){
  await page.setViewportSize({width,height});await page.goto(base+'/enrollment');
  const contact=page.locator('.enrollment-contact-actions');await expect(contact).toBeVisible();
  const ys=await contact.locator('a').evaluateAll(es=>es.map(e=>Math.round(e.getBoundingClientRect().top)));expect(new Set(ys).size,'Enrollment contacts in one row').toBe(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  const start=page.getByRole('button',{name:'Take a quick tour'});await start.click();
  const dialog=page.getByRole('dialog',{name:'Your enrollment tour'});await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'Close tour'})).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'Next',exact:true})).toBeFocused();await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'Close tour'})).toBeFocused();
  const count=await dialog.locator('.walkthrough-progress button').count();expect(count).toBe(6);
  for(let i=0;i<count;i++){
   await expect(dialog.locator('.walkthrough-count')).toHaveText(`STEP ${i+1} OF 6`);await expect(dialog.locator('.walkthrough-card')).toBeVisible();
   await expect.poll(()=>dialog.locator('.walkthrough-spotlight').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThan(10);
   await expect.poll(()=>dialog.locator('.walkthrough-card').evaluate(e=>e.getBoundingClientRect().bottom)).toBeLessThanOrEqual(height+1);
   const bounds=await dialog.locator('.walkthrough-card').evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,overflow:e.scrollWidth-e.clientWidth}});
   expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.right).toBeLessThanOrEqual(width+1);expect(bounds.bottom).toBeLessThanOrEqual(height+1);expect(bounds.overflow).toBeLessThanOrEqual(1);
   if([390,844,1440].includes(width))await page.screenshot({path:`/tmp/enrollment-walkthrough/${engine}-${width}-step-${i+1}.png`});
   await dialog.getByRole('button',{name:i===count-1?'You’re ready':'Next',exact:true}).click();
  }
  await expect(dialog).not.toBeVisible();await expect(start).toBeFocused();
  await start.click();await dialog.getByRole('button',{name:'Step 6: Your enrollment contact',exact:true}).click();await expect(dialog.locator('.walkthrough-count')).toHaveText('STEP 6 OF 6');await dialog.getByRole('button',{name:'Back',exact:true}).click();await expect(dialog.locator('.walkthrough-count')).toHaveText('STEP 5 OF 6');await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(start).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.style.overflow)).not.toBe('hidden');
  await page.goto(base+'/financials');const f=page.frameLocator('iframe');await f.locator('#budget-form').waitFor();
  const positions=await f.locator('.contact-links a').evaluateAll(es=>es.map(e=>Math.round(e.getBoundingClientRect().top)));expect(positions).toHaveLength(3);expect(new Set(positions).size,'Financial contact actions in one row').toBe(1);
  expect(await page.frames().find(f=>f.url().includes('concept-4')).evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  for(const select of await f.locator('[data-budget-unit]').all()){
   expect(await select.evaluate(e=>{const s=getComputedStyle(e);const canvas=document.createElement('canvas'),c=canvas.getContext('2d');c.font=s.font;return e.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)-c.measureText(e.selectedOptions[0].textContent).width}),'Dropdown has room for label and arrow').toBeGreaterThan(1);
  }
  console.log('PASS contact rows, dropdowns, six tour steps, replay, escape and focus',width,height);
 }
 await page.goto(base+'/enrollment');await page.getByRole('button',{name:'Take a quick tour'}).click();
 const active=page.getByRole('dialog',{name:'Your enrollment tour'});await active.getByRole('button',{name:'Step 3: Inside each step'}).click();
 for(const [width,height] of [[390,844],[844,390],[1920,1080]]){
  await page.setViewportSize({width,height});await expect.poll(()=>active.locator('.walkthrough-card').evaluate(e=>e.getBoundingClientRect().bottom)).toBeLessThanOrEqual(height+1);
  await expect.poll(()=>active.locator('.walkthrough-spotlight').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThan(15);
 }
 await page.keyboard.press('Escape');console.log('PASS active-tour resizing and rotation');
 expect(errors).toEqual([]);
} finally {await browser.close()}
