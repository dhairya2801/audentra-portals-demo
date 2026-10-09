import {chromium,webkit} from '@playwright/test';
import fs from 'node:fs/promises';
const out='../morning-brew-platform-sprint-1oct-v2/artifacts/conference';
const tenant='00000000-0000-7000-8000-000000000003';
const results=[];
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 let browser;
 try{browser=await engine.launch({headless:true});}catch(e){results.push({browser:name,unavailable:e.message});continue;}
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 const headers={'x-tenant-id':tenant,origin:'http://localhost:3012'};
 for(const [path,data] of [['sign-in-as',{studentRef:'SYN-000061'}],['staff/sign-in-as',{staffRef:'AU-55ff7e408818'}]]){
  const r=await ctx.request.post('http://localhost:4112/v1/auth/demo/'+path,{headers,data});if(!r.ok())throw Error(await r.text());
 }
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3012/enrollment/requirements/ada-passport');
 await page.getByRole('button',{name:'Use demo document',exact:true}).waitFor();
 await page.screenshot({path:`${out}/${name}-student-desktop.png`,fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:`${out}/${name}-student-mobile.png`,fullPage:true});
 results.push({browser:name,student:true,mobileOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),errors});
 const staff=await ctx.newPage();await staff.goto('http://localhost:3012/staff#tasks');
 const frame=staff.frameLocator('#approved-task-board');
 await frame.locator('[data-task]').first().waitFor({timeout:45000});
 await staff.screenshot({path:`${out}/${name}-staff-desktop.png`,fullPage:true});
 await ctx.close();await browser.close();
}
await fs.writeFile(`${out}/browser-results.json`,JSON.stringify(results,null,2));console.log(results);
