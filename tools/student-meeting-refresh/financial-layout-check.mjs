import {chromium, expect} from '@playwright/test';
const base=process.env.STUDENT_PORTAL_URL || 'http://localhost:3012';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local portal required.');
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage({storageState:process.env.STUDENT_SESSION || '/tmp/student-refresh-session.json',reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 for(const width of [1440,1024,390]) {
  await page.setViewportSize({width,height:1000});
  for(const tab of ['', '/aid','/payments','/expenses']) {
   await page.goto(`${base}/financials${tab}`);
   const f=page.frameLocator('iframe');
   await f.locator('#tab-root .story-head').first().waitFor();
   const review=f.getByRole('button',{name:'Review offer',exact:false});
   await expect(review).toBeVisible();
   const offer=await review.getAttribute('data-detail');
   await review.click();
   const dialog=f.getByRole('dialog');
   await expect(dialog).toBeVisible();
   await expect(dialog.locator(`[data-award="${offer}"]`).first()).toBeVisible();
   await page.keyboard.press('Escape');
   await expect(review).toBeFocused();
   if(tab==='/aid') {
    for(const list of await f.locator('#tab-root .award-list').all()) {
     const bounds=await list.locator('.award-amount').evaluateAll(es=>es.map(e=>({right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})));
     expect(Math.max(...bounds.map(b=>b.right))-Math.min(...bounds.map(b=>b.right))).toBeLessThan(1);
     expect(Math.max(...bounds.map(b=>b.width))-Math.min(...bounds.map(b=>b.width))).toBeLessThan(1);
    }
    await f.locator('#tab-root .award-list').first().scrollIntoViewIfNeeded();
   }
   if(tab==='/payments') {
    const schedule=f.locator('.story').filter({has:f.getByRole('heading',{name:'Payment schedule',exact:true})});
    await schedule.scrollIntoViewIfNeeded();
    expect(await schedule.locator('.next-list .t').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(14);
    expect(await schedule.locator('.next-list .a').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(15);
   }
   if(tab==='/expenses') {
    await expect(f.locator('.expense-table')).toHaveCount(2);
    for(const table of await f.locator('.expense-table').all()) {
     const alignment=await table.evaluate(t=>{
      const head=[...t.querySelectorAll('th')];
      return [...t.querySelectorAll('tbody tr')].every(r=>[...r.cells].every((c,i)=>{
       const h=head[i],cs=getComputedStyle(c),hs=getComputedStyle(h);
       return Math.abs(c.getBoundingClientRect().x-h.getBoundingClientRect().x)<1&&cs.textAlign===hs.textAlign&&cs.paddingRight===hs.paddingRight;
      }));
     });
     expect(alignment).toBe(true);
    }
    await f.locator('.expense-table').first().scrollIntoViewIfNeeded();
   }
   expect(await f.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1)).toBe(true);
   await page.screenshot({path:`artifacts/student-meeting-refresh/final-${tab.slice(1)||'overview'}-${width}.png`,animations:'disabled'});
   console.log('PASS review offer, layout, overflow',width,tab||'/overview');
  }
 }
 expect(errors).toEqual([]);
} finally {await browser.close();}
