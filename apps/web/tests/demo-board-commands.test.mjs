import assert from 'node:assert/strict';
import {test} from 'node:test';
import {command,conversation} from '../public/action-center-demo/src/connected.js';

function transport(handler){
 const listeners=new Set();
 globalThis.location={origin:'http://demo.test'};
 globalThis.window={addEventListener:(_name,fn)=>listeners.add(fn),removeEventListener:(_name,fn)=>listeners.delete(fn)};
 globalThis.parent={postMessage:message=>handler(message,result=>{
  for(const listener of [...listeners])listener({origin:location.origin,source:parent,
   data:{type:'audentra:board:response',id:message.id,...result}});
 })};
}

test('an uncertain response reuses its original key and version after a board refresh',async()=>{
 const sent=[];transport((message,reply)=>{sent.push(message.payload);queueMicrotask(()=>reply(sent.length===1?{error:'Response lost',errorCode:'REQUEST_FAILED'}:{result:{saved:true}}));});
 const payload={workItemId:'card',input:{kind:'message',body:'Hello',expectedVersion:1}};
 await assert.rejects(command('retry','demo-write',payload),/Response lost/);
 await command('retry','demo-write',{...payload,input:{...payload.input,expectedVersion:2}});
 assert.equal(sent[1].idempotencyKey,sent[0].idempotencyKey);
 assert.equal(sent[1].input.expectedVersion,1);
});

test('a confirmed version conflict permits a corrected request with a fresh key',async()=>{
 const sent=[];transport((message,reply)=>{sent.push(message.payload);queueMicrotask(()=>reply(sent.length===1?{error:'Stale',errorCode:'VERSION_CONFLICT'}:{result:{saved:true}}));});
 const payload={workItemId:'card',input:{kind:'message',body:'Hello',expectedVersion:1}};
 await assert.rejects(command('conflict','demo-write',payload),/Stale/);
 await command('conflict','demo-write',{...payload,input:{...payload.input,expectedVersion:2}});
 assert.notEqual(sent[1].idempotencyKey,sent[0].idempotencyKey);
 assert.equal(sent[1].input.expectedVersion,2);
});

test('duplicate submissions remain disabled until the first operation settles',async()=>{
 let finish;transport((_message,reply)=>{finish=reply;});
 const first=command('pending','demo-write',{input:{body:'Only once'}});
 await assert.rejects(command('pending','demo-write',{input:{body:'Only once'}}),/already being saved/);
 finish({result:{saved:true}});await first;
});

test('conversation bodies and author names render as text, including archived history',()=>{
 const markup=conversation({id:'card',student:'Ada',preferredName:'Ada',conversations:[
  {messages:[{direction:'staff',authorName:'<img onerror=bad>',body:'<script>bad()</script>',createdAt:'2026-09-14T12:00:00Z'}]},
  {messages:[{authorName:'Ada',body:'<iframe src=bad>',createdAt:'2026-09-13T12:00:00Z'}]},
 ]});
 assert.ok(!markup.includes('<script>'));assert.ok(!markup.includes('<img onerror'));
 assert.ok(!markup.includes('<iframe'));assert.ok(markup.includes('&lt;script&gt;'));
});
