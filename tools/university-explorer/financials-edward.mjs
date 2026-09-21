// Explicit provider-backed, read-only demo finance evaluation. Captures stay ignored.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { request } from '@playwright/test';
const base = process.env.FINANCIAL_API || 'http://127.0.0.1:45619';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const api = await request.newContext({baseURL:base,extraHTTPHeaders:{'x-demo-tenant-id':'00000000-0000-7000-8000-000000000003'},timeout:180000});
assert.ok((await api.post('/v1/auth/demo/sign-in-as',{data:{studentRef:'SYN-000061'}})).ok());
const cases = [
 ['balance','What is my posted university balance, and what will remain after scheduled aid arrives? Show the arithmetic.', ['7,133','2,731.45','4,401.55']],
 ['charges','Break down my fall university charges. What are tuition, fees, housing, meals and health insurance, and their total?', ['14,450','725','3,625','1,450','1,850','22,100']],
 ['payments','What payments have actually been received? Include the deposit and family payment, dates, methods and total.', ['500','2,500','3,000']],
 ['aid','What scholarships and grants do I have for fall? Separate accepted, offered and posted amounts. Is any scholarship still to arrive?', ['6,000','2,772','3,195','1,000','3,250']],
 ['loans','For my subsidized loan, give the accepted principal, fee percentage and dollar fee, net disbursement, scheduled date, interest and repayment term. Is it posted?', ['1,750','1.06','18.55','1,731.45','6.39']],
 ['deadlines','Which grant and loan offers are still awaiting my decision? Give fall amounts and decision deadlines.', ['3,250','1,000','September 30']],
 ['plan','Am I enrolled in a payment plan? What is the proposed principal, each installment and date, fee, and total if I enroll?', ['4,401.55','1,100.39','1,100.38','45','4,446.55']],
 ['living','What is my living budget for books, transportation and personal expenses? How much savings, family support and expected earnings cover it? What is left over?', ['600','730','1,500','2,830','1,800','675','3,975','1,145']],
 ['attendance','What is my full fall cost of attendance including the university bill and my separate personal living budget? Show how the totals relate.', ['22,100','2,830','24,930']],
 ['grant_effect','If my offered Need Grant is accepted and disbursed, how would that change the estimated amount left after scheduled aid? Does merely accepting it change the posted balance?', ['3,250','4,401.55','1,151.55']],
 ['work','Does my campus employment award pay my tuition? What is the annual authorization, fall amount and how is it used in my living budget?', ['3,000','1,500']],
 ['housing','What do my current housing and meals cost together? Compare the suite double room and ten-meals-weekly plan to my current charges without changing anything.', ['3,625','1,450','5,075','4,050','1,025']],
];
const selected=process.env.FINANCIAL_CASES ? cases.filter(([id])=>process.env.FINANCIAL_CASES.split(',').includes(id)) : cases;
const resultFile=process.env.FINANCIAL_CASES ? 'artifacts/financials/edward-followup-results.json' : 'artifacts/financials/edward-results.json';
const output=[];
await fs.mkdir('artifacts/financials',{recursive:true});
for(let i=0;i<selected.length;i+=2){
 await Promise.all(selected.slice(i,i+2).map(async([id,message,expected])=>{
  const response=await api.post('/v1/student/assistant/messages',{data:{message,clientMessageId:crypto.randomUUID(),pageContext:'/financials'}});
  const data=await response.json(); const answer=data.message || '';
  const missing=expected.filter(value=>!answer.toLowerCase().includes(value.toLowerCase()));
  output.push({id,question:message,status:response.status(),provider:data.provider,model:data.model,answer,missing,requestId:data.requestId,receipts:data.contextReceipts});
  console.log(id,response.status(),data.provider,'literal checks missing:',missing.join(', ')||'none');
 }));
 await fs.writeFile(resultFile,JSON.stringify(output,null,2));
}
assert.ok(output.every(r=>r.status===200 && r.provider==='openai' && r.answer),'Provider-backed responses required');
console.log('Review',output.length,'answers in artifacts/financials/edward-results.json; numeric checks are a review aid, not a semantic judge.');
await api.dispose();
