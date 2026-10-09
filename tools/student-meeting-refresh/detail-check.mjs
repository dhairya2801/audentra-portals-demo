import {chromium, expect} from '@playwright/test';
const base=process.env.STUDENT_PORTAL_URL || 'http://localhost:3012';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local portal required.');
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',storageState:process.env.STUDENT_SESSION || '/tmp/student-refresh-session.json'});
page.setDefaultTimeout(10000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));let count=0;
try {
 for(const path of ['/financials','/financials/aid','/financials/payments','/financials/expenses']) {
  await page.goto(base+path);const f=page.frameLocator('iframe');await f.locator('#tab-root .story-head').first().waitFor();
  const keys=await f.locator('#tab-root [data-detail]').evaluateAll(els=>[...new Set(els.map(e=>e.dataset.detail))]);
  expect(keys.length).toBeGreaterThan(0);
  for(const key of keys){
   console.log('CHECK',path,key);
   const control=f.locator(`#tab-root [data-detail=${JSON.stringify(key)}]`).last();
   // A donut segment's bounding-box center can lie inside a different ring.
   // Click a painted point in the requested segment, just as a pointer user does.
   const position=await control.evaluate(el=>{
    if(!(el instanceof SVGPathElement))return null;
    const box=el.getBBox(), rect=el.getBoundingClientRect();
    for(let x=1;x<30;x++)for(let y=1;y<30;y++){
     const point=new DOMPoint(box.x+box.width*x/30,box.y+box.height*y/30);
     if(el.isPointInFill(point)){
      const screen=point.matrixTransform(el.getScreenCTM());
      return {x:screen.x-rect.left,y:screen.y-rect.top};
     }
    }
    throw new Error('No painted point in segment');
   });
   await control.click(position?{position}:{});
   await expect(f.getByRole('dialog')).toBeVisible();await expect(f.getByRole('dialog').getByRole('heading').first()).not.toBeEmpty();
   await page.keyboard.press('Escape');await expect(f.getByRole('dialog')).not.toBeVisible();count++;
  }
  console.log('PASS detail views:',path,keys.length);
  if(path==='/financials') {
   await f.locator('#budget-form').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/student-meeting-refresh/living-budget-desktop.png',animations:'disabled'});
   await page.setViewportSize({width:390,height:844});await f.locator('#budget-form').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/student-meeting-refresh/living-budget-mobile.png',animations:'disabled'});
   await page.setViewportSize({width:1440,height:1000});
  }
  if(path==='/financials/aid'){await f.locator('.is-loan').first().scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/student-meeting-refresh/aid-offers-desktop.png',animations:'disabled'});}
 }
 const f=page.frameLocator('iframe');await f.getByRole('link',{name:'Explore a scenario'}).click();
 await f.getByRole('button',{name:'Preview this scenario'}).click();
 await expect(f.locator('#scenario-result')).toContainText('Preview only');
 console.log('PASS simulator preview');
 expect(errors).toEqual([]);console.log('PASS',count,'financial detail views; no runtime errors');
} finally {await browser.close();}
