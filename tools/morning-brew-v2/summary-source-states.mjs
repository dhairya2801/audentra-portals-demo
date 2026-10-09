import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:3012/staff');await page.getByRole('button',{name:/Camila/}).click();await page.getByRole('button',{name:'Looks good',exact:true}).click();await page.getByRole('button',{name:/Make my Morning Brew/}).click();
const pattern='**/v1/staff/demo-task-board';let release;const gate=new Promise(r=>release=r);
await page.route(pattern,async route=>{await gate;await route.fulfill({status:503,json:{error:{code:'UNAVAILABLE',message:'Browser-test unavailable'}}});});
await page.getByRole('button',{name:/Task Board/}).first().click();await expect(page.getByText('Loading your task workspace', {exact:true})).toBeVisible();release();
let frame=page.frames().find(f=>f.url().includes('action-center-demo'));await expect(frame.getByRole('heading',{name:'Task board unavailable'})).toBeVisible();await expect(page.getByRole('button',{name:'For You 3 views'})).toHaveCount(0);
await page.unroute(pattern);await page.route(pattern,async route=>{const response=await route.fetch();await route.fulfill({response,json:{...(await response.json()),cards:[]}});});await frame.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('button',{name:'For You 3 views'}).click();await expect(frame.locator('.sum-source-count')).toHaveAttribute('data-total','0');
for(const version of ['board','focus','portfolio']){await frame.locator(`[data-version=${version}]`).click();await expect(frame.getByRole('heading',{name:'No tasks in this view'})).toBeVisible();await expect(frame.locator('.sum-metric[data-bucket=open]')).toHaveAttribute('data-count','0');}
await page.unroute(pattern);await frame.getByRole('button',{name:'Refresh',exact:true}).click();await expect.poll(()=>frame.locator('.sum-source-count').getAttribute('data-total')).toBe('66');await expect(frame.getByRole('heading',{name:'Workload by board'})).toBeVisible();
await page.screenshot({path:'artifacts/morning-brew-v2/chrome-source-recovered.png'});assert.deepEqual(errors,[]);console.log('PASS source loading, initial failure, Retry, empty authorized dataset in all designs, refresh recovery to the actual API dataset');await browser.close();
