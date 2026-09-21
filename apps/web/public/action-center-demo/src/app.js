import {command,drafts} from './connected.js';
import {boardRequest} from './identities.js';
import {downloadOriginal,originalPageCount} from './originals.js';
import {fieldSchema,reviewFor,reviewSummary} from './review-model.js';
import {requestState,runRequestAction,sendGuidance,simulateResolution} from './requests.js';
import {BOARDS,PEOPLE,TYPES,WORKFLOWS,transitionsFor,stageFor,columnFor} from './data.js';
import {initializeIdentities,refreshIdentities,store,save,reset,event,tick,move,sla,setReviewMode,setDocumentValue,processDocument,decideField,approveDocument} from './store.js';
import {view,shell,renderHeader,renderTools,renderBoard,filteredTasks,clearFilters,switchBoard} from './board.js';
import {detail,currentTask,openTask,closeTask,renderDetail,renderMain} from './detail.js';
import {esc,icon,avatar,badge,btn,ib,date,money,toast,field} from './ui.js';
import {exceptionInfo,documentSheet,filename} from './documents.js';
const actionDialog=document.querySelector('#action-dialog');
let actionSubmit=null,dragged=null;
actionDialog.addEventListener('close',()=>{if(!actionDialog.open){actionDialog.innerHTML='';actionSubmit=null;}});
function refresh(){document.querySelectorAll('[data-board]').forEach(el=>{const count=el.querySelector('.nav-count');if(count)count.textContent=store.tasks.filter(t=>t.board===el.dataset.board&&t.status!=='completed').length;});renderHeader();renderTools();renderBoard();if(currentTask()&&document.querySelector('#task-dialog').open)renderDetail();}
function actionModal(title,subtitle,body,{submitLabel='Save',onSubmit,cls='',tone='primary',footnote='Changes are saved in this browser'}={}){
 actionDialog.className='action-dialog '+cls;
 actionDialog.innerHTML=`<form id="action-form"><header><div><h2 id="action-title">${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div>${ib('close','Close dialog','close-action')}</header><div class="action-body">${body}<div id="action-error" class="action-error" role="alert"></div></div><footer><span class="muted">${esc(footnote)}</span>${btn(onSubmit?'Cancel':'Close','close-action')}${onSubmit?`<button class="btn ${tone}" type="submit">${esc(submitLabel)}</button>`:''}</footer></form>`;
 actionDialog.querySelectorAll('button[data-action]').forEach(b=>b.type='button');actionSubmit=onSubmit||null;
 if(!actionDialog.open)actionDialog.showModal();
}
async function reviewOriginal(t,decision) {
 try {
  const options = decision==='rejected' ? await boardRequest('demo-review-options') : null;
  const doc=t.actualDocument;
  if(!doc)throw Error('There is no stored document to review.');
  actionModal(decision==='accepted'?'Approve original document':'Request document changes',`${t.key} · ${t.student}`,
   `<p>${esc(doc.fileName)}</p>${options?field('Reason',`<select name="reason" required>${options.rejectionReasons.map(r=>`<option value="${esc(r.code)}">${esc(r.label)}</option>`).join('')}</select>`):''}${field('Message to the student',`<textarea name="note" aria-label="Review message" rows="4" minlength="3" maxlength="500" required></textarea>`)}<label><input type="checkbox" name="originalReviewed" required> I reviewed the original document. The simulated fields do not determine this decision.</label>`,
   {submitLabel:decision==='accepted'?'Approve document':'Request changes',footnote:'Saves the decision and notifies the student',onSubmit:async form=>{
    await command(t.id+':review','demo-review',{documentId:doc.id,input:{workItemId:t.id,
      expectedWorkItemVersion:t.backendVersion,decision,note:form.get('note').trim(),
      notifyStudent:true,originalReviewed:form.get('originalReviewed')==='on',
      ...(decision==='rejected'?{reasonCode:form.get('reason')}:{})}});
    await refreshIdentities().then(()=>refresh()).catch(()=>toast('Decision saved. The board will refresh when the connection returns.'));
    toast(decision==='accepted'?'Document approved. Student notified.':'Changes requested. Student notified.');
   }});
 }catch(error){toast(error.message);}
}
async function writeActivity(t,body,kind,formElement) {
 const button=formElement.querySelector('button[type="submit"]');
 if(button?.disabled)return;
 if(button)button.disabled=true;
 try {
  await command(t.id+':'+kind,'demo-write',{workItemId:t.id,input:{kind,body:body.trim(),expectedVersion:t.backendVersion,
    startNewConversation:kind==='message'&&Boolean(t.conversations?.[0]?.expired)}});
  if(kind==='message'){drafts.delete(t.id);delete t.draft;if(t.requestWork)t.requestWork.draft='';}else detail.commentDrafts[t.key]='';
  for(const input of formElement.querySelectorAll('textarea'))input.value='';
  await refreshIdentities().then(()=>refresh()).catch(()=>toast('Saved. The board will refresh when the connection returns.'));
  toast(kind==='message'?'Message delivered to student portal.':'Private comment saved.');
 } catch(error) {
  if(error.code==='VERSION_CONFLICT'||error.code==='SUPPORT_CONVERSATION_EXPIRED') {
   await refreshIdentities().catch(()=>{});refresh();
  }
  toast(error.message);
 }finally{if(button)button.disabled=false;}
}
function completeTransition(t,to,options={}){try{move(t,to,options);refresh();toast(`${t.key} moved to ${stageFor(t).name}`);}catch(error){toast(error.message);}}
function transition(t,to){
 if(t.actualDocument){if(to==='completed')void reviewOriginal(t,'accepted');else if(to==='correction')void reviewOriginal(t,'rejected');else if(['clean','exceptions'].includes(to)){processDocument(t);refresh();}else toast('Use the student portal to submit a replacement document.');return;}
 if(!transitionsFor(t).some(a=>a.to===to)){toast('This transition is not available from the current stage.');return;}
 if(t.type==='document'){
  if(to==='completed'){try{approveDocument(t);refresh();toast('Document approved. Requirement satisfied.');}catch(error){detail.tab='workspace';renderDetail();toast(error.message);}return;}
  if(to==='correction'){detail.tab='workspace';renderDetail();const first=reviewSummary(t).pending[0];if(first){detail.reviewAction={id:first.id,action:'correction'};renderDetail();focusCorrection();}else toast('Flag a document value in the table, then record a correction reason.');return;}
  if(['clean','exceptions'].includes(to)){try{processDocument(t);refresh();toast('Fields checked. Review queue updated.');}catch(error){detail.tab='workspace';renderDetail();toast(error.message);}return;}
  if(to==='resubmitted'){completeTransition(t,to);detail.page=1;renderDetail();return;}
 }
 if(t.type==='request'&&['completed','waiting','escalated'].includes(to)){
  const title=to==='completed'?'Resolve request':to==='waiting'?'Request more information':'Escalate request';
  actionModal(title,`${t.key} · ${t.student}`,`${field(to==='completed'?'Resolution for the student':to==='waiting'?'Information needed from the student':'Context for the specialist',`<textarea name="note" rows="5" required>${esc(to==='completed'?t.resolutionDraft||'':to==='waiting'?'Please share the supporting information so we can complete our review.':'Please review the policy exception and advise on the appropriate resolution.')}</textarea>`)}<p class="subtle-note">${to==='completed'?'The resolution is retained with this request. Student notification is simulated.':'The destination stage has its own SLA and activity history.'}</p>`,{submitLabel:title,tone:to==='completed'?'success':'primary',onSubmit:form=>{const note=form.get('note').trim();if(!note)throw Error('Please enter the context or resolution.');completeTransition(t,to,{note});}});return;
 }
 if(t.type==='payment'&&['completed','balance','processing'].includes(to)){
  const remaining=t.amount-t.paid,partial=to==='balance';
  actionModal(partial?'Record partial settlement':to==='completed'?'Confirm settlement':'Record payment attempt',`${t.key} · ${t.student}`,`<div class="payment-summary" style="margin:0 0 20px;grid-template-columns:1fr 1fr"><div><span>Remaining balance</span><strong>${money(remaining)}</strong></div><div><span>Direction</span><strong style="font-size:18px">${t.direction}</strong></div></div>${partial?field('Amount settled (USD)',`<input name="amount" type="number" min="0.01" max="${(remaining-.01).toFixed(2)}" step="0.01" value="${Math.min(remaining/2,t.amount/4).toFixed(2)}" required>`):''}<p>${to==='completed'?`Confirm the remaining ${money(remaining)} has settled. This completes the task and creates a transaction entry.`:partial?'The remaining balance stays open. This settlement will be added to the transaction history.':'The payment will enter processing. You can then record a partial payment, confirm full settlement, or flag a payment issue.'}</p>`,{submitLabel:partial?'Record settlement':to==='completed'?'Confirm settlement':'Start processing',onSubmit:form=>{const amount=Number(form.get('amount'));if(partial&&(!Number.isFinite(amount)||amount<=0||amount>=remaining))throw Error('Enter a positive amount below the remaining balance.');completeTransition(t,to,{amount});},footnote:'Simulation only · no money is moved'});return;
 }
 completeTransition(t,to);
}
function createTask(status){const b=BOARDS[view.board],initial=WORKFLOWS[b.type][0].id;actionModal('Create a task',`${b.space} / ${b.name}`,`${field('Task title',`<input name="title" required placeholder="What needs to be done?" maxlength="120">`)}${field('Student name',`<input name="student" required placeholder="e.g. Jordan Taylor" maxlength="80">`)}<div class="new-task-fields">${field('Assignee',`<select name="owner">${Object.entries(PEOPLE).map(([id,p])=>`<option value="${id}">${p.name}</option>`).join('')}</select>`)}${field('Priority',`<select name="priority"><option>Medium</option><option>High</option><option>Urgent</option><option>Low</option></select>`)}</div><p class="subtle-note">${TYPES[b.type].name} · New tasks begin in ${WORKFLOWS[b.type][0].name}. Workflow actions become available after creation.</p>`,{submitLabel:'Create task',onSubmit:form=>{
 const title=form.get('title').trim(),student=form.get('student').trim();if(!title||!student)throw Error('Enter a task title and student name.');tick();const key=b.prefix+'-'+(Math.max(...store.tasks.filter(t=>t.key.startsWith(b.prefix)).map(t=>Number(t.key.split('-')[1])))+1),stage=WORKFLOWS[b.type][0],owner=form.get('owner');
 const task={key,board:view.board,type:b.type,title,student,studentId:'2026-'+String(6000+store.tasks.length).padStart(5,'0'),program:'Undeclared',cohort:'Fall 2026',status:initial,owner,priority:form.get('priority'),team:b.team,delegation:owner==='EG'?'Automated agent':owner==='TEAM'?'Team queue':'Direct assignment',category:b.type==='document'?'Transcript':b.name,labels:['New task'],created:store.clock,updated:store.clock,entered:store.clock,due:new Date(Date.parse(store.clock)+stage.hours*3600000).toISOString(),version:1,exceptions:[],resolved:[],visited:[],activity:[],messages:[],amount:500,paid:0,direction:'Inbound',transactions:[]};store.tasks.push(task);event(task,`Demo task created by ${PEOPLE.ML.name}.`);save();clearFilters();refresh();openTask(key);toast(`${key} created`);
 }});}
function studentPreview(t){actionModal('Student record',`${t.studentId} · Aster University`,`<div class="preview-profile">${avatar(t.student,'large')}<div><h3>${esc(t.student)}</h3><p>${esc(t.program)} · ${t.cohort}</p></div>${badge('Admitted','green')}</div><dl class="context-fields"><dt>Student ID</dt><dd>${t.studentId}</dd><dt>Advisor</dt><dd>${esc(t.advisor || PEOPLE.ML.name)}</dd><dt>Email</dt><dd>${esc(t.studentEmail || 'Not provided')}</dd><dt>Enrollment</dt><dd>${t.status==='completed'?'Requirement complete':'In progress'}</dd></dl><section class="context-section"><h3>Connected work</h3>${store.tasks.filter(x=>x.studentId===t.studentId).map(x=>`<button class="related-task" data-related-task="${x.key}">${icon(TYPES[x.type].icon,16)}<span><strong>${x.key}</strong>${esc(x.title)}</span>${badge(stageFor(x).name,x.status==='completed'?'green':'blue')}</button>`).join('')}</section>`,{footnote:'Student 360 preview · sample data'});}
function demoGuide(){actionModal('A quick tour for your demo','Audentra Action Center · UI prototype',`<ol class="guide-list"><li><strong>Start with Enrollment → Document review.</strong> Filter by assignee, type, priority, or SLA.</li><li><strong>Open ENR-184, ${esc(store.tasks.find(t=>t.key==='ENR-184')?.student || 'your student')}.</strong> Compare every transcript field; accept the name variation inline and give a reason for correcting the graduation field.</li><li><strong>Open Activity.</strong> Switch among internal comments, student communications, and history; add a private staff comment.</li><li><strong>Open Workflow.</strong> See the exception branch and the correction loop. Inspect the owner, SLA, and automation evidence on each transition.</li><li><strong>Resubmit the document.</strong> Simulate a corrected upload, run the mock checks, then approve.</li><li><strong>Compare other issue types.</strong> Outreach has a conversation; Payments has settlement and balance; Student requests has a resolution workspace.</li></ol><p>Changes persist in this browser. Use <strong>Reset view</strong> to restore the original September 9 scenario.</p>`,{footnote:'Review actions, messages and financial transactions are simulated'});}
function shellPreview(name){actionModal(name,'Aster University · Staff workspace',`<p>This prototype focuses on the Action Center. ${esc(name)} is shown in the navigation to preserve the surrounding Audentra workspace.</p><p>Open a task and select its student or linked requirement to see the connected context preview.</p>`,{footnote:'Surrounding product navigation is a visual reference'});}
function action(name){const t=currentTask();if(name.startsWith('transition:')){if(t)transition(t,name.split(':')[1]);return;}if(name.startsWith('shell:')){shellPreview(name.slice(6));return;}
 switch(name){
 case 'process-document':try{processDocument(t);detail.reviewAction=null;refresh();toast('Processing complete. Checks determine the review queue.');}catch(error){toast(error.message);}break;
 case 'real-approve':void reviewOriginal(t,'accepted');break;
 case 'real-reject':void reviewOriginal(t,'rejected');break;
 case 'approve-document':if(t.actualDocument){void reviewOriginal(t,'accepted');break;}try{approveDocument(t);refresh();toast('Document approved. Requirement satisfied.');}catch(error){toast(error.message);}break;
 case 'cancel-row-decision':detail.reviewAction=null;renderDetail();break;
 case 'show-resolution-rule':detail.tab='workflow';renderMain();break;
 case 'show-override':t.showOverride=true;renderMain();document.querySelector('[name=evidence]').focus();break;

 case 'close-action':actionDialog.close();break;
 case 'close-task':closeTask();break;
 case 'toggle-nav':view.navOpen=!view.navOpen;shell();break;
 case 'sidebar':view.sidebar=!view.sidebar;shell();break;
 case 'favorite':view.starred=!view.starred;renderHeader();toast(view.starred?'Board added to favorites':'Board removed from favorites');break;
 case 'density':view.compact=!view.compact;renderTools();renderBoard();break;
 case 'clear-filters':clearFilters();renderTools();renderBoard();break;
 case 'board-workflow':{const tasks=filteredTasks();const target=tasks.find(x=>x.hero)||tasks[0]||store.tasks.find(x=>x.board===view.board);if(target){openTask(target.key);detail.tab='workflow';renderMain();}break;}
 case 'create':createTask();break;
 case 'demo-guide':demoGuide();break;
 case 'reset-demo':actionModal('Reset this view?','Reset simulated workflow changes; retain uploaded originals.',`<p>This clears browser-only prototype changes. Student uploads, staff reviews, and messages saved to the server are preserved.</p>`,{submitLabel:'Reset view',onSubmit:()=>{reset();view.mode='board';view.sort='rank';detail.key=null;document.querySelector('#task-dialog').close();switchBoard('en-docs');toast('Demo restored. Start with ENR-184.');}});break;
 case 'notifications':actionModal('Notifications','Your Action Center updates',`<div class="activity-stream">${store.tasks.filter(x=>x.hero||sla(x).remaining<0).slice(0,4).map(x=>`<button class="related-task" data-related-task="${x.key}">${icon(x.hero?'alert':'clock',17,x.hero?'amber':'red')}<span><strong>${x.key} · ${esc(x.student)}</strong>${x.hero?'Two document checks need your judgment.':sla(x).label}</span>${icon('chevron',14)}</button>`).join('')}</div>`,{footnote:'Demo notifications'});break;
 case 'previous-task':case 'next-task':{const i=detail.queue.indexOf(t.key)+(name==='next-task'?1:-1);if(detail.queue[i])openTask(detail.queue[i],detail.queue);break;}
 case 'copy-task':{const url=new URL(location.href);url.hash=t.key;navigator.clipboard?.writeText(url.href).then(()=>toast(`${t.key} link copied`)).catch(()=>toast('Task link: '+url.href));break;}
 case 'student-record':studentPreview(t);break;
 case 'requirement':actionModal('Linked enrollment requirement',`${t.student} · ${t.cohort}`,`<div class="review-banner ${t.status==='completed'?'green':'blue'}">${icon('checklist',22)}<div><strong>${t.type==='document'?esc(t.category):'Enrollment readiness'}</strong><p>${t.status==='completed'?'Requirement satisfied. The review outcome is reflected in the student’s checklist.':t.status==='correction'?'Correction requested. The student can replace the submitted document.':'In progress. The student can see the current requirement state in their portal.'}</p></div></div><dl class="context-fields"><dt>Student</dt><dd>${esc(t.student)}</dd><dt>Program</dt><dd>${esc(t.program)}</dd><dt>Required for</dt><dd>Enrollment clearance</dd><dt>Linked task</dt><dd>${t.key}</dd></dl>`,{footnote:'Read-only checklist preview'});break;
 case 'doc-next':detail.page=t.actualDocument?Math.min(detail.page+1,originalPageCount(t.actualDocument.id)):2;renderMain();break;
 case 'doc-prev':detail.page=Math.max(1,detail.page-1);renderMain();break;
 case 'doc-zoom':detail.zoom=!detail.zoom;renderMain();break;
 case 'expand-document':actionModal(filename(t),t.actualDocument?`Uploaded ${date(t.actualDocument.uploadedAt,true)}`:`Version ${t.version} · Page ${detail.page} of 2`,documentSheet(t,detail.page),{cls:'document-expanded',footnote:t.actualDocument?'Original uploaded document':'Mock document preview'});break;
 case 'download-document':{if(t.actualDocument){void downloadOriginal(t.actualDocument).catch(()=>toast('The original could not be downloaded. Please retry.'));break;}const blob=new Blob([`<!doctype html><meta charset="utf-8"><title>${esc(filename(t))}</title><style>body{font-family:Georgia;max-width:650px;margin:40px auto;line-height:1.8}table{width:100%;text-align:left}td{border-bottom:1px solid #ddd}dd{margin-bottom:10px}svg{display:none}.paper-footer{margin-top:30px;color:#888}</style>${documentSheet(t,detail.page)}`],{type:'text/html'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=filename(t).replace('.pdf','.html');link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);toast('Sample document downloaded as printable HTML.');break;}
 case 'escalate':actionModal('Escalate to the registrar',`${t.key} · ${t.student}`,`${field('Reason for escalation',`<textarea name="note" rows="4" required placeholder="What judgment or policy guidance is needed?">Please review the document exceptions and advise on an acceptable resolution.</textarea>`)}<p>The task stays in its review queue. Sarah Park becomes the assigned specialist; the stage SLA continues.</p>`,{submitLabel:'Escalate',onSubmit:form=>{tick();const old=t.owner;t.owner='SP';t.delegation='Specific team member';t.escalated=true;event(t,`Escalated to Sarah Park: ${form.get('note').trim()}`);event(t,`Assignee changed: ${PEOPLE[old].name} → Sarah Park.`);refresh();toast('Escalated to Sarah Park. Review SLA continues.');}});break;
 }
}
document.addEventListener('click',e=>{
 const version=e.target.closest('[data-original-version]');if(version){const file=currentTask().documents.find(d=>d.id===version.dataset.originalVersion);void downloadOriginal(file).catch(error=>toast(error.message));return;}
 const button=e.target.closest('[data-action]');if(button){e.preventDefault();action(button.dataset.action);return;}
 const task=e.target.closest('[data-task]');if(task){openTask(task.dataset.task,filteredTasks().map(t=>t.key));return;}
 const related=e.target.closest('[data-related-task]');if(related){actionDialog.close();const t=store.tasks.find(t=>t.key===related.dataset.relatedTask);if(t.board!==view.board)switchBoard(t.board);openTask(t.key);return;}
 const board=e.target.closest('[data-board]');if(board){switchBoard(board.dataset.board);return;}
 const space=e.target.closest('[data-space]');if(space){view.expanded[space.dataset.space]=!view.expanded[space.dataset.space];shell();return;}
 const quick=e.target.closest('[data-quick]');if(quick){view.quick=view.quick===quick.dataset.quick&&quick.dataset.quick!=='all'?'all':quick.dataset.quick;renderTools();renderBoard();return;}
 const owner=e.target.closest('[data-owner]');if(owner){view.owner=view.owner===owner.dataset.owner?'all':owner.dataset.owner;renderTools();renderBoard();return;}
 const mode=e.target.closest('[data-view]');if(mode){view.mode=mode.dataset.view;renderHeader();renderBoard();return;}
 const tab=e.target.closest('[data-detail-tab]');if(tab){detail.tab=tab.dataset.detailTab;renderMain();return;}
 const activity=e.target.closest('[data-activity]');if(activity){detail.activity=activity.dataset.activity;renderMain();return;}
 const edge=e.target.closest('[data-transition]');if(edge){transition(currentTask(),edge.dataset.transition);return;}
 const source=e.target.closest('[data-evidence]');if(source){focusReviewField(source.dataset.evidence,false);return;}
 const evidence=e.target.closest('[data-evidence-link]');if(evidence){focusReviewField(evidence.dataset.evidenceLink,true);return;}
 const accept=e.target.closest('[data-review-accept]');if(accept){try{decideField(currentTask(),accept.dataset.reviewAccept,'accept');detail.reviewAction=null;refresh();toast(currentTask().status==='correction'?'Correction sent to student.':'Field accepted.');}catch(error){toast(error.message);}return;}
 const correction=e.target.closest('[data-review-correction]');if(correction){detail.reviewAction={id:correction.dataset.reviewCorrection,action:'correction'};renderDetail();focusCorrection();return;}
 const note=e.target.closest('[data-review-note]');if(note){detail.reviewAction={id:note.dataset.reviewNote,action:'accept'};renderDetail();focusCorrection();return;}
 const undo=e.target.closest('[data-review-undo]');if(undo){const t=currentTask();delete reviewFor(t).decisions[undo.dataset.reviewUndo];t.resolved=t.resolved.filter(id=>id!==undo.dataset.reviewUndo);tick();event(t,`Field decision reopened: ${undo.dataset.reviewUndo}.`);refresh();return;}
 const edit=e.target.closest('[data-review-edit]');if(edit){detail.reviewEdit=edit.dataset.reviewEdit;renderDetail();document.querySelector(`[data-document-value="${detail.reviewEdit}"]`).focus();return;}
 const requestAction=e.target.closest('[data-request-action]');if(requestAction){try{runRequestAction(currentTask(),requestAction.dataset.requestAction);refresh();toast('Action completed with sample evidence.');}catch(error){toast(error.message);}return;}
 const simulation=e.target.closest('[data-simulate]');if(simulation){try{simulateResolution(currentTask(),simulation.dataset.simulate);refresh();toast('Resolution trigger simulated; history updated.');}catch(error){toast(error.message);}return;}
 if(e.target.closest('[data-create-status]'))createTask();
});
document.addEventListener('input',e=>{if(e.target.name==='portalMessage')drafts.set(currentTask().id,e.target.value);if(e.target.id==='board-search'){view.q=e.target.value;renderBoard();document.querySelector('.clear-filters').classList.toggle('invisible',!view.q&&view.quick==='all'&&view.owner==='all'&&view.priority==='all'&&view.category==='all');}if(e.target.name==='comment')detail.commentDrafts[detail.key]=e.target.value;if(e.target.id==='request-guidance'){requestState(currentTask()).draft=e.target.value;save();}});
document.addEventListener('change',e=>{
 const map={'filter-quick':'quick','filter-owner':'owner','filter-category':'category','filter-priority':'priority','filter-group':'group','filter-sort':'sort'};
 if(map[e.target.id]){view[map[e.target.id]]=e.target.value;renderTools();renderBoard();return;}
 const t=currentTask();if(!t)return;
 if(e.target.id==='review-mode'){try{setReviewMode(t,e.target.value);renderDetail();}catch(error){toast(error.message);}return;}
 if(e.target.matches('[data-document-value]')){try{setDocumentValue(t,e.target.dataset.documentValue,e.target.value);setTimeout(()=>{if(currentTask()?.key!==t.key)return;const active=document.activeElement?.dataset.documentValue;renderDetail();if(active)document.querySelector(`[data-document-value="${active}"]`)?.focus();},0);}catch(error){toast(error.message);}return;}
 if(e.target.id==='request-operator'){requestState(t).operator=e.target.value;tick();event(t,`Request action operator changed to ${e.target.value==='agent'?'EDgent':'staff'}.`);renderMain();return;}
 if(e.target.id==='request-resolution-rule'){requestState(t).rule=e.target.value;save();renderMain();return;}

 if(e.target.id==='task-owner'){tick();const old=t.owner;t.owner=e.target.value;t.delegation=t.owner==='EG'?'Automated agent':t.owner==='TEAM'?'Team queue':'Direct assignment';event(t,`Assignee changed: ${PEOPLE[old].name} → ${PEOPLE[t.owner].name}.`);refresh();toast('Assignee updated.');}
 if(e.target.id==='task-priority'){tick();const old=t.priority;t.priority=e.target.value;event(t,`Priority changed: ${old} → ${t.priority}.`);refresh();toast('Priority updated.');}
 if(e.target.id==='task-delegation'){tick();const old=t.delegation,oldOwner=t.owner;t.delegation=e.target.value;if(t.delegation==='Automated agent')t.owner='EG';else if(t.delegation==='Team queue')t.owner='TEAM';else if(['EG','TEAM'].includes(t.owner))t.owner='ML';event(t,`Assignment mode changed: ${old} → ${t.delegation}.`);if(oldOwner!==t.owner)event(t,`Assignee changed: ${PEOPLE[oldOwner].name} → ${PEOPLE[t.owner].name}.`);refresh();toast('Assignment mode updated.');}
 if(e.target.matches('[data-request-check]')){const i=Number(e.target.dataset.requestCheck);t.requestChecks=e.target.checked?[...new Set([...(t.requestChecks||[]),i])]:(t.requestChecks||[]).filter(x=>x!==i);save();}
});
document.addEventListener('submit',async e=>{
 e.preventDefault();const form=new FormData(e.target),t=currentTask();
 if(e.target.id==='action-form'){if(!actionSubmit)return;const button=e.target.querySelector('button[type="submit"]');if(button.disabled)return;button.disabled=true;try{await actionSubmit(form);actionDialog.close();actionSubmit=null;}catch(error){const errorBox=document.querySelector('#action-error');if(errorBox)errorBox.textContent=error.message;else toast(error.message);if(error.code==='VERSION_CONFLICT'){await refreshIdentities().catch(()=>{});const latest=store.tasks.find(x=>x.id===t.id);if(latest)t.backendVersion=latest.backendVersion;}}finally{button.disabled=false;}return;}
 if(e.target.id==='connected-message-form'){await writeActivity(t,form.get('portalMessage'),'message',e.target);return;}
 if(e.target.id==='comment-form'&&t.workItemId){await writeActivity(t,form.get('comment'),'note',e.target);return;}
 if(e.target.id==='request-guidance-form'&&t.workItemId){await writeActivity(t,form.get('guidance'),'message',e.target);return;}
 if(e.target.matches('.field-decision-form')){try{decideField(t,e.target.dataset.field,e.target.dataset.decision,form.get('reason'));detail.reviewAction=null;refresh();toast(t.status==='correction'?'Correction sent. Student SLA started.':'Field decision recorded.');}catch(error){toast(error.message);}return;}
 if(e.target.id==='request-guidance-form'){try{sendGuidance(t,form.get('guidance'));refresh();toast('Guidance sent locally. Resolution rule armed.');}catch(error){toast(error.message);}return;}
 if(e.target.id==='override-form'){try{simulateResolution(t,'override',form.get('evidence'));t.showOverride=false;refresh();toast('Override recorded with evidence.');}catch(error){toast(error.message);}return;}
 if(e.target.id==='comment-form'){const text=form.get('comment').trim();if(!text)return;tick();event(t,text,'comment','ML',{visibility:BOARDS[t.board].team});detail.commentDrafts[t.key]='';renderDetail();toast('Comment added.');}
 if(e.target.id==='outreach-form'){const message=form.get('message').trim();if(!message)return;tick();t.draft=message;t.subject=form.get('subject').trim();if(t.status==='responded'){t.messages.push({who:'ML',at:store.clock,channel:'Portal message · simulated',text:message});event(t,message,'communication','ML',{channel:'Portal reply · simulated'});t.draft='';toast('Mock reply sent.');}else{event(t,'Outreach draft updated. Content awaiting approval.');toast('Outreach draft saved.');}renderDetail();}
 if(e.target.id==='resolution-form'){t.resolutionDraft=form.get('resolution').trim();tick();event(t,'Resolution draft updated.');renderDetail();toast('Resolution draft saved.');}
});
document.addEventListener('keydown',e=>{
 if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();document.querySelector('#board-search').focus();}
 if(['Enter',' '].includes(e.key)&&e.target.matches('[data-task],[data-transition],[data-evidence]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
 const tab=e.target.closest('[role=tab]');if(tab&&['ArrowRight','ArrowLeft'].includes(e.key)){const siblings=[...tab.parentElement.querySelectorAll('[role=tab]')],index=siblings.indexOf(tab),next=siblings[(index+(e.key==='ArrowRight'?1:-1)+siblings.length)%siblings.length];e.preventDefault();next.click();document.querySelector(`[${next.hasAttribute('data-detail-tab')?'data-detail-tab':next.hasAttribute('data-view')?'data-view':'data-activity'}="${next.dataset.detailTab||next.dataset.view||next.dataset.activity}"]`)?.focus();}
});
document.addEventListener('dragstart',e=>{const card=e.target.closest('[data-task]');if(!card)return;dragged=store.tasks.find(t=>t.key===card.dataset.task);e.dataTransfer.setData('text/plain',dragged.key);e.dataTransfer.effectAllowed='move';card.classList.add('dragging');const allowed=transitionsFor(dragged).map(t=>columnFor(t.to));document.querySelectorAll('.column').forEach(el=>el.classList.toggle('drop-allowed',allowed.includes(el.dataset.column)));});
document.addEventListener('dragover',e=>{const col=e.target.closest('[data-column]');if(!col||!dragged)return;const allowed=transitionsFor(dragged).some(t=>columnFor(t.to)===col.dataset.column);if(allowed){e.preventDefault();e.dataTransfer.dropEffect='move';col.classList.add('drag-over');}});
document.addEventListener('dragleave',e=>{const col=e.target.closest('[data-column]');if(col&&!col.contains(e.relatedTarget))col.classList.remove('drag-over');});
document.addEventListener('drop',e=>{const col=e.target.closest('[data-column]');if(!col||!dragged)return;e.preventDefault();const target=transitionsFor(dragged).find(t=>columnFor(t.to)===col.dataset.column);if(target){openTask(dragged.key,filteredTasks().map(t=>t.key));transition(dragged,target.to);}dragged=null;document.querySelectorAll('.drag-over,.drop-allowed,.dragging').forEach(el=>el.classList.remove('drag-over','drop-allowed','dragging'));});
document.addEventListener('dragend',()=>{dragged=null;document.querySelectorAll('.drag-over,.drop-allowed,.dragging').forEach(el=>el.classList.remove('drag-over','drop-allowed','dragging'));});
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){if(dialog.id==='task-dialog')closeTask();else dialog.close();}}});
document.querySelector('#task-dialog').addEventListener('cancel',e=>{e.preventDefault();closeTask();});
function focusCorrection(){const input=document.querySelector('.field-decision-form input');if(input){input.focus({preventScroll:true});const pane=document.querySelector('#review-table-scroll'),row=input.closest('tr');pane.scrollTop+=Math.max(0,row.getBoundingClientRect().bottom-pane.getBoundingClientRect().bottom+8);}}
function focusReviewField(id,showSource){
 const t=currentTask(),f=fieldSchema(t).find(f=>f.id===id);if(!f)return;
 detail.focusField=id;if(showSource)detail.page=f.page;renderDetail();
 const row=document.querySelector(`[data-field-row="${id}"]`),pane=document.querySelector('#review-table-scroll');
 if(row&&pane){const delta=row.getBoundingClientRect().top-pane.getBoundingClientRect().top-36;if(delta<0||row.getBoundingClientRect().bottom>pane.getBoundingClientRect().bottom)pane.scrollTop+=delta;row.querySelector('button')?.focus({preventScroll:true});}
 if(showSource){const mark=document.querySelector(`.document-sheet [data-evidence="${id}"]`),pdf=document.querySelector('#pdf-scroll');if(mark&&pdf)pdf.scrollTop+=mark.getBoundingClientRect().top-pdf.getBoundingClientRect().top-pdf.clientHeight/3;}
}
function openDeepLink(){let key;try{key=decodeURIComponent(location.hash.slice(1));}catch{return;}const task=store.tasks.find(t=>t.key===key);if(task){actionDialog.close();switchBoard(task.board);openTask(key);}}
window.addEventListener('hashchange',openDeepLink);
try{await initializeIdentities();shell();openDeepLink();}
catch{
 document.querySelector('#app').innerHTML='<main class="main" style="padding:32px"><h1>Task board unavailable</h1><p role="alert">We could not load your students and work items. Your simulated changes are retained.</p><button class="btn primary" id="retry-board">Retry</button></main>';
 document.querySelector('#retry-board').addEventListener('click',()=>location.reload());
}


// Refetch canonical data; retain open tabs and local review drafts.
let refreshing=false;
async function refreshLiveBoard(){
 if(refreshing||document.hidden||document.querySelector('#action-dialog').open||
    document.activeElement?.matches('input,textarea,select,[contenteditable]'))return;
 refreshing=true;
 try{if(await refreshIdentities())refresh();}
 catch{toast('Task board could not refresh. Retrying shortly.');}
 finally{refreshing=false;}
}
window.addEventListener('focus',refreshLiveBoard);
window.addEventListener('message',event=>{
 if(event.origin===location.origin&&event.source===parent&&event.data?.type==='audentra:board:invalidate')void refreshLiveBoard();
});
setInterval(refreshLiveBoard,10000);
