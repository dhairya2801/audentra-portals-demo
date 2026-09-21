// Provider-backed, read-only evaluation of the local demo runtime.
import {request} from '@playwright/test';
import fs from 'node:fs/promises';
const api=process.env.DEMO_API||'http://127.0.0.1:45649',root='artifacts/demo-excellence';
if(!['http://127.0.0.1:45619','http://127.0.0.1:45649'].includes(api))throw new Error('Use a local vNext demo runtime');
const headers={'x-demo-tenant-id':'00000000-0000-7000-8000-000000000003'};
const questions={student:[
'What do I currently owe? Distinguish the posted balance from pending money.',
'What aid was offered versus accepted versus actually disbursed? Include loans and employment.',
'Which payments are pending, failed or reversed? What happened to the family payment?',
'Why do I still have a hold, and what must happen before it can be released?',
'What financial requirements are incomplete, and what documents are under review?',
'What is my current financial plan and expected expenses?',
'How much have I budgeted for rent, groceries, books and transportation? Are my savings verified?',
'Which adviser should I talk to, and what appointments are scheduled?',
'What classes am I taking and what completed credit do I have?',
'What deadlines are coming up?',
'What clubs and campus events could be relevant to me?',
'What changed recently with my financial account and support team?'
],staff:[
'What should I work on today? Use my canonical Task Board work.',
'What are my urgent tasks?',
'Show me overdue Financial Aid tasks.',
'Which document-review tasks are blocked?',
'What tasks are assigned to me?',
'What is happening with Wren Halloway’s tasks?',
'Which cards are in Payments?',
'What is the priority, operational status, owner and due date of DEMO-126?',
'Which student is DEMO-113 for, and what payment is linked?',
'Which Task Board items are due today?',
'How many open items are in each Task Board project?'
]};
const results=[];
for(const role of (process.env.DEMO_EVAL_ROLE?[process.env.DEMO_EVAL_ROLE]:['student','staff'])){
 const c=await request.newContext({baseURL:api,extraHTTPHeaders:headers,timeout:120000});
 const signin=await c.post('/v1/auth/demo/'+(role==='staff'?'staff/':'')+'sign-in-as',{data:role==='student'?{studentRef:'SYN-000000'}:{staffRef:'AU-55ff7e408818'}});if(!signin.ok())throw Error('Demo sign-in failed');
 for(let i=0;i<questions[role].length;i+=3){await Promise.all(questions[role].slice(i,i+3).map(async message=>{
 const r=await c.post(role==='staff'?'/v1/staff/assistant/messages':'/v1/student/assistant/messages',{data:{message,clientMessageId:crypto.randomUUID(),...(role==='student'?{pageContext:"/dashboard"}:{})}});const data=await r.json();results.push({role,question:message,status:r.status(),message:data.message,provider:data.provider,model:data.model,receipts:data.contextReceipts,requestId:data.requestId});console.log(role,r.status(),message,'\n',data.message?.slice(0,250));
 }));await fs.writeFile(root+'/edward-reads'+(process.env.DEMO_EVAL_ROLE?'-'+process.env.DEMO_EVAL_ROLE:'')+'.json',JSON.stringify(results,null,2));}
 await c.dispose();
}
if(results.some(r=>r.status!==200||!r.message||r.provider!=='openai'))throw new Error('A provider-backed read did not complete; inspect the local evaluation artifact.');
console.log('Completed',results.length,'provider-backed questions');
