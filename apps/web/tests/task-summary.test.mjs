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

import { workload, responsibleParty } from '../public/action-center-demo/src/summary-model.js';

test('next responsibility is independent of overdue status and assignment scope',()=>{
 const overdue=task({status:'requested',due:new Date(now-3600000).toISOString()});
 assert.equal(responsibleParty(overdue),'student');
 assert.equal(responsibleParty(task({status:'exceptions'})),'me');
 assert.equal(responsibleParty(task({status:'processing'})),'automation');
 assert.equal(responsibleParty(task({status:'processing',processingMode:'manual'})),'me');
 assert.equal(responsibleParty(task({type:'request',status:'escalated'})),'team');
 assert.equal(responsibleParty(task({type:'request',status:'waiting',requestWork:{sentAt:clock,rule:'api'},resolutionTeam:'Registrar'})),'team');
 const result=workload([overdue,task({key:'review',status:'clean'})],{owner:'ML',party:'me'},clock,now);
 assert.equal(result.counts.student,1);assert.equal(result.selected.length,1);assert.equal(result.selected[0].key,'review');
});
test('aggregated groups reconcile every scoped task once, including empty deadlines',()=>{
 const tasks=seedTasks();const before=structuredClone(tasks);
 for(const party of ['me','student','team','automation','completed','all']){
  const r=workload(tasks,{owner:'all',party},clock,now);
  assert.equal(Object.values(r.counts).reduce((a,b)=>a+b,0),tasks.length);
  assert.equal(r.rows.reduce((n,g)=>n+g.tasks.length,0),r.selected.length);
  assert.equal(new Set(r.rows.flatMap(g=>g.tasks.map(t=>t.key))).size,r.selected.length);
  for(const g of r.rows)assert.equal(Object.values(g.sla).reduce((a,b)=>a+b,0),g.tasks.length);
 }
 assert.deepEqual(tasks,before);
 const r=workload([task({status:'clean'})],{party:'me'},clock,now);
 assert.equal(r.rows[0].sla.none,1);assert.equal(r.rows[0].sla.track,0);
});
test('quickest orders group effort while importance and due sort the task queue',()=>{
 const tasks=[task({key:'T-1',status:'exceptions',category:'Transcript',priority:'Urgent',due:new Date(now+4*3600000).toISOString()}),task({key:'T-2',status:'clean',category:'Transcript',priority:'Low',due:new Date(now+2*3600000).toISOString()}),task({key:'T-3',status:'clean',category:'Identity',priority:'High',due:new Date(now+9*3600000).toISOString()}),task({key:'T-4',type:'outreach',board:'en-outreach',status:'identified',priority:'Low',due:new Date(now+10*3600000).toISOString()})];
 const due=workload(tasks,{party:'me',sort:'due'},clock,now);
 assert.equal(due.rows[0].tasks[0].key,'T-2');
 const important=workload(tasks,{party:'me',sort:'important'},clock,now);
 assert.equal(important.rows[0].tasks[0].key,'T-1');
 const quickest=workload(tasks,{party:'me',sort:'quickest'},clock,now);
 assert.equal(quickest.rows[0].tasks[0].key,'T-4');
 assert.equal(quickest.rows[1].totalMinutes,11);
 assert.equal(quickest.rows[1].sla.risk,2);
});

// A staff action can span document categories and underlying task types.
test('review and response queues combine related work while preserving each task workspace',()=>{
 const tasks=[task({key:'document',status:'clean',category:'Transcript'}),task({key:'passport',status:'exceptions',category:'Identity / passport'}),task({key:'request',type:'request',board:'en-requests',status:'reviewing'}),task({key:'reply',type:'outreach',board:'en-outreach',status:'responded'}),task({key:'processing',status:'processing'})];
 const r=workload(tasks,{party:'me'},clock,now);
 assert.equal(r.rows.length,2);
 const documents=r.rows.find(g=>g.label==='Review documents');
 const responses=r.rows.find(g=>g.label==='Respond to students');
 assert.deepEqual(new Set(documents.tasks.map(t=>t.key)),new Set(['document','passport']));
 assert.deepEqual(new Set(responses.tasks.map(t=>t.type)),new Set(['request','outreach']));
 assert.equal(documents.totalMinutes,8);assert.equal(responses.totalMinutes,8);
 assert.equal(r.counts.automation,1);assert.equal(r.selected.length,4);
});

test('deadline chart totals stay stable while filters narrow the queue and preserve responsibility',()=>{
 const due=hours=>new Date(now+hours*3600000).toISOString();
 const tasks=[task({key:'late',status:'clean',due:due(-1)}),task({key:'soon',status:'clean',due:due(0)}),task({key:'later',status:'clean',due:due(8)}),task({key:'no-date',status:'clean'}),task({key:'invalid-date',status:'clean',due:'invalid'}),task({key:'waiting',status:'requested',due:due(-2)}),task({key:'done',status:'completed',due:due(-3)})];
 const expected={overdue:1,risk:1,track:1,none:2};
 for(const [sla,count] of Object.entries(expected)){
  const r=workload(tasks,{owner:'ML',party:'me',sla},clock,now);
  assert.deepEqual(r.deadlines,expected);
  assert.equal(r.selected.length,count);
  assert.equal(r.queue.length,5);
  assert.equal(r.counts.student,1);
  assert.equal(r.rows.reduce((n,g)=>n+g.tasks.length,0),count);
  assert.ok(r.selected.every(t=>t.key!=='waiting'&&t.key!=='done'));
 }
 const all=workload(tasks,{party:'all',sla:'overdue'},clock,now);
 assert.deepEqual(new Set(all.selected.map(t=>t.key)),new Set(['late','waiting']));
 const complete=workload(tasks,{party:'completed',sla:'overdue'},clock,now);
 assert.deepEqual(complete.deadlines,{overdue:0,risk:0,track:0,none:0});
 assert.equal(complete.selected[0].key,'done');
 const empty=workload(tasks,{party:'me',q:'absent',sla:'risk'},clock,now);
 assert.equal(empty.queue.length,0);assert.equal(empty.selected.length,0);
 assert.deepEqual(empty.deadlines,{overdue:0,risk:0,track:0,none:0});
});
