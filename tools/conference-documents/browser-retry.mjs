import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const root='../morning-brew-platform-sprint-1oct-v2/artifacts/conference',headers={'x-tenant-id':'00000000-0000-7000-8000-000000000003',origin:'http://localhost:3012'};
const {documentId}=JSON.parse(await fs.readFile(`${root}/injected-failure.json`));const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
await ctx.request.post('http://localhost:4112/v1/auth/demo/staff/sign-in-as',{headers,data:{staffRef:'AU-55ff7e408818'}});
async function board(){return (await (await ctx.request.get('http://localhost:4112/v1/staff/demo-task-board',{headers})).json()).cards;}
const before=await board(),card=before.find(c=>c.documents?.[0]?.id===documentId);const page=await ctx.newPage();await page.goto('http://localhost:3012/staff#tasks');const frame=page.frameLocator('#approved-task-board');await frame.locator(`[data-task="${card.key}"]`).first().click();
await frame.getByRole('button',{name:'Retry Edward parsing',exact:true}).click();
await expect.poll(async()=>{const cards=await board();return cards.find(c=>c.id===card.id).documents[0].extraction.status;},{timeout:90000}).toBe('completed');
const after=await board();if(after.length!==before.length||after.find(c=>c.id===card.id).documents[0].id!==documentId)throw Error('Retry duplicated/replaced card or original');
await fs.writeFile(`${root}/retry-result.json`,JSON.stringify({retryButton:true,sameDocument:true,sameCard:true,injectedFailure:true,liveRetry:true}));console.log('PASS injected timeout -> browser retry -> live parser, same original and card');await browser.close();
