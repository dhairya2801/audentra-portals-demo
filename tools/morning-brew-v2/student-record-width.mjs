import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome'});
const p=await browser.newPage({viewport:{width:2560,height:1440}});
await p.goto('http://localhost:3012/staff');await p.getByRole('button',{name:/Camila/}).click();await p.getByRole('button',{name:/Student 360/}).first().click();await p.getByRole('button',{name:/Open Ada.s live record/}).click();
await expect(p.getByRole('heading',{name:'Ada Kettleby',exact:true})).toBeVisible();
for(const size of [{width:2560,height:1440},{width:1440,height:900},{width:820,height:1000}]){await p.setViewportSize(size);await p.screenshot({path:`artifacts/morning-brew-v2/chrome-student-record-${size.width}.png`,fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
console.log('PASS Student 360 live demo record at monitor, laptop and narrower widths');await browser.close();
