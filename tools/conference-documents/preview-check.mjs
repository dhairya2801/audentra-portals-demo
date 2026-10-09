import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const root='../morning-brew-platform-sprint-1oct-v2/artifacts/conference',headers={'x-tenant-id':'00000000-0000-7000-8000-000000000003',origin:'http://localhost:3012'};
const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.request.post('http://localhost:4112/v1/auth/demo/staff/sign-in-as',{headers,data:{staffRef:'AU-55ff7e408818'}});
const response=await ctx.request.get('http://localhost:4112/v1/staff/demo-task-board',{headers}),cards=(await response.json()).cards;
const page=await ctx.newPage();await page.goto('http://localhost:3012/staff#tasks');const frame=page.frameLocator('#approved-task-board');
await frame.locator('[data-task]').first().waitFor();const report=[];
for(const category of ['transcript','identity','health','financial_aid']){
 const card=cards.find(c=>c.student.id==='3bedfe91-6802-4937-893b-72cb7779ecfa'&&c.documents?.[0]?.category===category&&c.documents[0].extraction?.status==='completed');if(!card)throw Error('Missing parsed '+category);
 await page.locator('#approved-task-board').evaluate((el,board)=>el.contentWindow.postMessage({type:'audentra:approved-board:select',board},location.origin),card.board);
 const item=frame.locator(`[data-task="${card.key}"]`).first();await item.waitFor();await item.click();
 await frame.locator('[data-original-document] canvas, [data-original-document] img').waitFor();
 await expect(frame.locator('.review-table th').first()).toHaveText('Field');
 if(!await frame.locator('.document-value').count())throw Error('No fields');
 await page.screenshot({path:`${root}/preview-${category}-desktop.png`,fullPage:true});
 await page.setViewportSize({width:390,height:844});
 const closeBounds=await frame.getByRole('button',{name:'Close task',exact:true}).boundingBox();
 if(!closeBounds||closeBounds.x<0||closeBounds.x+closeBounds.width>390)throw Error('Mobile close button clipped');
 await page.screenshot({path:`${root}/preview-${category}-mobile.png`,fullPage:true});await page.setViewportSize({width:1440,height:1000});
 const download=page.waitForEvent('download');await frame.getByRole('button',{name:'Download original document',exact:true}).click();await(await download).saveAs(`${root}/download-${category}.pdf`);
 report.push({category,originalRendered:true,fields:await frame.locator('.document-value').count(),downloaded:true});await frame.getByRole('button',{name:'Close task',exact:true}).click();
}
await fs.writeFile(`${root}/preview-results.json`,JSON.stringify(report,null,2));console.log(report);await browser.close();
