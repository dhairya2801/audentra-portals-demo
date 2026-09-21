import {reviewFor,reviewSummary,fieldSchema,checkField,assertApprovable} from './review-model.js';
import {DEMO_NOW,stageFor,transitionsFor,PEOPLE} from './data.js';
import {loadIdentities,identityTasks,identityStorageKey} from './identities.js';
export function freshState(){return {revision:3,tasks:identityTasks(),clock:DEMO_NOW};}
export const store={revision:3,tasks:[],clock:DEMO_NOW};
export async function initializeIdentities(){
 await loadIdentities();
 let preview=null;
 try{preview=JSON.parse(localStorage.getItem(identityStorageKey()));}catch{}
 Object.assign(store,{revision:3,tasks:identityTasks(preview?.tasks || []),clock:preview?.clock || DEMO_NOW});
}
export async function refreshIdentities(){
 await loadIdentities();
 const tasks=identityTasks(store.tasks);
 if(JSON.stringify(tasks)===JSON.stringify(store.tasks))return false;
 store.tasks=tasks;save();return true;
}
export function save(){const key=identityStorageKey();if(key)try{localStorage.setItem(key,JSON.stringify(store));}catch{}}
export function now(){return new Date(store.clock);}
export function event(task,text,kind='history',who='ML',extra={}){task.updated=store.clock;task.activity.push({text,kind,who,at:store.clock,...extra});save();}
export function tick(){store.clock=new Date(Date.parse(store.clock)+60000).toISOString();}
export function reset(){Object.assign(store,freshState());save();}
export function sla(task){
 if(!task.due||task.actualDocument&&task.status==='completed')return {label:'SLA met',short:'Completed',tone:'green',remaining:0,percent:100};
 const clock=task.actualDocument?Date.now():Date.parse(store.clock);
 const remaining=(Date.parse(task.due)-clock)/3600000;
 const stage=stageFor(task),elapsed=(clock-Date.parse(task.entered))/3600000;
 const duration=Math.abs(remaining);const time=duration>=48?`${Math.floor(duration/24)}d ${Math.floor(duration%24)}h`:duration>=1?`${Math.floor(duration)}h ${Math.floor(duration%1*60)}m`:`${Math.max(1,Math.floor(duration*60))}m`;
 return {label:remaining<0?`Breached by ${time}`:`${time} remaining`,short:remaining<0?`${time} overdue`:remaining<8?`Due in ${time}`:`Due ${new Date(task.due).toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric'})}`,tone:remaining<0?'red':remaining<8?'amber':'muted',remaining,percent:Math.min(100,Math.max(3,elapsed/stage.hours*100))};
}
export function move(task,to,{note='',judgment=false,amount}={}){
 if(!transitionsFor(task).some(x=>x.to===to))throw new Error('This transition is not available from the current status.');
 if(task.type==='document'&&to==='completed')assertApprovable(task);
 if(task.type==='document'&&['clean','exceptions'].includes(to)){const r=reviewFor(task);if(!r.processed)throw Error('Complete field processing in the review workspace first.');const summary=reviewSummary(task);if(summary.empty.length)throw Error('Complete every document field first.');if(to==='clean'&&summary.flagged.length)throw Error('Flagged values must enter the exception review state.');}
 if(task.type==='document'&&to==='correction'&&reviewSummary(task).pending.length)throw Error('Decide every flagged field before requesting correction.');
 if(task.type==='document'&&to==='correction'&&!reviewSummary(task).corrections.length)throw Error('Record a field correction decision first.');
 if(task.type==='document'&&to==='correction'&&!note.trim())throw new Error('A correction request needs a message for the student.');
 if(task.type==='payment'&&to==='balance'&&(!Number.isFinite(Number(amount))||Number(amount)<=0||Number(amount)>=task.amount-task.paid))throw new Error('Partial settlement must be positive and below the remaining balance.');
 const priorReview=task.type==='document'&&to==='resubmitted'?structuredClone(reviewFor(task)):null;
 const from=stageFor(task).name,oldOwner=task.owner;tick();
 if(task.type==='request'&&task.status==='waiting'&&to==='reviewing'){if(task.requestWork){task.requestWork.repliedAt=store.clock;task.requestWork.sentAt=null;}event(task,'Thanks for the guidance. I have a follow-up question about the next step.','communication','student',{channel:'Inbound portal reply · simulated'});event(task,'Student reply cancelled the pending resolution timer.','history','EG');}
 task.visited=[...new Set([...task.visited,task.status])];task.status=to;task.entered=store.clock;task.escalated=false;
 const stage=stageFor(task);task.due=stage.hours?new Date(Date.parse(store.clock)+stage.hours*3600000).toISOString():null;
 event(task,`Status changed: ${from} → ${stage.name}.`);
 if(task.type==='document'){
  if(to==='correction'){task.correctionNote=note;event(task,`Correction requested: ${note}`,'communication','ML',{channel:'Portal correction request'});}
  if(to==='resubmitted'){task.reviewArchive=[...(task.reviewArchive||[]),priorReview];task.version++;task.resolved=[];task.exceptions=[];task.sourceExceptions=[];delete task.review;task.uploaded=store.clock;task.owner=task.processingMode==='manual'?'ML':'EG';task.delegation=task.processingMode==='manual'?'Direct assignment':'Automated agent';task.labels=['Resubmitted · v'+task.version];event(task,`Student resubmitted corrected document v${task.version}. Original versions retained; processing restarted.`,'history','student');}
  if(to==='processing'){task.uploaded=store.clock;task.owner=task.processingMode==='manual'?'ML':'EG';task.delegation=task.processingMode==='manual'?'Direct assignment':'Automated agent';event(task,'Document uploaded. Field processing started.','history','student');}
  if(to==='clean'||to==='exceptions'){
   task.owner='ML';task.delegation='Direct assignment';task.exceptions=to==='clean'?[]:reviewSummary(task).flagged.map(f=>f.id);task.labels=to==='clean'?['Checks passed']:['Exceptions detected'];
   event(task,`${reviewFor(task).mode==='agent'?'EDgent extracted':'Staff entered'} ${fieldSchema(task).length} fields from version ${task.version}. ${to==='clean'?'All required checks passed.':'Flagged comparisons routed to staff review.'}`,'history',reviewFor(task).mode==='agent'?'EG':'ML');
  }
  if(to==='completed'){task.decision=note||'All checks verified. Document approved.';task.judgment=judgment;task.labels=['Requirement satisfied'];event(task,`Document approved${judgment?' with recorded staff judgment':''}. ${task.decision} Linked enrollment requirement marked complete.`);}
 }
 if(task.type==='outreach'){
  if(to==='waiting'){task.messages.push({who:'ML',at:store.clock,channel:'Portal message · simulated',text:task.draft||`Hi ${task.student.split(' ')[0]}, following up on your next enrollment step. Please let me know how I can help.`});event(task,task.messages.at(-1).text,'communication','ML',{channel:'Portal message · simulated'});}
  if(to==='responded'){task.messages.push({who:'student',at:store.clock,channel:'Portal reply · simulated',text:'Thanks for reaching out! I’m available after 2 PM on Thursday. Could you share the next steps?'});event(task,task.messages.at(-1).text,'communication','student',{channel:'Portal reply · simulated'});}
 }
 if(task.type==='request'){if(to==='completed'){task.resolution=note;event(task,`Request resolved: ${note}`);}if(to==='waiting')event(task,`${task.requestWork?.sentAt?'Student guidance':'Information requested'}: ${note}`,'communication','ML',{channel:'Email · simulated'});if(to==='reviewing'&&['Awaiting Response','Awaiting Resolution'].includes(from))event(task,'Student supplied the requested information (simulated).','history','student');}
 if(task.type==='payment'){
  if(to==='balance'||to==='completed'){
   const settled=to==='completed'?task.amount-task.paid:Number(amount);
   if(settled>0){task.paid+=settled;task.transactions.push({id:'TXN-'+task.key.split('-')[1]+'-'+(task.transactions.length+1),date:new Date(store.clock).toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'}),method:'ACH •••• 4821',amount:settled,status:'Settled'});event(task,`Recorded ${task.direction.toLowerCase()} settlement of $${settled.toFixed(2)}. Remaining balance: $${(task.amount-task.paid).toFixed(2)}.`);}
  }
 }
 if(task.owner!==oldOwner)event(task,`Assignee changed: ${PEOPLE[oldOwner].name} → ${PEOPLE[task.owner].name}.`,'history','EG');
 event(task,task.due?`Stage SLA updated to ${stage.hours} hours. Due ${new Date(task.due).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} EDT.`:'SLA stopped. Work completed.','history','EG');save();return task;
}

export function setReviewMode(task,mode) {
 if(!['manual','agent'].includes(mode))throw Error('Unknown processing mode.');
 const r=reviewFor(task);r.mode=mode;task.processingMode=mode;
 // Switching operators retains already harvested values and decisions.
 if(['processing','resubmitted'].includes(task.status)){const old=task.owner;task.owner=mode==='agent'?'EG':old==='EG'?'ML':old;task.delegation=mode==='agent'?'Automated agent':'Specific team member';if(old!==task.owner)event(task,`Assignee changed: ${PEOPLE[old].name} → ${PEOPLE[task.owner].name}.`);}
 tick();event(task,`Processing operator changed to ${mode==='manual'?'staff':'EDgent'}. Existing field values retained.`);save();
}
export function setDocumentValue(task,id,value) {
 if(!['processing','resubmitted','clean','exceptions'].includes(task.status))throw Error('This document version is read-only.');
 if(!fieldSchema(task).some(f=>f.id===id))throw Error('Unknown document field.');
 const r=reviewFor(task),before=r.values[id];if(before===value)return;
 r.values[id]=value.trim();delete r.decisions[id];task.resolved=task.resolved.filter(x=>x!==id);
 if(task.status==='clean'&&checkField(fieldSchema(task).find(f=>f.id===id),r.values[id])==='flag'){task.status='exceptions';task.exceptions=[...new Set([...task.exceptions,id])];task.due=new Date(Date.parse(task.entered)+48*3600000).toISOString();event(task,'A changed document value requires review. Status: Reviewing · Checks Passed → Reviewing · Exceptions. Stage SLA target updated to 48h.');}
 tick();event(task,`Document field changed — ${fieldSchema(task).find(f=>f.id===id).label}: “${before||'empty'}” → “${value.trim()||'empty'}”.`);save();
}
export function processDocument(task) {
 if(!['processing','resubmitted'].includes(task.status))throw Error('Processing is available after a document upload.');
 const r=reviewFor(task);
 if(r.mode==='agent')r.values=Object.fromEntries(fieldSchema(task).map(f=>[f.id,f.source]));
 if(reviewSummary(task).empty.length)throw Error(`Enter ${reviewSummary(task).empty.length} remaining field values, then submit to review.`);
 r.processed=true;r.lastProcessor=r.mode;save();return move(task,reviewSummary(task).flagged.length?'exceptions':'clean');
}
export function decideField(task,id,action,note='') {
 if(!['clean','exceptions'].includes(task.status))throw Error('Field decisions are available during review.');
 const r=reviewFor(task),f=fieldSchema(task).find(f=>f.id===id);
 if(!f||checkField(f,r.values[id])!=='flag')throw Error('Only flagged values need a decision.');
 if(!['accept','correction'].includes(action))throw Error('Choose a field decision.');
 if(action==='correction'&&!note.trim())throw Error('A correction reason is required.');
 r.decisions[id]={action,note:note.trim(),who:'ML',at:store.clock};
 task.resolved=Object.entries(r.decisions).filter(([,d])=>d.action==='accept').map(([key])=>key);
 tick();event(task,`${f.label}: ${action==='accept'?'accepted':'correction required'}. Document “${r.values[id]}”; system “${f.system}”.${note.trim()?' '+note.trim():''}`);
 const summary=reviewSummary(task);
 if(!task.workItemId&&!summary.pending.length&&summary.corrections.length){
  const reason=summary.corrections.map(f=>`${f.label}: ${r.decisions[f.id].note}`).join('\n');
  move(task,'correction',{note:reason});
 }else save();
 return task;
}
export function approveDocument(task) {
 assertApprovable(task);
 return move(task,'completed',{judgment:reviewSummary(task).accepted.length>0,note:'All configured fields reviewed. Flagged values have recorded staff decisions.'});
}
