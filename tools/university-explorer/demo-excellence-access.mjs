import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const b=await chromium.launch();const root='artifacts/demo-excellence';const results=[];
for(const role of ['student','staff']){
 const p=await b.newPage({viewport:{width:1512,height:982}});await p.goto('http://127.0.0.1:3009/'+(role==='staff'?'staff':'sign-in'));
 const option=p.getByRole('button',{name:role==='staff'?/Camila Abernathy/:/Continue as Wren/});await expect(option).toBeVisible({timeout:30000});await p.screenshot({path:root+'/final/'+role+'-sign-in.png',fullPage:true});await option.click();await expect(p.getByText(role==='staff'?'Camila Abernathy':'Wren',{exact:true}).first()).toBeVisible({timeout:30000});results.push(role+' one-click sign-in');await p.close();
}
for(const role of ['student','staff']){
 const p=await b.newPage({storageState:root+'/reference/'+role+'-session.json',viewport:{width:390,height:844}});await p.goto('https://test.audentra.ai/'+(role==='staff'?'staff#tasks':'financials'));await p.waitForTimeout(2200);await p.screenshot({path:root+'/reference/'+(role==='staff'?'board':'financials')+'-mobile.png'});await p.close();
}
await fs.writeFile(root+'/final/access-results.json',JSON.stringify(results,null,2));await b.close();console.log(results.join('; '),'and deployed mobile references captured');
