// One complete snapshot powers every For You view. No board pagination/filter leaks in.
import { BOARDS, stageFor } from './data.js';
export const BUCKETS = [
  {id:'overdue',label:'Overdue',color:'rose',icon:'clock',description:'Open tasks past their due time'},
  {id:'review',label:'Needs review',color:'purple',icon:'checklist',description:'Exceptions, escalations and approvals'},
  {id:'waiting',label:'Waiting',color:'amber',icon:'clock',description:'Waiting on a student, payer or submission'},
  {id:'progress',label:'In progress',color:'blue',icon:'records',description:'Other open work, ordered by due time'},
  {id:'completed',label:'Completed',color:'green',icon:'check',description:'Tasks in a completed workflow stage'},
];
export function dueHours(task, demoClock, currentTime = Date.now()) {
  if(task.status === 'completed' || !task.due) return Infinity;
  const due=Date.parse(task.due);
  return Number.isFinite(due) ? (due - (task.actualDocument ? currentTime : Date.parse(demoClock))) / 3600000 : Infinity;
}
export function bucketFor(task, demoClock, currentTime) {
  if(task.status === 'completed') return 'completed';
  if(dueHours(task,demoClock,currentTime)<0) return 'overdue';
  if(['exceptions','exception','escalated','clean','approval','responded'].includes(task.status)) return 'review';
  if(['requested','correction','balance','waiting'].includes(task.status)) return 'waiting';
  return 'progress';
}
export function orderTasks(tasks, demoClock, currentTime) {
  const ranks = {overdue:0,review:1,progress:2,waiting:3,completed:4};
  const priorities = {Urgent:0,High:1,Medium:2,Low:3};
  return [...tasks].sort((a,b)=>ranks[bucketFor(a,demoClock,currentTime)]-ranks[bucketFor(b,demoClock,currentTime)] ||
    dueHours(a,demoClock,currentTime)-dueHours(b,demoClock,currentTime) ||
    (priorities[a.priority]??4)-(priorities[b.priority]??4) || a.key.localeCompare(b.key));
}
export function summarize(tasks, filters, demoClock, currentTime = Date.now()) {
  const unique=[...new Map(tasks.map(task=>[task.workItemId || task.id || task.key,task])).values()];
  const query=(filters.q || '').trim().toLowerCase();
  const scoped=unique.filter(task=>(!filters.owner || filters.owner==='all' || task.owner===filters.owner) &&
    (!filters.space || filters.space==='all' || BOARDS[task.board]?.spaceId===filters.space) &&
    (!query || [task.title,task.key,task.student,task.program,BOARDS[task.board]?.name,stageFor(task)?.name].join(' ').toLowerCase().includes(query)));
  const groups=Object.fromEntries(BUCKETS.map(bucket=>[bucket.id,[]]));
  for(const task of orderTasks(scoped,demoClock,currentTime)) groups[bucketFor(task,demoClock,currentTime)].push(task);
  const selected=filters.bucket && filters.bucket!=='all' ? (filters.bucket==='open' ? orderTasks(scoped.filter(t=>t.status!=='completed'),demoClock,currentTime) : groups[filters.bucket] || []) : orderTasks(scoped,demoClock,currentTime);
  return {total:unique.length,scoped,groups,selected,open:scoped.length-groups.completed.length,completed:groups.completed.length,
    attention:groups.overdue.length+groups.review.length,
    boards:Object.entries(BOARDS).map(([id,board])=>({id,...board,tasks:scoped.filter(t=>t.board===id)}))};
}
export function reasonFor(task, demoClock, currentTime) {
  const bucket=bucketFor(task,demoClock,currentTime),hours=dueHours(task,demoClock,currentTime);
  if(bucket==='overdue') {
    const elapsed=-hours;
    return elapsed<1 ? 'Less than 1h past due' : elapsed<24 ? `${Math.floor(elapsed)}h past due` : `${Math.floor(elapsed/24)}d ${Math.floor(elapsed%24)}h past due`;
  }
  if(bucket==='completed') return 'Workflow complete';
  if(bucket==='review') return stageFor(task)?.name || 'Review required';
  if(Number.isFinite(hours)&&hours<=24) return `Due within ${Math.max(1,Math.ceil(hours))}h`;
  if(bucket==='waiting') return stageFor(task)?.name || 'Waiting on a response';
  return task.due ? 'Upcoming deadline' : 'No deadline set';
}
