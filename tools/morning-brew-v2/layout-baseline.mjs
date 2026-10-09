import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage({viewport:{width:2560,height:1440}});
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
await page.goto('http://localhost:3012/staff');await page.getByRole('button',{name:/Camila/}).click();await page.getByRole('button',{name:'Looks good',exact:true}).click();await page.getByRole('button',{name:/Make my Morning Brew/}).click();await page.waitForTimeout(2500);
await page.screenshot({path:'artifacts/morning-brew-v2/before-wide-brew.png',fullPage:true});
console.log('brew ancestors',await page.locator('.brew').evaluate(e=>{const out=[];for(;e;e=e.parentElement){const r=e.getBoundingClientRect(),s=getComputedStyle(e);out.push({class:e.className,width:r.width,left:r.left,max:s.maxWidth,display:s.display})}return out}));
console.log('nav',await page.locator('nav').allTextContents());
await page.getByRole('button',{name:/Task Board/}).first().click();await page.waitForTimeout(3000);
const frame=page.frames().find(f=>f.url().includes('action-center-demo'));
console.log('frame',!!frame);if(frame){console.log('board widths',await frame.locator('.columns').evaluate(e=>{const out=[];for(;e;e=e.parentElement){const r=e.getBoundingClientRect(),s=getComputedStyle(e);out.push({class:e.className,width:r.width,left:r.left,max:s.maxWidth,display:s.display})}return out}));console.log('task aggregates',await frame.evaluate(async()=>{const {store}=await import('/action-center-demo/src/store.js');return {total:store.tasks.length,owners:store.tasks.reduce((a,t)=>(a[t.owner]=(a[t.owner]||0)+1,a),{}),types:store.tasks.reduce((a,t)=>(a[t.type]=(a[t.type]||0)+1,a),{}),clock:store.clock,keys:Object.keys(store.tasks[0]||{})}}));}
await page.screenshot({path:'artifacts/morning-brew-v2/before-wide-board.png'});
await page.getByRole('button',{name:/Student 360/}).first().click();await page.waitForTimeout(2500);await page.screenshot({path:'artifacts/morning-brew-v2/before-wide-360.png',fullPage:true});console.log('360 ancestors',await page.locator('[class*=student360_root]').evaluate(e=>{const out=[];for(;e;e=e.parentElement){const r=e.getBoundingClientRect(),s=getComputedStyle(e);out.push({class:e.className,width:r.width,left:r.left,max:s.maxWidth})}return out}));
await browser.close();
