import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, bucketFor, dueHours, orderTasks, reasonFor } from '../public/action-center-demo/src/summary-model.js';
import { seedTasks, DEMO_NOW, BOARDS } from '../public/action-center-demo/src/data.js';
const clock=DEMO_NOW,now=Date.parse(clock);
const task=(extra={})=>({key:'T-1',board:'en-docs',type:'document',owner:'ML',title:'Review transcript',student:'Demo student',status:'processing',priority:'Medium',due:null,...extra});

test('complete dataset reconciles across all boards and exclusive buckets',()=>{
 const tasks=seedTasks();const result=summarize(tasks,{bucket:'all'},clock,now);
 assert.equal(result.total,tasks.length);
 assert.equal(result.scoped.length,result.open+result.completed);
 assert.equal(Object.values(result.groups).flat().length,tasks.length);
 assert.equal(new Set(Object.values(result.groups).flat().map(t=>t.key)).size,tasks.length);
 assert.equal(result.boards.reduce((n,b)=>n+b.tasks.length,0),tasks.length);
 assert.deepEqual(new Set(result.boards.filter(b=>b.tasks.length).map(b=>b.id)),new Set(Object.keys(BOARDS)));
 assert.equal(result.attention,result.groups.overdue.length+result.groups.review.length);
});
test('does not truncate at a loaded board or page boundary',()=>{
 const tasks=Array.from({length:503},(_,i)=>task({key:`T-${i}`,board:Object.keys(BOARDS)[i%7]}));
 const result=summarize(tasks,{bucket:'open'},clock,now);
 assert.equal(result.total,503);assert.equal(result.selected.length,503);
});
test('deduplicates canonical IDs before counting',()=>{
 const a=task({id:'canonical-1'}),b=task({id:'canonical-1',title:'New title'});
 const result=summarize([a,b],{},clock,now);assert.equal(result.total,1);assert.equal(result.selected[0].title,'New title');
});
test('overlap precedence: completed, overdue, review, waiting, progress',()=>{
 const past=new Date(now-3600000).toISOString();
 assert.equal(bucketFor(task({status:'completed',due:past}),clock,now),'completed');
 assert.equal(bucketFor(task({status:'exceptions',due:past}),clock,now),'overdue');
 assert.equal(bucketFor(task({status:'exceptions'}),clock,now),'review');
 assert.equal(bucketFor(task({status:'correction'}),clock,now),'waiting');
 assert.equal(bucketFor(task(),clock,now),'progress');
});
test('deadline boundaries match the existing demo board clock and document clock',()=>{
 assert.equal(dueHours(task({due:clock}),clock,now),0);
 assert.equal(bucketFor(task({due:clock}),clock,now),'progress');
 assert.equal(dueHours(task({due:clock,actualDocument:{id:'doc'}}),clock,now+3600000),-1);
 assert.equal(dueHours(task({due:'bad-date'}),clock,now),Infinity);
 assert.equal(dueHours(task({due:null}),clock,now),Infinity);
});
test('scope, search and area intersect without modifying original records',()=>{
 const tasks=[task({key:'T-1'}),task({key:'T-2',owner:'TEAM'}),task({key:'T-3',owner:'EG'}),task({key:'T-4',board:'fa-docs',status:'completed'})];
 assert.equal(summarize(tasks,{owner:'ML',space:'en',q:'TRANSCRIPT',bucket:'open'},clock,now).selected.length,1);
 assert.equal(summarize(tasks,{owner:'TEAM'},clock,now).selected[0].key,'T-2');
 assert.equal(summarize(tasks,{owner:'EG'},clock,now).selected.length,1);
 assert.equal(summarize(tasks,{q:'no-match'},clock,now).selected.length,0);
 assert.equal(summarize(tasks,{bucket:'completed'},clock,now).selected[0].key,'T-4');
 assert.equal(tasks.length,4);assert.equal(tasks[0].status,'processing');
});
test('priority is explainable; earlier deadlines precede priority within a bucket',()=>{
 const tasks=[task({key:'urgent',priority:'Urgent'}),task({key:'due-soon',priority:'Low',due:new Date(now+3600000).toISOString()}),task({key:'review',status:'clean'}),task({key:'late',due:new Date(now-3600000).toISOString()})];
 assert.deepEqual(orderTasks(tasks,clock,now).map(t=>t.key),['late','review','due-soon','urgent']);
 assert.match(reasonFor(tasks[3],clock,now),/past due/);
 assert.match(reasonFor(tasks[1],clock,now),/Due within 1h/);
});
test('a stage or assignee update is reflected in every derived total',()=>{
 const tasks=[task({id:'1'}),task({id:'2',key:'T-2',status:'exceptions'})];
 assert.equal(summarize(tasks,{bucket:'open'},clock,now).open,2);
 tasks[0].status='completed';tasks[1].owner='TEAM';
 const updated=summarize(tasks,{bucket:'all'},clock,now);
 assert.equal(updated.open,1);assert.equal(updated.completed,1);
 assert.equal(summarize(tasks,{owner:'ML',bucket:'open'},clock,now).selected.length,0);
 assert.equal(summarize(tasks,{owner:'TEAM',bucket:'review'},clock,now).selected.length,1);
});
test('empty data yields valid zeros and zero-length groups',()=>{
 const result=summarize([],{bucket:'open'},clock,now);assert.equal(result.total,0);assert.equal(result.attention,0);assert.deepEqual(result.selected,[]);
});

test('existing board SLA labels distinguish open tasks without deadlines from completed work',async()=>{
 const {sla}=await import('../public/action-center-demo/src/store.js');
 assert.equal(sla(task({due:null})).short,'No deadline');
 assert.equal(sla(task({due:'invalid'})).remaining,Infinity);
 assert.equal(sla(task({status:'completed',due:null})).short,'Completed');
 assert.equal(sla(task({status:'completed',due:new Date(now-3600000).toISOString()})).tone,'green');
 assert.equal(reasonFor(task({due:new Date(now-3600000).toISOString()}),clock,now),'1h past due');
});
