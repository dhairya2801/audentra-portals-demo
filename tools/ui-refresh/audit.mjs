/** Read-only rendered route sweep. No forms are submitted. */
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const base = process.env.PORTAL_BASE || 'http://localhost:3000';
const out = 'artifacts/ui-refresh/audit';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({storageState:'artifacts/ui-refresh/session.json', viewport:{width:1440,height:1000}, reducedMotion:'reduce'});
const page = await context.newPage();
const errors = [], results = [];
page.on('pageerror', e => errors.push({url:page.url(),message:e.message}));
const student = ['/onboarding','/dashboard','/enrollment','/enrollment/ferpa','/appointments','/classrooms','/health','/housing','/campus-life','/profile','/documents','/messages','/help','/payments','/financials','/financials/payments','/financials/payments#timeline','/financials/aid','/financials/expenses','/financials/expenses#coverage','/financials/expenses/housing','/financials/expenses/meals','/financials/expenses/simulator'];
const staff = ['profile','overview','messages','journeys','knowledge','core_plays','campus_life','academics','outreach','students','morning_brew','tasks'].map(x=>'/staff#'+x);
try {
  for (const width of [1440,1280,390]) {
    await page.setViewportSize({width,height:width===390?844:1000});
    for (const route of (width===1280?['/staff#tasks','/staff#morning_brew','/staff#students']:[...student,...(width===1440?staff:['/staff#tasks','/staff#morning_brew','/staff#students'])])) {
      const name = route.replace(/^\//,'').replaceAll('/','-').replace('#','-')+'-'+width;
      try {
        await page.goto(base+route);
        await page.locator('.portal-refresh').first().waitFor({timeout:60000});
        await page.waitForTimeout(2500);
        const body = await page.locator('body').innerText();
        const measurements = await page.evaluate(() => {
          const viewport = document.documentElement.clientWidth;
          return {viewport,fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family),scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('main *')].filter(e=> {
            const r=e.getBoundingClientRect();
            if(!r.width||r.right<=viewport+2||r.left<0) return false;
            let p=e.parentElement;
            while(p && p!==document.body) {if(/hidden|auto|scroll|clip/.test(getComputedStyle(p).overflowX))return false;p=p.parentElement;}
            return true;
          }).slice(0,12).map(e=>({tag:e.tagName,class:e.className,text:e.textContent?.slice(0,70)}))};
        });
        const frames=[];
        for(const frame of page.frames().slice(1)) {
          if(!frame.url().startsWith(base))continue;
          frames.push(await frame.evaluate(()=>({url:location.pathname+location.hash,viewport:innerWidth,scroll:document.documentElement.scrollWidth,headings:[...document.querySelectorAll('h1,h2')].map(e=>e.textContent).slice(0,5)})));
        }
        results.push({route,width,url:page.url(),headings:await page.locator('h1,h2').allTextContents(),alerts:await page.locator('[role=alert]').allTextContents(),...measurements,frames,text:body.slice(-1000)});
        await page.screenshot({path:`${out}/${name}.png`,fullPage:true});
        console.log(name, measurements.scroll>measurements.viewport+2?'OVERFLOW':'ok', frames.map(f=>f.headings.join(' / ')).join(' '));
      } catch(error) {results.push({route,width,error:error.message});console.log(name,'FAIL',error.message.slice(0,160));}
      await fs.writeFile(`${out}/results.json`,JSON.stringify({results,errors},null,2));
    }
  }
} finally {await browser.close();}
