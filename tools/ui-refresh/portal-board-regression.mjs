import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const base=process.env.PORTAL_BASE||'http://127.0.0.1:3019',api=process.env.API_BASE||'http://127.0.0.1:45619';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1512,height:1050}});
 await page.request.post(api+'/v1/auth/demo/staff/sign-in-as',{data:{staffRef:'AU-55ff7e408818'}});
 await page.goto(base+'/staff#tasks');
 const frame=page.frameLocator('#approved-task-board');await frame.locator('.task-card').first().waitFor();
 const snapshot=await (await page.request.get(api+'/v1/staff/demo-task-board')).json();
 const cards=snapshot.cards.filter(c=>c.board==='en-docs');
 await expect(frame.locator('.task-card')).toHaveCount(cards.length);
 const sum=async()=> (await frame.locator('.column-count').allTextContents()).reduce((n,s)=>n+Number(s),0);
 assert.equal(await sum(),cards.length);
 await frame.locator('#filter-priority').selectOption('High');
 await expect(frame.locator('.task-card')).toHaveCount(cards.filter(c=>c.priority==='high').length);
 assert.equal(await sum(),cards.filter(c=>c.priority==='high').length);
 await frame.locator('#filter-priority').selectOption('all');
 const card=cards.find(c=>c.priority!=='high');
 // A canonical mutation invalidates the open board, including active filters.
 const mutation=await page.request.patch(api+'/v1/staff/work-items/'+card.id,{data:{expectedVersion:card.version,priority:'high'}});
 assert.ok(mutation.ok(),await mutation.text());
 await page.evaluate(()=>window.dispatchEvent(new Event('vv:student-record-changed')));
 await frame.locator('#filter-priority').selectOption('High');
 await expect(frame.locator(`[data-task="${card.key}"]`)).toBeVisible({timeout:20000});
 await page.reload();await expect(frame.locator(`[data-task="${card.key}"]`)).toContainText('High');
 // The ordinary board retains server-side counts and filters over more than a page.
 await page.request.post(api+'/v1/auth/demo/staff/sign-in-as',{data:{staffRef:'AU-9d0ee4af-210'}});
 await page.reload();await frame.locator('.task-card').first().waitFor();
 await frame.locator('#filter-priority').selectOption('High');
 const canonical=await (await page.request.get(api+'/v1/staff/work-board?project=en-docs&priority=high&status=all')).json();
 await expect(frame.locator('#result-count')).toContainText(`${canonical.page.total} matching tasks`);
 await expect(frame.locator('.task-card')).toHaveCount(canonical.cards.length);
 await frame.locator('.task-card').first().click();
 const execution=frame.locator('#execution-form');await execution.waitFor();
 await execution.locator('[name="priority"]').selectOption('medium');
 const saved=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().includes('/v1/staff/work-items/'));
 await execution.getByRole('button',{name:'Save changes'}).click();assert.ok((await saved).ok());
 await expect(frame.locator('#task-dialog [name="priority"]')).toHaveValue('medium');
 console.log('PASS demo counts, filters, canonical invalidation/reload and ordinary server-paged board filters, totals, priority edit');
}finally{await browser.close();}
