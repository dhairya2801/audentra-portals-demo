/** Explicit live-provider smoke against the isolated vNext runtime; incurs model usage. */
import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1512,height:982}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.setExtraHTTPHeaders({'x-demo-tenant-id':'00000000-0000-7000-8000-000000000003','x-demo-actor-type':'student','x-demo-actor-id':'ac2fa509-b4e3-402d-900b-ffb8440fc430','x-demo-student-id':'ac2fa509-b4e3-402d-900b-ffb8440fc430'});
try {
 await page.goto('http://localhost:3009/dev/edward');
 await expect(page.getByRole('heading',{name:'Edward Lab',exact:true})).toBeVisible();
 await expect(page.getByText('Persona switching unavailable on this backend',{exact:false})).toBeVisible();
 await page.waitForTimeout(1000);
 await page.getByPlaceholder('Message Edward').fill('What are my saved financial planning assumptions, and are they verified funds?');
 const [r]=await Promise.all([page.waitForResponse(r=>r.url().includes('/v1/student/assistant/messages')&&r.request().method()==='POST',{timeout:90000}),page.getByRole('button',{name:'Send message',exact:true}).click()]);expect(r.ok()).toBeTruthy();const answer=await r.json();
 await expect(page.getByText('gpt-5.6-luna',{exact:false}).first()).toBeVisible({timeout:45000});
 await page.screenshot({path:'artifacts/integration/screenshots/edward-lab-trace.png'});
 await page.getByRole('tab',{name:'Architecture',exact:true}).click();
 await expect(page.getByLabel('Trace to show on the map')).not.toHaveValue('');
 await page.screenshot({path:'artifacts/integration/screenshots/edward-lab-architecture.png'});
 expect(errors).toEqual([]);
 await fs.writeFile('artifacts/integration/lab-live-result.json',JSON.stringify({passed:true,response:answer,errors},null,2));
 console.log('Live Luna response, trace inspector and Architecture map passed');
}finally{await browser.close();}
