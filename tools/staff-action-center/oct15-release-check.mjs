import {chromium,firefox,expect,request} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.STAFF_BASE_URL||'http://localhost:3012',engine=process.env.STAFF_BROWSER||'chromium';
const output=`artifacts/staff-action-center-oct15/${new URL(base).hostname==='test.audentra.ai'?'live/':''}${engine}`;await mkdir(output,{recursive:true});
const api=await request.newContext({baseURL:base});
for(const [path,data] of [['staff/sign-in-as',{staffRef:'AU-55ff7e408818'}],['sign-in-as',{studentRef:'SYN-000061'}]])assert.ok((await api.post('/v1/auth/demo/'+path,{data})).ok());
const browser=await ({chromium,firefox}[engine]).launch(engine==='chromium'?{channel:'chrome'}:{});
const context=await browser.newContext({storageState:await api.storageState(),viewport:{width:1440,height:1000},reducedMotion:'reduce'});
context.setDefaultTimeout(20000);
const staff=await context.newPage(),student=await context.newPage(),errors=[],results=[];
for(const p of [staff,student])p.on('pageerror',e=>errors.push(e.message));
try{
 await staff.goto(base+'/staff#tasks');const frame=staff.frameLocator('#approved-task-board');await frame.locator('.board-heading').waitFor();
 await staff.getByRole('button',{name:'For You',exact:true}).click();
 await expect(frame.getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');
 await student.goto(base+'/enrollment');await student.getByRole('heading',{name:'Your enrollment checklist',exact:true}).waitFor();
 const update=student.getByRole('dialog');if(await update.count()) {const later=update.getByRole('button',{name:/later|continue|close|got it/i}).first();if(await later.count())await later.click();}
 await expect(student.getByRole('heading',{name:'Welcome, Ada. Here’s what’s next.',exact:true})).toBeVisible();
 for(const title of ['Submit your immunization documents','Submit your identity documentation','Complete your financial aid verification steps','Submit your final transcript','Provide proof of funds'])await expect(student.getByRole('heading',{name:title,exact:true})).toHaveCount(1);
 await expect(student.locator('main')).not.toContainText(/Upload updated transcript|Review final high school transcript|Upload your latest transcript|Submit your official transcript/);
 const counts=[];
 for(const [width,height] of (process.env.RELEASE_QUICK==='1'?[[1440,1000],[390,844]]:[[320,740],[390,844],[600,900],[768,1024],[1024,768],[1280,800],[1440,1000],[1920,1080],[2560,1440],[844,390]])){
  await staff.setViewportSize({width,height});await student.setViewportSize({width,height});
  for(const view of ['Overview','Board','Focus','Portfolio']){
   await frame.getByRole('tab',{name:view,exact:true}).click();
   await expect(frame.getByRole('tab',{name:view,exact:true})).toHaveAttribute('aria-selected','true');
   assert.deepEqual(await frame.getByRole('tablist',{name:'For You views'}).getByRole('tab').allTextContents(),['Overview','Board','Focus','Portfolio']);
   const root=frame.locator(view==='Overview'?'#task-summary':'#task-summary-legacy');
   assert.ok(await root.evaluate(e=>e.scrollWidth<=e.clientWidth+3),`${view} overflows at ${width}`);
   if(view==='Board')await expect(frame.locator('.sum-board')).toBeVisible();
   if(view==='Focus')await expect(frame.locator('.sum-preview')).toBeVisible();
   if(view==='Portfolio')await expect(frame.locator('.sum-portfolio')).toBeVisible();
   if([390,1440,1920].includes(width)){await root.evaluate(e=>e.scrollTop=0);await staff.screenshot({path:`${output}/${view.toLowerCase()}-${width}.png`});}
  }
  assert.ok(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`Enrollment overflow ${width}`);
  if([390,1440,1920].includes(width))await student.screenshot({path:`${output}/enrollment-${width}.png`,fullPage:true});
  results.push({width,height,status:'pass'});console.log('PASS',engine,width,height,'four views + enrollment');
 }
 await staff.setViewportSize({width:1440,height:1000});
 console.log('Checking shared filters and keyboard navigation');
 // Filters transfer across views, with a real empty state and keyboard tab navigation.
 await frame.locator('#sum-search').fill('no-match-oct15');
 for(const view of ['Board','Focus','Portfolio','Overview']){
  await frame.getByRole('tab',{name:view,exact:true}).click();
  await expect(frame.locator(view==='Overview'?'#fy-search':'#sum-search')).toHaveValue('no-match-oct15');
  await expect(frame.locator(view==='Overview'?'.fy-empty':'.sum-empty')).toBeVisible();
 }
 await frame.locator('#fy-search').fill('');await frame.locator('#fy-owner').selectOption('all');await frame.locator('#fy-space').selectOption('fa');
 for(const view of ['Board','Focus','Portfolio']){
  await frame.getByRole('tab',{name:view,exact:true}).click();await expect(frame.locator('#sum-owner')).toHaveValue('all');await expect(frame.locator('#sum-space')).toHaveValue('fa');
  counts.push(await frame.locator('.sum-source-count').innerText());
 }
 assert.equal(new Set(counts).size,1);
 await frame.getByRole('tab',{name:'Portfolio',exact:true}).focus();await staff.keyboard.press('Home');await expect(frame.getByRole('tab',{name:'Overview',exact:true})).toBeFocused();
 await staff.keyboard.press('ArrowRight');await expect(frame.getByRole('tab',{name:'Board',exact:true})).toBeFocused();
 console.log('Checking task opening from each view');
 await frame.locator('#sum-space').selectOption('all');await frame.locator('#sum-owner').selectOption('ML');
 await frame.locator('.sum-task-card').first().click();await expect(frame.locator('#task-dialog')).toBeVisible();await frame.getByRole('button',{name:'Close task',exact:true}).click();
 console.log('Checking Focus task');
 await frame.getByRole('tab',{name:'Focus',exact:true}).click();await frame.locator('.sum-preview [data-summary-task]').click();await expect(frame.locator('#task-dialog')).toBeVisible();await frame.getByRole('button',{name:'Close task',exact:true}).click();
 console.log('Checking Portfolio task');
 await frame.getByRole('tab',{name:'Portfolio',exact:true}).click();await frame.locator('.sum-stack button').first().click();console.log('Portfolio list opened');await expect(frame.locator('.sum-dialog')).toBeVisible();await frame.locator('.sum-dialog [data-summary-task]').first().click();console.log('Portfolio detail opened');await expect(frame.locator('#task-dialog')).toBeVisible();await frame.getByRole('button',{name:'Close task',exact:true}).click();
 await frame.getByRole('tab',{name:'Overview',exact:true}).click();
 console.log('Checking overview response queue');
 await frame.locator('[data-group]').filter({hasText:'Respond to students'}).click();for(let i=0;i<20&&!await frame.locator('.rq-workspace').count();i++)await frame.getByRole('button',{name:'Next task',exact:true}).click();await expect(frame.locator('.rq-workspace')).toBeVisible();await expect(frame.locator('.context-panel')).toBeVisible();await frame.getByRole('button',{name:'Close task',exact:true}).click();
 console.log('Checking enrollment transcript route');
 await student.setViewportSize({width:1440,height:1000});
 await student.getByRole('heading',{name:'Submit your final transcript',exact:true}).locator('xpath=ancestor::article[1]').locator('.task-action>button').click();
 await expect(student).toHaveURL(/\/enrollment\/requirements\/ada-updated-transcript/);
 await expect(student.getByRole('heading',{name:'Submit your final transcript',exact:true})).toBeVisible();
 await expect(student.locator('input[type="file"]')).toHaveCount(1);
 assert.deepEqual(errors,[]);await writeFile(`${output}/results.json`,JSON.stringify({base,engine,results,counts,errors},null,2));
 console.log('PASS filters shared, keyboard tabs, task opening in all views, enrollment copy and canonical transcript route');
}catch(error){console.error(error.message);await staff.screenshot({path:`${output}/failure.png`,timeout:10000}).catch(()=>{});throw error;}finally{await browser.close();await api.dispose();}
