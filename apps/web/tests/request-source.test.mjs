import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestSource,requestWorkspace,requestState} from '../public/action-center-demo/src/requests.js';
import {seedTasks} from '../public/action-center-demo/src/data.js';

test('native email source retains its own headers and sent date',()=>{
 const source=requestSource({title:'Question',student:'Student',sourceEmail:{body:'Original body',from:'sender@example.test',to:['advisor@example.test'],cc:['helper@example.test'],subject:'Original subject',sentAt:'2026-10-12T12:00:00Z'}});
 assert.equal(source.channel,'Email');assert.equal(source.preview,false);assert.equal(source.subject,'Original subject');assert.equal(source.at,'2026-10-12T12:00:00Z');assert.deepEqual(source.cc,['helper@example.test']);
});
test('canonical inbound portal evidence takes precedence over template text',()=>{
 const source=requestSource({title:'Question',student:'Student',requestText:'Old template',conversations:[{messages:[{direction:'staff',body:'Staff-only response',createdAt:'2026-10-11T12:00:00Z'},{direction:'student',body:'Original request',authorName:'Ada',createdAt:'2026-10-10T12:00:00Z'},{direction:'student',body:'Later reply',createdAt:'2026-10-12T12:00:00Z'}]}]});
 assert.equal(source.body,'Original request');assert.equal(source.from,'Ada');assert.equal(source.channel,'Student portal');assert.match(source.cc,/Not applicable/);
});
test('missing email metadata is not invented from task creation or the student email',()=>{
 const source=requestSource({title:'Question',student:'Ada',studentEmail:'ada@example.test',created:'2026-10-12T12:00:00Z',requestText:'Template request'});
 assert.equal(source.preview,true);assert.equal(source.at,null);assert.equal(source.to,'Not supplied');
});
test('request view escapes evidence and preserves a staff-edited draft on reopen',()=>{
 const task=seedTasks().find(t=>t.key==='ENR-088');
 task.sourceEmail={body:'<script>bad()</script>',from:'<img onerror=bad>',subject:'<b>Subject</b>'};
 requestState(task).draft='Edited response <script>';
 const html=requestWorkspace(task);
 assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Edited response &lt;script&gt;'));
 assert.equal(requestState(task).draft,'Edited response <script>');
});
