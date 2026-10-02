import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const moduleUrl=source=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')}`;
let source=await readFile(new URL('../app/lib/api-client.ts',import.meta.url),'utf8');
for(const [specifier,file] of [['./parent-portal-routes','../app/lib/parent-portal-routes.ts'],['../staff/task-board-utils','../app/staff/task-board-utils.ts']])source=source.replace(`from "${specifier}";`,`from ${JSON.stringify(moduleUrl(await readFile(new URL(file,import.meta.url),'utf8')))};`);
const client=await import(moduleUrl(source));
const path='/v1/staff/documents/00000000-0000-4000-8000-000000000001/content';
test('protected staff reads retain credentials, bypass cache, and reject student/external paths',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,init)=>{calls.push({url,init});return new Response('original',{headers:{'Content-Type':'application/pdf'}});};
 try{
  assert.equal(await(await client.getStaffDocumentContent(path)).text(),'original');
  assert.equal(calls[0].init.credentials,'include');assert.equal(calls[0].init.cache,'no-store');
  for(const invalid of [path.replace('/staff/','/student/'),'https://example.test'+path,'//example.test'+path])await assert.rejects(client.getStaffDocumentContent(invalid),{code:'invalid_staff_document_link'});
  assert.equal(calls.length,1);
 }finally{globalThis.fetch=original;}
});
test('closing a staff preview aborts the request; a timeout is a retryable error',async()=>{
 const original=globalThis.fetch,oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;let timeout;
 globalThis.setTimeout=fn=>{timeout=fn;return 1;};globalThis.clearTimeout=()=>{};
 globalThis.fetch=async(_url,init)=>new Promise((_resolve,reject)=>{if(init.signal.aborted)reject(new DOMException('Aborted','AbortError'));else init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});});
 try{
  const controller=new AbortController();const closed=client.getStaffDocumentContent(path,controller.signal);controller.abort();await assert.rejects(closed,{name:'AbortError'});
  const stalled=client.getStaffDocumentContent(path);timeout();await assert.rejects(stalled,{code:'document_content_timeout',status:504});
 }finally{globalThis.fetch=original;globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
});
test('expired staff sessions are not retried with another identity',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({error:{code:'UNAUTHORIZED',message:'Expired'}},{status:401});};
 try{await assert.rejects(client.getStaffDocumentContent(path),{status:401,code:'UNAUTHORIZED'});assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
