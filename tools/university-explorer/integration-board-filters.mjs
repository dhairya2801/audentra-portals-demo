import {chromium,expect} from '@playwright/test';
const headers={'x-demo-tenant-id':'00000000-0000-7000-8000-000000000003','x-demo-actor-type':'staff','x-demo-actor-id':'01973261-954a-5019-8e9e-24a699abea7b'};
const api='http://127.0.0.1:45619/v1/staff/work-board';
async function read(params){const response=await fetch(api+'?'+new URLSearchParams(params),{headers});expect(response.ok).toBeTruthy();return response.json();}
const first=await read({project:'en-docs'}),next=await read({project:'en-docs',offset:100});
expect(next.cards.length).toBeGreaterThan(0);
let target;
for(const candidate of next.cards){
 const response=await fetch('http://127.0.0.1:45619/v1/staff/work-items/'+candidate.id,{headers});
 expect(response.ok).toBeTruthy();const detail=await response.json();
 if(detail.relatedItems.length){target=candidate;break;}
}
expect(target,'A page-two student with related canonical work is required').toBeTruthy();
expect(first.cards.map(c=>c.id)).not.toContain(target.id);
const match=await read({project:'en-docs',search:target.key});
expect(match.cards.map(c=>c.id)).toContain(target.id);
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1512,height:982}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.setExtraHTTPHeaders(headers);
 await page.goto('http://localhost:3009/staff#tasks');
 const board=page.frameLocator('#approved-task-board');
 await expect(board.locator('[data-task]').first()).toBeVisible({timeout:45000});
 await expect(board.locator('.board-footer')).toContainText(first.page.total+' matching work items');
 await board.getByRole('textbox',{name:'Search this board'}).fill(target.key);
 await expect(board.locator('[data-task="'+target.key+'"]').first()).toBeVisible({timeout:30000});
 await expect(board.locator('.board-footer')).toContainText(match.page.total+' matching work items');
 await expect(board.getByRole('textbox',{name:'Search this board'})).toHaveValue(target.key);
 await board.locator('[data-task="'+target.key+'"]').first().click();
 await expect(board.locator('#task-dialog')).toBeVisible();
 const related=board.locator('[data-related]').first();
 await expect(related).toBeVisible();
 const relatedLabel=await related.textContent();
 const relatedKey=relatedLabel.split(' · ')[0].trim();
 expect(relatedKey).not.toBe(target.key);
 await related.click();
 await expect(board.locator('.detail-breadcrumb strong')).toHaveText(relatedKey);
 await board.locator('[data-close]').click();

 await board.getByRole('button',{name:'Clear',exact:true}).click();
 await expect(board.locator('.board-footer')).toContainText(first.page.total+' matching work items');
 // Hold an older search while the next query finishes; late responses must be ignored.
 let releaseOld,signalOld;
 const oldGate=new Promise(resolve=>{releaseOld=resolve;});
 const oldStarted=new Promise(resolve=>{signalOld=resolve;});
 await page.route('**/*work-board*',async route=>{
   if(new URL(route.request().url()).searchParams.get('search')===target.key){signalOld();await oldGate;}
   await route.continue();
 });
 await board.getByRole('textbox',{name:'Search this board'}).fill(target.key);
 await oldStarted;
 const newer=first.cards[0];
 await board.getByRole('textbox',{name:'Search this board'}).fill(newer.key);
 await expect(board.locator('[data-task="'+newer.key+'"]').first()).toBeVisible({timeout:30000});
 const oldResponse=page.waitForResponse(response=>new URL(response.url()).searchParams.get('search')===target.key);
 releaseOld();await (await oldResponse).finished();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await expect(board.getByRole('textbox',{name:'Search this board'})).toHaveValue(newer.key);
 await expect(board.locator('[data-task="'+target.key+'"]')).toHaveCount(0);
 await board.getByRole('button',{name:'Clear',exact:true}).click();
 await expect(board.locator('.board-footer')).toContainText(first.page.total+' matching work items');
 await page.unroute('**/*work-board*');
 await board.getByRole('combobox',{name:'Priority',exact:true}).selectOption('Low');
 const low=await read({project:'en-docs',priority:'low'});
 await expect(board.locator('.board-footer')).toContainText(low.page.total+' matching work items');
 await board.getByRole('combobox',{name:'Quick filters',exact:true}).selectOption('exceptions');
 const attention=await read({project:'en-docs',priority:'low',quick:'exceptions'});
 await expect(board.locator('.board-footer')).toContainText(attention.page.total+' matching work items');
 await expect(board.locator('.board-footer')).toContainText('page 1');
 await page.route('**/*work-board*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'TEMPORARILY_UNAVAILABLE',message:'Test unavailable'}})}));
 await board.getByRole('combobox',{name:'Sort tasks',exact:true}).selectOption('due');
 await expect(board.getByRole('alert')).toBeVisible({timeout:30000});
 await expect(board.locator('#board-area')).toHaveAttribute('aria-busy','false');
 await page.unroute('**/*work-board*');
 const retryResponse=page.waitForResponse(response=>response.url().includes('work-board')&&response.status()===200);
 await board.getByRole('button',{name:'Retry loading work items'}).click();
 await (await retryResponse).finished();
 await expect(board.locator('#board-area [role="status"]')).toHaveCount(0);
 await expect(board.getByRole('alert')).toHaveCount(0);
 await expect(board.locator('.board-footer')).toContainText(attention.page.total+' matching work items');
 await board.getByRole('combobox',{name:'Priority',exact:true}).selectOption('High');
 const high=await read({project:'en-docs',priority:'high',quick:'exceptions',sort:'due'});
 await expect(board.locator('.board-footer')).toContainText(high.page.total+' matching work items');
 await expect(board.locator('[data-task]').first()).toBeVisible();
 expect(high.page.hasMore,'The filtered fixture must exercise real pagination').toBeTruthy();
 const firstKey=await board.locator('[data-task]').first().getAttribute('data-task');
 await board.getByRole('button',{name:'Next',exact:true}).click();
 await expect(board.locator('.board-footer')).toContainText('page 2');
 await expect(board.locator('[data-task]').first()).not.toHaveAttribute('data-task',firstKey);
 await board.getByRole('button',{name:'Previous',exact:true}).click();
 await expect(board.locator('.board-footer')).toContainText('page 1');
 await expect(board.locator('[data-task]').first()).toHaveAttribute('data-task',firstKey);
 await expect(board.locator('#toast')).toBeHidden({timeout:10000});
 await page.screenshot({path:'artifacts/integration/screenshots/board-filtered.png'});
 expect(errors).toEqual([]);
 console.log('Full-queue board search, priority, attention, pagination, page reset, related-work navigation, stale-response rejection and failed-load retry passed');
} finally {await browser.close();}
