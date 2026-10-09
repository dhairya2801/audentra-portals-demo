/** Read-only post-login reflow and interaction checks against a seeded student.
 * STUDENT_PORTAL_URL=http://localhost:3012 STUDENT_SESSION=/tmp/student-session.json
 * BROWSER=firefox or BROWSER=webkit selects another installed browser.
 * RESPONSIVE_PHASE=layouts|interactions|details runs a focused subset.
 * No forms, bookings, aid decisions, or messages are submitted.
 */
import { chromium, firefox, webkit, expect } from '@playwright/test';
import fs from 'node:fs/promises';

const base = process.env.STUDENT_PORTAL_URL || 'http://localhost:3012';
const engine = process.env.BROWSER || 'chromium';
const phase = process.env.RESPONSIVE_PHASE || 'all';
const output = process.env.RESPONSIVE_ARTIFACTS || `artifacts/student-responsive-${engine}`;
await fs.mkdir(output, { recursive: true });
const browser = await (engine === 'webkit' ? webkit.launch() : engine === 'firefox' ? firefox.launch() : chromium.launch({ channel: 'chrome' }));
const context = await browser.newContext({
  storageState: process.env.STUDENT_SESSION || '/tmp/student-refresh-session.json',
  viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce',
  ...(engine === 'webkit' ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { hasTouch: true }),
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
const sizes = [[320,740], [360,800], [390,844], [430,932], [600,900], [768,1024], [820,1180], [844,390], [900,900], [1024,768], [1025,768], [1180,820], [1280,800], [1440,900], [1920,1080], [2560,1440]];
const routes = ['/enrollment', '/appointments', '/financials', '/financials/aid', '/financials/payments', '/financials/expenses', '/classrooms', '/housing', '/health', '/campus-life', '/campus-life?view=clubs', '/help', '/profile', '/documents'];

async function visit(route) {
  await page.goto(base + route);
  await page.locator('.page-hero, iframe').first().waitFor();
  if (route.startsWith('/financials')) await page.frameLocator('iframe').locator('#tab-root [data-detail]').first().waitFor({ timeout: 30000 });
  await expect(page.locator('main .page-skeleton, main .resource-state[aria-busy="true"]')).toHaveCount(0, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
}
async function reflow(scope, label) {
  await expect.poll(() => scope.evaluate(() => document.documentElement.scrollWidth - innerWidth), { message: `${label}: reflow settles`, timeout: 3000 }).toBeLessThanOrEqual(2);
  const result = await scope.evaluate(() => {
    const visible = el => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const clipped = [...document.querySelectorAll('main h1, main h2, main h3, main button')].filter(el =>
      visible(el) && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 3 &&
      !['auto','scroll'].includes(getComputedStyle(el).overflowX) &&
      getComputedStyle(el).textOverflow !== 'ellipsis'
    ).map(el => ({ tag: el.tagName, class: el.className, text: el.textContent.trim().slice(0,70) }));
    return { overflow: document.documentElement.scrollWidth - innerWidth, clipped };
  });
  expect(result.overflow, `${label}: horizontal page overflow`).toBeLessThanOrEqual(2);
  expect(result.clipped, `${label}: clipped headings or buttons`).toEqual([]);
  checks.push({ label, ...result });
}
async function inside(locator, label, minHeight = 0) {
  await expect(locator).toBeVisible();
  const bounds = await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, height:r.height, width:innerWidth, viewportHeight:innerHeight };
  });
  expect(bounds.left, label).toBeGreaterThanOrEqual(-1);
  expect(bounds.right, label).toBeLessThanOrEqual(bounds.width + 1);
  expect(bounds.top, label).toBeGreaterThanOrEqual(-1);
  expect(bounds.bottom, label).toBeLessThanOrEqual(bounds.viewportHeight + 1);
  expect(bounds.height, label).toBeGreaterThanOrEqual(minHeight);
}
try {
  for (const route of (['all','layouts'].includes(phase) ? routes : [])) {
    await page.setViewportSize({ width:1440, height:900 });
    await visit(route);
    for (const [width,height] of sizes) {
      await page.setViewportSize({ width,height });
      await page.waitForTimeout(60);
      await reflow(page, `${route} ${width}×${height}`);
      if (route.startsWith('/financials')) {
        const frame = page.frames().find(f => f.url().includes('concept-4'));
        await reflow(frame, `${route} embedded ${width}×${height}`);
        const shell = await page.locator('iframe').boundingBox();
        expect(shell.y + shell.height, 'Financial frame fills the remaining screen').toBeCloseTo(height, 0);
      }
      if ([320,1024,2560].includes(width)) await page.screenshot({ path:`${output}/${route.slice(1).replaceAll('/','-').replace('?view=','-')}-${width}.png` });
    }
    console.log('PASS reflow', route, sizes.length, 'viewports');
  }

  for (const [width,height] of (['all','interactions'].includes(phase) ? [[320,740],[390,844],[768,1024],[844,390],[1024,768]] : [])) {
    await page.setViewportSize({width,height});
    await visit('/enrollment');
    const menu = page.getByRole('button',{name:'Open navigation',exact:true});
    await expect(page.locator('#portal-navigation')).not.toBeVisible();
    await menu.click();
    await inside(page.locator('#portal-navigation'),'Navigation fits the viewport');
    const closeNavigation=page.locator('#portal-navigation').getByRole('button',{name:'Close navigation',exact:true});
    await expect(closeNavigation).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#portal-navigation .profile-chip')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(closeNavigation).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeFocused();
    await expect(page.locator('#portal-navigation')).not.toBeVisible();
    await menu.click();
    await page.setViewportSize({width:1440,height:900});
    await expect(page.locator('#portal-navigation')).not.toHaveAttribute('aria-modal','true');
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    await page.setViewportSize({width,height});
    await expect(page.locator('#portal-navigation')).not.toBeVisible();
    for (const name of [/Your momentum,/, /What changed,/]) {
      await page.getByRole('button',{name}).click();
      await inside(page.getByRole('dialog'),'Topbar popover fits');
      await page.keyboard.press('Escape');
    }
    await page.getByRole('button',{name:'How smart order works',exact:true}).click();
    await inside(page.getByRole('dialog'),'Smart order dialog fits');
    await page.keyboard.press('Escape');
    await page.locator('.enrollment-adviser').getByRole('link',{name:'Book a Meeting'}).click();
    const booking=page.locator('.booking-modal-drawer');
    await expect(booking).toContainText('Bennett Abernathy');
    await inside(booking,'Booking fits');
    await inside(booking.locator('.drawer-content'),'Scrollable booking content',80);
    const day=booking.locator('.booking-date-grid button').nth(1);
    await day.click();
    await expect(day).toHaveAttribute('aria-pressed','true');
    const slot=booking.locator('.booking-time-grid button').first();
    await slot.click();
    await booking.locator('textarea').fill('Discuss my enrollment plan.');
    await expect(booking.getByRole('button',{name:'Book this time',exact:true})).toBeEnabled();
    await inside(booking.locator('.booking-foot'),'Booking actions stay reachable');
    await page.screenshot({path:`${output}/booking-${width}.png`});
    await booking.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(booking).not.toBeVisible();
    checks.push({label:`Navigation, rotation, popovers, smart order and booking ${width}×${height}`});
    console.log('PASS interactions',width,height);
  }

  let details = 0;
  for (const route of (['all','details'].includes(phase) ? ['/financials','/financials/aid','/financials/payments','/financials/expenses'] : [])) {
    await visit(route);
    const frame=page.frameLocator('iframe');
    const keys=await frame.locator('#tab-root [data-detail]').evaluateAll(els => [...new Set(els.map(el=>el.dataset.detail))]);
    expect(keys.length, `${route}: financial data has loaded`).toBeGreaterThan(0);
    for (const [width,height] of [[320,740],[844,390],[1440,900]]) {
      await page.setViewportSize({width,height});
      for (const key of keys) {
        const control=frame.locator(`#tab-root [data-detail=${JSON.stringify(key)}]`).last();
        const position=await control.evaluate(el=> {
          if (!(el instanceof SVGPathElement)) return null;
          const box=el.getBBox(),rect=el.getBoundingClientRect();
          for(let x=5;x<26;x++)for(let y=5;y<26;y++){
            const point=new DOMPoint(box.x+box.width*x/30,box.y+box.height*y/30);
            if([[0,0],[3,0],[-3,0],[0,3],[0,-3]].every(([dx,dy])=>el.isPointInFill(new DOMPoint(point.x+dx,point.y+dy)))){
              const screen=point.matrixTransform(el.getScreenCTM());
              return {x:screen.x-rect.left,y:screen.y-rect.top};
            }
          }
          throw new Error('No painted point in chart segment');
        });
        await control.click(position ? {position} : {});
        const dialog=frame.getByRole('dialog');
        await inside(dialog,`${key} detail fits`);
        await inside(dialog.locator('.pop-body'),`${key} detail body remains usable`,60);
        await reflow(page.frames().find(f=>f.url().includes('concept-4')),`${key} detail ${width}×${height}`);
        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();
        details++;
      }
    }
    console.log('PASS financial details',route,keys.length,'× 3 viewports');
  }
  expect(errors,'No uncaught browser errors').toEqual([]);
  await fs.writeFile(`${output}/results-${phase}.json`,JSON.stringify({engine,phase,routes:routes.length,viewports:sizes,checks,details,errors},null,2));
  console.log('PASS',checks.length,'layout/interaction checks,',details,'financial details; no runtime errors');
} finally { await browser.close(); }
