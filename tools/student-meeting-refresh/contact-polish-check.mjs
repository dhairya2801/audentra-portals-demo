import {chromium,expect} from '@playwright/test';
const base=process.env.STUDENT_PORTAL_URL||'http://localhost:3012';
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage({storageState:process.env.STUDENT_SESSION||'/tmp/student-refresh-session.json',viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 for(const width of [1440,1024,390]){
  await page.setViewportSize({width,height:900});await page.goto(base+'/enrollment');
  await expect(page.locator('.enrollment-adviser')).toContainText('Bennett Abernathy');
  await expect(page.locator('.enrollment-adviser')).toContainText('Your Enrollment Contact');
  await expect(page.locator('.enrollment-contact')).toHaveCount(0);
  await expect(page.locator('.momentum-card')).not.toContainText(/sample/i);
  const photo=page.locator('.enrollment-adviser img');await expect(photo).toBeVisible();await expect.poll(()=>photo.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
  const step=page.getByRole('button',{name:/See the (step|\d+ steps)/});
  if(await step.count()){await step.click();await expect.poll(async()=>await page.getByRole('dialog').isVisible()||/\/enrollment\/requirements\//.test(page.url())).toBe(true);if(/\/enrollment\/requirements\//.test(page.url())){await page.goto(base+'/enrollment');await expect(page.locator('.enrollment-adviser')).toBeVisible();}else await page.keyboard.press('Escape');}
  const icon=page.locator('.momentum-card .points-icon');expect(await icon.evaluate(el=>getComputedStyle(el).color!==getComputedStyle(el).backgroundColor)).toBe(true);
  await page.getByRole('button',{name:'How points work',exact:true}).click();await expect(page.getByRole('dialog')).not.toContainText(/sample/i);await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`artifacts/student-meeting-refresh/contact-enrollment-${width}.png`,fullPage:true,animations:'disabled'});
  await page.locator('.enrollment-adviser').getByRole('link',{name:'Book a Meeting'}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('.booking-with').scrollIntoViewIfNeeded();await expect(page.locator('.booking-with')).toContainText('Bennett Abernathy');await expect(page.locator('.booking-with img')).toBeVisible();await expect.poll(()=>page.locator('.booking-with img').evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
  await page.screenshot({path:`artifacts/student-meeting-refresh/contact-booking-${width}.png`,animations:'disabled'});await page.keyboard.press('Escape');
  const portraits=page.locator('.topic-row .staff-portrait');expect(await portraits.count()).toBeGreaterThanOrEqual(3);
  for(const img of await portraits.all()){await img.scrollIntoViewIfNeeded();await expect.poll(()=>img.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  console.log('PASS contact links, blocking step, reward copy/icon, portraits and responsive layout',width);
 }
 expect(errors).toEqual([]);
}finally{await browser.close();}
