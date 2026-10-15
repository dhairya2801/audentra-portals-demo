// Render-only regression: canonical registration requirements survive checklist consolidation.
import {chromium,expect,request} from '@playwright/test';
import assert from 'node:assert/strict';
const base='http://localhost:3012',api=await request.newContext({baseURL:base});
assert.ok((await api.post('/v1/auth/demo/sign-in-as',{data:{studentRef:'SYN-000061'}})).ok());
const original=await (await api.get('/v1/student/requirements')).json();
const browser=await chromium.launch({channel:'chrome'}),page=await browser.newPage({storageState:await api.storageState()});page.setDefaultTimeout(20000);
let status='under_review';
try{
 await page.route('**/v1/student/requirements',route=>route.fulfill({json:{...original,total:2,items:original.items.filter(item=>['official_transcript','ada_updated_transcript'].includes(item.code)).map(item=>({...item,status:item.code==='official_transcript'?status:'ready',blocking:item.code==='official_transcript'}))}}));
 await page.goto(base+'/enrollment');await expect(page.getByRole('heading',{name:'Your enrollment checklist',exact:true})).toBeVisible();
 await expect(page.getByText(/is with Aster\. Nothing more is needed from you before you register/)).toBeVisible();
 await expect(page.locator('.enrollment-task')).toHaveCount(1);
 status='blocked';await page.reload();
 await page.getByRole('button',{name:'See the step',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('dialog')).toContainText('Submit your final transcript');
 console.log('PASS canonical review notice and blocked-step help remain reachable; one visible transcript card; no server writes');
}finally{await browser.close();await api.dispose();}
