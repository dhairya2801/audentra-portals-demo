/** Run against the refresh preview after capture.mjs has signed in.
 * Compares Edward with a separate preview of the unchanged committed base.
 * It never submits a message or modifies institutional data. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const base = process.env.PORTAL_BASE || 'http://localhost:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = 'artifacts/ui-refresh/edward';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  storageState: 'artifacts/ui-refresh/session.json',
  viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce',
});
async function snapshot(locator) {
  return locator.evaluate(root => [root, ...root.querySelectorAll('*')].map(element => {
    const s = getComputedStyle(element), r = element.getBoundingClientRect(), origin = root.getBoundingClientRect();
    return { tag: element.tagName,
      styles: Object.fromEntries(Array.from(s).filter(p => !p.startsWith('--portal-')).map(p => [p, s.getPropertyValue(p)])),
      box: [r.x-origin.x,r.y-origin.y,r.width,r.height].map(n => Math.round(n*100)/100) };
  }));
}
const comparisons = [];
async function compare(page, baseline, selector, name) {
  const elements=[page.locator(selector).first(),baseline.locator(selector).first()];
  for (const [index,host] of [page,baseline].entries()) {
    await expect(elements[index]).toBeVisible();
    await host.evaluate(async()=>{document.body.getBoundingClientRect();await document.fonts.ready;});
  }
  const refreshed=await snapshot(elements[0]), original=await snapshot(elements[1]);
  await fs.writeFile(`${output}/${name}-computed.json`,JSON.stringify({original,refreshed},null,2));
  assert.deepEqual(refreshed,original,`${name}: computed appearance changed from committed base`);
  for(const [index,host] of [page,baseline].entries()) {
    const element=elements[index],suffix=index===0?'after':'before';
    await element.scrollIntoViewIfNeeded();const box=await element.boundingBox();
    // Isolate assistant ink from surrounding portal changes. Natural geometry
    // was compared above. Only contextual controls use a common capture origin;
    // floating launchers and panels retain their natural viewport position.
    const mask=await host.addStyleTag({content:`html,body { background:transparent!important } body * {visibility:hidden!important} ${selector}, ${selector} * {visibility:visible!important}`});
    const oldStyle=await element.getAttribute('style');
    if(name.includes('contextual')) await element.evaluate((el,box)=>{for(const [key,value] of Object.entries({position:'fixed',left:'100px',top:'100px',right:'auto',bottom:'auto',margin:'0',width:`${box.width}px`,height:`${box.height}px`,translate:'none'}))el.style.setProperty(key,value,'important');},box);
    await element.screenshot({path:`${output}/${name}-${suffix}.png`,animations:'disabled',omitBackground:true});
    await element.evaluate((el,value)=>{if(value===null)el.removeAttribute('style');else el.setAttribute('style',value);},oldStyle);
    await mask.evaluate(el=>el.remove());
  }
  const exact=(await fs.readFile(`${output}/${name}-after.png`)).equals(await fs.readFile(`${output}/${name}-before.png`));
  comparisons.push({name,computedStylesAndGeometry:true,pixelsExact:exact});
  console.log(name,exact?'EXACT':'RASTER DIFFERENCE');
  assert.ok(exact,`${name}: isolated pixels differ from committed base`);
}

try {
  for (const width of [1440,1280,390]) {
  for (const [role, route] of [['student', '/enrollment'], ['staff', '/staff#tasks']]) {
    const page = await context.newPage(), baseline = await context.newPage();
    await page.setViewportSize({width,height:width===390?844:1000});await baseline.setViewportSize({width,height:width===390?844:1000});
    await Promise.all([page.goto(base + route),baseline.goto((process.env.BASELINE_BASE||'http://localhost:3019') + route)]);
    const launcher = page.locator('.edward-launcher'); await launcher.waitFor({timeout:90000});await baseline.locator('.edward-launcher').waitFor({timeout:90000});await page.waitForTimeout(2000);
    await compare(page, baseline, '.edward-launcher', `${role}-launcher-${width}`);
    if (role === 'student' && width !==390) {
      await page.getByRole('heading', {name:'Your next steps',exact:true}).waitFor({timeout:90000});
      await compare(page, baseline, '.edward-ask', `student-contextual-entry-${width}`);
    }
    if(width===1440){await launcher.hover();await baseline.locator('.edward-launcher').hover();await compare(page,baseline,'.edward-launcher',`${role}-launcher-hover`);await launcher.focus();await baseline.locator('.edward-launcher').focus();await compare(page,baseline,'.edward-launcher',`${role}-launcher-focus`);}
    await launcher.click();await baseline.locator('.edward-launcher').click();
    await page.locator('.edward-panel').first().waitFor();
    await page.waitForTimeout(3000);
    await compare(page, baseline, '.edward-panel', `${role}-panel-${width}`);
    const composer = page.locator('.edward-composer textarea');
    if (await composer.count()) {
      await composer.fill('Unsent local review text');await baseline.locator('.edward-composer textarea').fill('Unsent local review text');await expect(composer).toHaveValue('Unsent local review text');await compare(page,baseline,'.edward-composer',`${role}-composer-${width}`);await composer.fill('');
    }
    await page.close();await baseline.close();
  }
  }
  {
    const page=await context.newPage(),baseline=await context.newPage();
    for(const [host,origin] of [[page,base],[baseline,process.env.BASELINE_BASE||'http://localhost:3019']]) {
      await host.goto(origin+'/staff#morning_brew');await host.locator('.staff-shell--workspace').waitFor({timeout:90000});
      await host.waitForTimeout(1500);
      if(await host.getByRole('button',{name:/Looks good/}).count()) {await host.getByRole('button',{name:/Looks good/}).click();await host.getByRole('button',{name:/Make my Morning Brew/}).click();}
      await host.locator('.brew-hero').waitFor();
    }
    await compare(page,baseline,'.brew-kpi__head .brew-kpi__edward','brew-contextual-entry');
    await page.locator('.brew-kpi__head .brew-kpi__edward').first().click();await baseline.locator('.brew-kpi__head .brew-kpi__edward').first().click();
    await compare(page,baseline,'.brew-edward','brew-panel');
    for(const [host,origin] of [[page,base],[baseline,process.env.BASELINE_BASE||'http://localhost:3019']]) {
      await host.goto(origin+'/staff#students');await host.getByRole('button',{name:'✦ Ask Edward',exact:true}).waitFor({timeout:90000});
      await host.getByRole('button',{name:'✦ Ask Edward',exact:true}).evaluate(el=>el.setAttribute('data-review-edward-summary',''));
    }
    await compare(page,baseline,'[data-review-edward-summary]','student360-contextual-entry');
    await page.close();await baseline.close();
  }
  await fs.writeFile(`${output}/result.json`, JSON.stringify({pass:true,comparisons,checks:['all computed styles','relative geometry','isolated element screenshots against committed base','composer input'],limitations:['No provider response submitted']},null,2));
} finally { await browser.close(); }
