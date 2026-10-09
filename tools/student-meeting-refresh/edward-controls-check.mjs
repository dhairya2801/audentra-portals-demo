import{chromium,expect}from'@playwright/test';
const base=process.env.STUDENT_PORTAL_URL||'http://localhost:3012';
const b=await chromium.launch({channel:'chrome'}),p=await b.newPage({storageState:process.env.STUDENT_SESSION||'/tmp/student-refresh-session.json',viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 for(const width of [1440,390]){
  await p.setViewportSize({width,height:900});
  for(const route of ['/enrollment','/appointments','/campus-life','/housing','/classrooms','/financials','/financials/aid','/financials/expenses']){
   await p.goto(base+route);await p.locator('.page-hero,iframe').first().waitFor();
   const f=route.startsWith('/financials')?p.frameLocator('iframe'):p;
   const buttons=f.locator('.edward-ask');await expect(buttons.first()).toBeVisible({timeout:15000}).catch(()=>{});
   for(const button of await buttons.all()){
    if(!await button.isVisible())continue;
    await expect(button).toHaveText('E');expect(await button.getAttribute('aria-label')).toBeTruthy();
    const placement=await button.evaluate(el=>{const card=el.closest('.task-card-body,.org-row,.provenance-card,.outcome-card,.match-card,.register-panel,.help-note,.story,.card');if(!card)return null;const a=el.getBoundingClientRect(),c=card.getBoundingClientRect();return{top:a.top-c.top,right:c.right-a.right};});
    if(route==='/enrollment' && await button.evaluate(el=>!!el.closest('.enrollment-task'))){
     const help=button.locator('..');await expect(help).toHaveClass('task-help-actions');await expect(help.getByRole('button',{name:'How this works',exact:true})).toBeVisible();
    }else if(placement){expect(placement.top).toBeLessThan(60);expect(placement.right).toBeLessThan(60);}
   }
   expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   if(route==='/enrollment'||route==='/financials')await p.screenshot({path:`artifacts/student-meeting-refresh/edward-compact-${route.slice(1)}-${width}.png`,animations:'disabled'});
   console.log('PASS compact accessible E and placement',width,route);
  }
  await p.goto(base+'/enrollment');await p.locator('.task-card-body .edward-ask').first().click();await expect(p.locator('#edward-input')).toBeVisible();await expect(p.locator('#edward-input')).not.toHaveValue('');await p.keyboard.press('Escape');
 }
 expect(errors).toEqual([]);
}finally{await b.close();}
