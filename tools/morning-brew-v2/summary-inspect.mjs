import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.on('pageerror',e=>console.log('ERROR',e.message));
await page.goto('http://localhost:3012/staff');await page.getByRole('button',{name:/Camila/}).click();await page.getByRole('button',{name:'Looks good',exact:true}).click();await page.getByRole('button',{name:/Make my Morning Brew/}).click();
await page.locator('.brew-live-news').scrollIntoViewIfNeeded();await page.waitForTimeout(2500);await page.screenshot({path:'artifacts/morning-brew-v2/after-news.png'});
await page.getByRole('button',{name:/Task Board/}).first().click();await page.getByRole('button',{name:'For You 3 views'}).click();
const frame=page.frames().find(f=>f.url().includes('action-center-demo'));
await expect(frame.getByRole('heading',{name:/For You/})).toBeVisible();
for(const size of [{width:1440,height:900},{width:1440,height:800},{width:2560,height:1440},{width:820,height:1000}]){
 await page.setViewportSize(size);await page.waitForTimeout(300);
 for(const version of ['board','focus','portfolio']){
 await frame.locator(`[data-version=${version}]`).click();await page.waitForTimeout(200);
 await page.screenshot({path:`artifacts/morning-brew-v2/summary-${version}-${size.width}-${size.height}.png`});
 console.log(version,size,await frame.locator('#task-summary').evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight,width:e.clientWidth,scrollWidth:e.scrollWidth,counts:e.querySelector('.sum-match-count')?.textContent})));
 }
}
await browser.close();
