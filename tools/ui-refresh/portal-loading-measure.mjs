import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const base=process.env.PORTAL_BASE||'http://127.0.0.1:3019';
const api=process.env.API_BASE||'http://127.0.0.1:45619';
const browser=await chromium.launch();
const results=[];
try {
 for(const target of (process.env.TARGET?[process.env.TARGET]:['students','tasks'])) {
  const context=await browser.newContext();const page=await context.newPage();
  const requests=[];page.on('requestfinished',async r=>{if(r.url().includes('/v1/'))requests.push({path:new URL(r.url()).pathname+new URL(r.url()).search,ms:Math.round(r.timing().responseEnd),bytes:(await r.sizes()).responseBodySize});});
  await page.request.post(api+'/v1/auth/demo/staff/sign-in-as',{data:{staffRef:process.env.STAFF_REF||'AU-55ff7e408818'}});
  for(const run of ['cold','warm']) {
   requests.length=0;const start=performance.now();
   if(run==='cold')await page.goto(`${base}/staff#${target}`);
   else {await page.getByRole('button',{name:'Morning Brew',exact:true}).filter({visible:true}).click();await page.getByRole('button',{name:target==='students'?'Student 360':/Task board/i,exact:true}).filter({visible:true}).click();}
   const content=target==='students'?page.locator('tbody tr').first():page.frameLocator('#approved-task-board').locator('.task-card').first();
   await content.waitFor({timeout:120000});
   results.push({target,run,usableMs:Math.round(performance.now()-start),requests:[...requests]});
  }
  await context.close();
 }
 console.log(JSON.stringify(results,null,2));
 await writeFile(process.argv[2]||'/tmp/portal-loading.json',JSON.stringify(results,null,2));
} finally {await browser.close();}
