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

// Presentation-only projections over the loaded task snapshot. No workflow writes.
export function responsibleParty(task) {
 if(task.status==='completed')return 'completed';
 const owner=stageFor(task)?.owner;
 if(task.type==='document'&&['processing','resubmitted'].includes(task.status)&&(task.processingMode==='manual'||task.review?.mode==='manual'))return task.owner==='ML'?'me':'team';
 if(['Student','Payer'].includes(owner))return 'student';
 if(['EDgent','System'].includes(owner))return 'automation';
 if(['Leader','Approver'].includes(owner))return 'team';
 if(['Staff','Advisor','Finance'].includes(owner))return task.owner==='ML'?'me':'team';
 return 'team';
}
export function actionGroup(task) {
 const party=responsibleParty(task),stage=stageFor(task);
 let label,minutes;
 if(party==='completed'){label='Completed '+({document:'document reviews',request:'student requests',outreach:'outreach',payment:'payments'}[task.type]);minutes=0;}
 else if(party==='student'){label=task.type==='document'?(task.status==='correction'?'Await corrected documents':'Await document uploads'):task.type==='payment'?'Await student payments':'Await student replies';minutes=0;}
 else if(party==='automation'){label=task.type==='document'?'Process documents':task.type==='payment'?'Await payment processing':'Automated work';minutes=0;}
 else if(task.type==='document'){label=(['processing','resubmitted'].includes(task.status)?'Process documents':'Review documents');minutes=task.status==='exceptions'?5:3;}
 else if(task.type==='request'){label=party==='team'?'Await '+(stage?.owner==='Leader'?'escalation review':stage?.owner||'team confirmation'):'Respond to students';minutes=5;}
 else if(task.type==='payment'){label='Resolve payment exceptions';minutes=6;}
 else {label=task.status==='approval'?'Approve outreach':task.status==='responded'?'Respond to students':'Prepare outreach';minutes=3;}
 return {id:[party,label].join(':'),label,minutes,party};
}
export function workload(tasks,filters,clock,now=Date.now()) {
 const snapshot=summarize(tasks,{...filters,bucket:'all'},clock,now);
 const counts={me:0,student:0,team:0,automation:0,completed:0};
 for(const task of snapshot.scoped)counts[responsibleParty(task)]++;
 const queue=snapshot.scoped.filter(t=>filters.party==='all'?t.status!=='completed':responsibleParty(t)===(filters.party||'me'));
 const deadlineFor=task=>{const hours=dueHours(task,clock,now);return !Number.isFinite(hours)?'none':hours<0?'overdue':hours<8?'risk':'track';};
 const deadlines={overdue:0,risk:0,track:0,none:0};
 for(const task of queue)if(task.status!=='completed')deadlines[deadlineFor(task)]++;
 const selected=queue.filter(t=>filters.party==='completed'||!filters.sla||filters.sla==='all'||deadlineFor(t)===filters.sla);
 const weights={Urgent:4,High:3,Medium:2,Low:1};
 const compare=(a,b)=> (filters.sort==='quickest'?actionGroup(a).minutes-actionGroup(b).minutes:filters.sort==='important'?(weights[b.priority]||0)-(weights[a.priority]||0):0)||dueHours(a,clock,now)-dueHours(b,clock,now)||(weights[b.priority]||0)-(weights[a.priority]||0)||a.key.localeCompare(b.key);
 const groups=new Map();
 for(const task of selected.sort(compare)){
  const action=actionGroup(task);
  if(!groups.has(action.id))groups.set(action.id,{...action,tasks:[],totalMinutes:0,sla:{overdue:0,risk:0,track:0,none:0},targetHours:0});
  const group=groups.get(action.id);
  group.tasks.push(task);group.totalMinutes+=action.minutes;group.targetHours+=stageFor(task)?.hours||0;
  group.sla[deadlineFor(task)]++;
 }
 const rows=[...groups.values()].sort((a,b)=> (filters.sort==='quickest'?a.totalMinutes-b.totalMinutes:0)||compare(a.tasks[0],b.tasks[0]));
 return {...snapshot,counts,queue,deadlines,selected,rows};
}
