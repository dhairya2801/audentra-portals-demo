import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const engine=process.env.MB_BROWSER||'chrome';
const browser=engine==='webkit'?await webkit.launch({executablePath:'/tmp/morning-brew-v2-webkit/run'}):await chromium.launch({channel:'chrome'});
const p=await browser.newPage({viewport:{width:1440,height:900}}),results=[],errors=[];
p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://localhost:3012/staff');await p.getByRole('button',{name:/Camila/}).click();await p.getByRole('button',{name:'Looks good',exact:true}).click();await p.getByRole('button',{name:/Make my Morning Brew/}).click();await expect(p.locator('.brew-live-news .brew-news-card').first()).toBeVisible({timeout:30000});
for(const size of [{width:1440,height:900},{width:2560,height:1440},{width:3440,height:1440},{width:820,height:1000},{width:390,height:844}]){
 await p.setViewportSize(size);await p.waitForTimeout(200);
 const layout=await p.locator('.brew').evaluate(e=>{const r=e.getBoundingClientRect(),parent=e.parentElement.getBoundingClientRect();return {width:r.width,parent:parent.width,overflow:document.documentElement.scrollWidth>innerWidth}});
 assert.ok(Math.abs(layout.width-layout.parent)<2);assert.equal(layout.overflow,false);results.push({surface:'Morning Brew',...size,...layout});
 await p.screenshot({path:`artifacts/morning-brew-v2/${engine}-brew-${size.width}.png`,fullPage:true});
 await p.locator('.brew-live-news').scrollIntoViewIfNeeded();await p.screenshot({path:`artifacts/morning-brew-v2/${engine}-news-${size.width}.png`});
 await p.evaluate(()=>scrollTo(0,0));
}
await p.setViewportSize({width:1440,height:900});await p.getByRole('button',{name:/Student 360/}).first().click();await expect(p.locator('[class*=student360_root]')).toBeVisible();
for(const size of [{width:1440,height:900},{width:2560,height:1440},{width:3440,height:1440},{width:820,height:1000}]){await p.setViewportSize(size);await p.waitForTimeout(200);const layout=await p.locator('[class*=student360_root]').evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e.parentElement);return {width:r.width,available:e.parentElement.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),overflow:document.documentElement.scrollWidth>innerWidth}});assert.ok(Math.abs(layout.width-layout.available)<2);assert.equal(layout.overflow,false);results.push({surface:'Student 360',...size,...layout});await p.screenshot({path:`artifacts/morning-brew-v2/${engine}-student360-${size.width}.png`,fullPage:true});}
await p.setViewportSize({width:1440,height:900});await p.getByRole('button',{name:/Task Board/}).first().click();await p.getByRole('button',{name:'For You 3 views'}).click();const frame=p.frames().find(f=>f.url().includes('action-center-demo'));
for(const size of [{width:1440,height:900},{width:1366,height:768},{width:2560,height:1440},{width:3440,height:1440},{width:820,height:1000},{width:390,height:844}]){
 await p.setViewportSize(size);await p.waitForTimeout(250);
 for(const version of ['board','focus','portfolio']){
 await frame.locator(`[data-version=${version}]`).click();await p.waitForTimeout(150);
 const layout=await frame.locator('#task-summary').evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight,width:e.clientWidth,scrollWidth:e.scrollWidth}));
 assert.ok(layout.scrollWidth<=layout.width+1,`${version} horizontal overflow ${size.width}`);
 if(size.width>=1366)assert.ok(layout.scroll-layout.height<65,`${version} excessive scrolling ${JSON.stringify(layout)}`);
 results.push({surface:version,...size,...layout});
 await p.screenshot({path:`artifacts/morning-brew-v2/${engine}-final-${version}-${size.width}.png`});
 }
}
await p.setViewportSize({width:2560,height:1440});await p.locator('[data-approved-board="fa-payments"]:visible').click();await expect(frame.locator('#task-summary')).toBeHidden();
const width=await frame.locator('.columns').evaluate(e=>({rail:e.getBoundingClientRect().width,columns:[...e.children].reduce((sum,c)=>sum+c.getBoundingClientRect().width,0),gap:parseFloat(getComputedStyle(e).gap)*(e.children.length-1)}));assert.ok(Math.abs(width.rail-width.columns-width.gap)<2,JSON.stringify(width));await p.screenshot({path:`artifacts/morning-brew-v2/${engine}-final-task-board-wide.png`});results.push({surface:'Task Board',...width});
assert.deepEqual(errors,[]);await writeFile(`artifacts/morning-brew-v2/${engine}-responsive-results.json`,JSON.stringify(results,null,2));console.log('PASS',engine,results.length,'responsive views, no horizontal page overflow, monitor gutters and full-width board verified');await browser.close();
