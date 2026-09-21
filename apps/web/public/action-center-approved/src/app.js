/* The approved board's visual shell renders a canonical server projection.
 * There is no browser workflow engine, localStorage, seedTasks or simulated delivery. */
import {documentSpecimen,providerSpecimen,requestWorkspace} from './demo-detail.js';
import {BOARDS,SPACES,PEOPLE,WORKFLOWS} from './data.js';
import {store} from './store.js';
import {view,shell,switchBoard,renderHeader,renderTools,renderBoard,filteredTasks} from './board.js';
import {esc,icon,badge,avatar,priority,statusBadge,toast,date} from './ui.js';
const pending=new Map();
let current=null,detail=null,tab='overview',busy=false,detailVersion=0,executionDirty=false;
let demoScope=new URL(location.href).searchParams.get('demo')==='1';
let pinnedQuery=JSON.parse(new URL(location.href).searchParams.get('scope')||'{}');
const drafts=new Map();
const reviewCommands=new Map();
let reviewOptions=[];
function request(operation,payload={}){const id=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('The university service did not respond. Your draft is retained.'));},30000);pending.set(id,{resolve,reject,timer});parent.postMessage({type:'audentra:board:request',id,operation,payload},location.origin);});}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==parent)return;
 if(event.data?.type==='audentra:board:invalidate')void invalidate().catch(()=>{});
 if(event.data?.type==='audentra:board:notice')toast(event.data.message);
 if(event.data?.type==='audentra:board:response'){const p=pending.get(event.data.id);if(!p)return;clearTimeout(p.timer);pending.delete(event.data.id);if(event.data.error)p.reject(new Error(event.data.error));else p.resolve(event.data.result);}
 if(event.data?.type==='audentra:approved-board:select'&&BOARDS[event.data.board]){switchBoard(event.data.board);void load().catch(e=>toast(e.message));}
});
function publish(){parent.postMessage({type:'audentra:approved-board:state',taskContext:{surface:'task_board',project:view.board,...(document.querySelector('#task-dialog[open]')&&current?{workItemKey:current.key}:{})},dialogOpen:!!document.querySelector('dialog[open]'),navigation:{board:view.board,spaces:SPACES.map(s=>({id:s.id,name:s.name,color:s.color,boards:s.boards.map(id=>({id,name:BOARDS[id].name,count:store.projectCounts?.[id]||0}))}))}},location.origin);}
let loadVersion=0,searchTimer;
function filters(){return {
 ...pinnedQuery,
 search:view.q||pinnedQuery.search||(demoScope?'DEMO-':undefined),
 assignee:view.owner==='all'?pinnedQuery.assignee:view.owner==='TEAM'?'unassigned':view.owner,
 priority:view.priority==='all'?pinnedQuery.priority:view.priority.toLowerCase(),
 component:view.category==='all'?pinnedQuery.component:view.category,
 quick:view.quick,
 sort:view.sort==='rank'?'priority':view.sort,
};}
async function invalidate(){if(busy||document.hidden)return;await load(store.page?.offset||0,true);if(current&&!executionDirty){const id=current.id;const previousTab=tab;await openTask(id);tab=previousTab;renderDetail();}}
window.addEventListener('focus',()=>void invalidate().catch(()=>{}));
setInterval(()=>void invalidate().catch(()=>{}),30000);
function refresh(){clearTimeout(searchTimer);void load().catch(e=>toast(e.message));}
async function load(offset=0,background=false){
 const version=++loadVersion;
 const area=document.querySelector('#board-area');
 if(area&&!background){area.setAttribute('aria-busy','true');area.innerHTML='<p role="status">Loading matching work items…</p>';}
 let p;
 try{p=await request('read',{offset,project:view.board,filters:filters()});}
 catch(error){
   if(version!==loadVersion)return;
   const currentArea=document.querySelector('#board-area');
   if(currentArea){currentArea.setAttribute('aria-busy','false');currentArea.innerHTML=`<p role="alert">${esc(error.message)}</p><button class="btn" data-action="reset-demo">Retry loading work items</button>`;}
   throw error;
 }
 if(version!==loadVersion)return;
 const focused=document.activeElement?.id==='board-search';
 const caret=focused?document.activeElement.selectionStart:null;
 store.tasks=p.cards;store.projectCounts=p.projectCounts;store.projectSummaries=p.projectSummaries;
 store.page=p.page;store.clock=p.generatedAt||new Date().toISOString();store.actorId=p.actorId;
 for(const s of [...p.staff,...p.items.map(i=>i.assignee).filter(Boolean)])PEOPLE[s.id]={name:s.name,role:s.title||s.roleLabel,color:'purple'};
 shell();
 document.querySelector('#board-tools').insertAdjacentHTML('afterbegin',`<div class="demo-scope-tools"><button class="text-btn demo-scope-btn" data-demo-scope aria-pressed="${demoScope}">${demoScope?'Curated demo work · show all university work':'All university work · show curated demo'}</button><button class="text-btn" data-view="operational" aria-pressed="${view.mode==='operational'}">Work status board</button></div>`);
 const footer=document.querySelector('.board-footer');
 footer.insertAdjacentHTML('beforeend',`<span>${p.page.total} matching work items · page ${Math.floor(p.page.offset/p.page.limit)+1}</span><button class="btn" data-page="${Math.max(0,p.page.offset-p.page.limit)}" ${p.page.offset?'':'disabled'}>Previous</button><button class="btn" data-page="${p.page.offset+p.page.limit}" ${p.page.hasMore?'':'disabled'}>Next</button>`);
 document.querySelector('.footer-hint').textContent='Filters and sorting cover the full queue; grouping shows this page';
 if(focused){const input=document.querySelector('#board-search');input.focus();input.setSelectionRange(caret,caret);}
 publish();
}
function fields(values){return `<dl class="context-fields">${values.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v??'Not recorded')}</dd>`).join('')}</dl>`;}
function workflow(){return `<div class="workspace-heading"><div><h2>Workflow & institutional objective</h2><p>The board reflects canonical evidence; it cannot invent settlement or satisfy missing dependencies.</p></div></div><div class="workflow-map">${WORKFLOWS[current.type].map(s=>`<div class="workflow-node ${s.id===current.status?'active':''}"><strong>${esc(s.name)}</strong><p>${esc(s.description)}</p>${s.id===current.status?badge('Current stage','blue'):''}</div>`).join('')}</div>${current.case?fields([['Formal case',current.case.title],['Case state',current.case.status],['Accountable owner',current.case.owner_id],['Incomplete required steps',current.case.incomplete_steps]]):'<p>No formal case link is recorded.</p>'}<p>Operational work status: ${esc(current.operationalStatus)}. Required document and payment decisions use their own domain workflows.</p>`;}
function documents(){
 return `<div class="workspace-heading"><h2>Document review</h2><p>Review the evidence and keep a clear record of your decision.</p></div>${documentSpecimen(current)}${detail.relatedDocuments.map(d=>`
 <section class="content-section" data-document-id="${esc(d.id)}"><h3>${esc(d.fileName)}</h3>
 ${fields([['Category',d.category],['Processing',d.processingMode],['Status',d.status],['Uploaded',date(d.createdAt,true)]])}
 ${d.contentUrl?`<button class="btn" data-original="${esc(d.contentUrl)}">Open original document</button>`:'<p>Original file is unavailable in the current object-storage configuration.</p>'}
 ${d.extraction?`<h4>Extracted fields</h4><p class="muted">Machine extraction is evidence to review, not an official decision.</p><table class="task-list"><thead><tr><th>Field</th><th>Extracted value</th><th>Confidence</th></tr></thead><tbody>${(d.extraction.fields||[]).map(f=>`<tr><td>${esc(f.label||f.key)}</td><td>${esc(typeof f.value==='object'?JSON.stringify(f.value):f.value??'Not extracted')}</td><td>${typeof f.confidence==='number'?esc(Math.round(f.confidence*100)+'%'):'Not recorded'}</td></tr>`).join('')}</tbody></table>${(d.extraction.warnings||[]).map(w=>`<p class="amber">${esc(w)}</p>`).join('')}`:'<p>No extraction result is recorded for this file.</p>'}
 ${(d.reviewHistory||[]).length?`<h4>Official decision history</h4><ol class="document-decision-history">${d.reviewHistory.map(r=>`<li><strong>${r.decision==='accepted'?'Accepted':'Changes requested'}${r.reasonLabel?' · '+esc(r.reasonLabel):''}</strong><p>${r.synthetic?'Earlier status recorded':date(r.decidedAt,true)} · ${esc(r.reviewerName)}</p>${r.note?`<p>${esc(r.note)}</p>`:''}</li>`).join('')}</ol>`:''}
 ${current.document?.id===d.id&&['under_review','needs_review'].includes(d.status)?`
 <form id="review-form"><label class="form-field">Decision<select name="decision"><option value="accepted">Accept evidence</option><option value="rejected">Request correction / reject evidence</option></select></label>
 <label class="form-field">Correction reason<select name="reasonCode"><option value="">Choose when requesting changes</option>${reviewOptions.map(r=>`<option value="${esc(r.code)}" ${drafts.get('review-reason:'+d.id)===r.code?'selected':''}>${esc(r.label)}</option>`).join('')}</select></label>
 <label class="form-field">Student-visible guidance<textarea name="reason" required minlength="3" maxlength="500">${esc(drafts.get('review:'+d.id)||'')}</textarea></label>
 <label class="form-field">Internal staff note<textarea name="internalNote" maxlength="1000">${esc(drafts.get('internal:'+d.id)||'')}</textarea></label>
 <label><input type="checkbox" required> I reviewed this version and confirm this document decision.</label><button class="btn primary" ${busy?'disabled':''}>Record document decision</button></form>`:''}
 </section>`).join('')||'<p>No linked document is available.</p>'}<p class="muted">A correction starts a new submission; the original file and prior decision remain in history. Field verification commands remain in the full document workspace.</p>`;
}
function communications(){
 const saved=detail.outreachDraft;
 const draft=drafts.get('outreach:'+current.id)||(saved?.status==='draft'?saved:{subject:'',body:''});
 const changed=(draft.subject||'')!==(saved?.subject||'')||draft.body!==(saved?.body||'');
 const terminal=['done','cancelled'].includes(current.operationalStatus);
 return `<div class="workspace-heading"><h2>Communication workspace</h2><p>Personal outreach, with the recorded conversation in view.</p></div>
 <div class="outreach-goal"><span>${icon('flag',21)}</span><div><strong>${esc(current.title)}</strong><p>${esc(current.description)}</p></div></div>
 ${detail.interactions.map(i=>`<section class="content-section"><h3>${esc(i.objective)}</h3>${badge(i.status)}<div class="conversation">${i.communications.map(m=>`<div class="message-bubble ${m.direction==='inbound'?'incoming':'outgoing'}"><strong>${esc(m.subject||m.channel)}</strong><p>${esc(m.body||'No message body recorded')}</p>${badge(m.deliveryStatus)}<small>${esc(m.channel)} · ${esc(m.direction)} · ${date(m.occurredAt,true)}</small></div>`).join('')||'<p>No communication has been recorded.</p>'}</div></section>`).join('')||'<p>No interaction is linked to this work item yet.</p>'}
 ${terminal?'<p>This work item is closed. Its communication history remains available.</p>':`<form id="outreach-form" class="content-section"><h3>Message ${esc(current.student)}</h3><p>Student portal inbox · Save your draft to continue later. Saved drafts are visible to authorized staff.</p><p class="draft-state" role="status">${saved?.status==='draft'?`Saved draft · version ${saved.version} · ${esc(PEOPLE[saved.updatedByStaffId]?.name||'Authorized staff')} · ${date(saved.updatedAt,true)}${changed?' · Unsaved changes':''}`:'No unsent draft saved'}</p><label class="form-field">Subject<input name="outreachSubject" maxlength="300" value="${esc(draft.subject||'')}"></label><label class="form-field">Message<textarea name="outreachBody" rows="5" required maxlength="8000">${esc(draft.body)}</textarea></label><label class="outreach-confirmation"><input type="checkbox" name="confirmSend" required> I reviewed this message and confirm sending it to this student's portal inbox.</label><div class="composer-footer"><span class="muted">Sending does not complete the institutional case.</span><button type="button" class="btn" data-save-draft ${busy?'disabled':''}>Save draft</button><button type="button" class="btn" data-reload-draft ${busy?'disabled':''}>Reload saved draft</button><button class="btn primary" ${busy?'disabled':''}>${icon('send',14)}Send portal message</button></div></form>`}
 <p class="muted">External email and voice activity are recorded separately in the full workspace. Only confirmed portal delivery appears as delivered here.</p>`;
}
const draftCommands=new Map();
async function persistDraft(card,subject,body){
 if(!body.trim())throw new Error('Write a message before saving the draft.');
 const saved=detail.outreachDraft;
 if(saved?.status==='draft'&&(saved.subject||'')===subject&&saved.body===body)return saved;
 const input={expectedWorkItemVersion:card.version,expectedDraftVersion:saved?.version||0,subject:subject||null,body};
 const hash=JSON.stringify(input),prior=draftCommands.get(card.id),command=prior?.hash===hash?prior:{hash,key:crypto.randomUUID()};draftCommands.set(card.id,command);
 const result=await request('save-draft',{workItemId:card.id,input,idempotencyKey:command.key});
 card.version=result.workItemVersion;
 if(current?.id===card.id){detail.outreachDraft=result.draft;detail.workItem.version=result.workItemVersion;}
 return result.draft;
}
async function saveDraft(){if(busy)return;const form=document.querySelector('#outreach-form'),card=current;
 const subject=form.elements.outreachSubject.value.trim(),body=form.elements.outreachBody.value.trim();busy=true;renderDetail();
 try{await persistDraft(card,subject,body);drafts.delete('outreach:'+card.id);toast('Draft saved. No message has been sent.');}
 catch(error){toast(error.message);}finally{busy=false;if(current?.id===card.id)renderDetail();}
}
async function reloadDraft(){if(busy)return;const id=current.id;busy=true;
 try{await load(store.page?.offset||0);await openTask(id);drafts.delete('outreach:'+id);draftCommands.delete(id);outreachCommands.delete(id);tab='work';}
 catch(error){toast(error.message);}finally{busy=false;renderDetail();}
}
const outreachCommands=new Map();
async function sendOutreach(subject,body){
 if(busy)return;
 const card=current,workDetail=detail,hash=JSON.stringify({subject,body}),prior=outreachCommands.get(card.id);
 const command=prior?.hash===hash?prior:{hash,startKey:crypto.randomUUID(),sendKey:crypto.randomUUID()};
 outreachCommands.set(card.id,command);busy=true;renderDetail();
 try{
  if(!command.input){
   const saved=await persistDraft(card,subject,body);
   let interaction=workDetail.interactions.find(i=>!i.completedAt);
   if(!interaction){
    command.startInput??={expectedWorkItemVersion:card.version,channel:'portal',objective:card.title};
    const started=await request('start-interaction',{workItemId:card.id,input:command.startInput,idempotencyKey:command.startKey});
    interaction=started.interactions.find(i=>!i.completedAt);
   }
   if(!interaction)throw new Error('No open interaction is available. Your message remains unsent.');
   command.interactionId=interaction.id;command.input={expectedInteractionVersion:interaction.version,channel:'portal',direction:'outbound',subject:subject||null,body,draftId:saved.id,expectedDraftVersion:saved.version};
  }
  if(!command.sent){await request('communicate',{interactionId:command.interactionId,input:command.input,idempotencyKey:command.sendKey});command.sent=true;}
  drafts.delete('outreach:'+card.id);
  await load(store.page?.offset||0);
  if(current?.id===card.id){await openTask(card.id);tab='work';renderDetail();}
  toast('Portal message delivered. The recorded history is refreshed.');
 }catch(error){toast(command.sent?'Your message was delivered, but the updated history could not load. Refresh to see it.':error.message);}
 finally{busy=false;if(current?.id===card.id)renderDetail();}
}
function paymentWorkspace(){const p=current.payment;return `<div class="workspace-heading"><div><h2>Payment workspace</h2><p>Payment attempts and settled account credits are separate records.</p></div>${badge(p?.status||'No linked payment')}</div>${p?`<div class="payment-summary"><div><span>Attempt amount</span><strong>${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(p.amount_cents/100)}</strong></div><div><span>State</span><strong>${esc(p.status)}</strong></div><div><span>Term</span><strong>${esc(p.term_id)}</strong></div></div>${fields([['Reference',p.id],['Method',p.method],['Submitted',date(p.submitted_at,true)],['Settlement',p.settled_at?date(p.settled_at,true):'Not settled']])}<div class="review-banner blue">${icon('info',20)}<p>Board changes cannot post, reverse or refund this payment. A posted ledger entry is required to change the account.</p></div>`:'<p>No canonical payment is linked.</p>'}`;}
function activity(){return `<form id="comment-form" class="comment-form"><div class="comment-input-wrap"><textarea name="comment" required aria-label="Internal comment" placeholder="Add an internal comment…">${esc(drafts.get(current.id)||'')}</textarea><div class="comment-controls"><span>Private · staff only</span><button class="btn primary" ${busy?'disabled':''}>Post comment</button></div></div></form><div class="activity-stream">${detail.comments.map(c=>`<article class="activity-event is-comment"><strong>${esc(c.author.name)}</strong><p>${esc(c.body)}</p><time>${date(c.createdAt,true)}</time></article>`).join('')}${current.activity.map(e=>`<article class="activity-event"><strong>${esc(e.who)}</strong><p>${esc(e.text)}</p><time>${date(e.at,true)}</time></article>`).join('')}</div>`;}
function renderDetail(){if(!current||!detail)return;const dialog=document.querySelector('#task-dialog');const content=tab==='workflow'?workflow():tab==='activity'?activity():tab==='work'?(current.type==='document'?documents():current.type==='payment'?paymentWorkspace()+providerSpecimen(current):current.type==='request'?requestWorkspace(current):communications()):`<section class="content-section"><h3>Description</h3><p>${esc(current.description)}</p>${fields([['Student',current.student],['Program',current.program],['Institutional queue',current.category],['Operational status',current.operationalStatus],['Due',current.due?date(current.due,true):null],['Version',current.version]])}</section>${current.case?workflow():''}<section class="content-section"><h3>Related work</h3>${detail.relatedItems.map(r=>`<button class="related-task" data-related="${r.id}">${esc(r.key)} · ${esc(r.title)}</button>`).join('')||'<p>No related work recorded.</p>'}</section>`;
 dialog.innerHTML=`<div class="detail-topline"><div class="detail-breadcrumb">${icon('ticket')}<span>${esc(BOARDS[current.board].space)}</span>${icon('chevron',10)}<strong>${esc(current.key)}</strong></div><div class="detail-navigation"><button class="icon-btn" data-close aria-label="Close task">${icon('close')}</button></div></div><header class="detail-header"><h1 id="task-title" tabindex="-1">${esc(current.title)}</h1><div class="detail-header-bottom"><div class="detail-meta">${statusBadge(current)}<span class="canonical-status">${esc(current.operationalStatus.replaceAll('_',' '))}</span>${priority(current)}<span class="meta-student">${icon('profile',14)}${esc(current.student)}</span></div></div></header><div class="detail-layout"><div class="detail-left"><nav class="detail-tabs" role="tablist" aria-label="Task details">${[['overview','Overview'],['work',current.type==='document'?'Review workspace':current.type==='payment'?'Payment workspace':current.type==='request'?'Request workspace':'Communications'],['workflow','Workflow'],['activity','Activity']].map(([id,label])=>`<button class="detail-tab ${tab===id?'active':''}" data-tab="${id}" role="tab" aria-selected="${tab===id}">${label}</button>`).join('')}</nav><div class="detail-main" id="detail-content" role="tabpanel">${content}</div></div><aside class="context-panel"><div class="context-student"><div class="student-link">${avatar(current.student)}<div><strong>${esc(current.student)}</strong><span>${esc(current.program)}</span></div></div></div><section class="context-section"><h3>Staff execution</h3><form id="execution-form"><label class="form-field"><span>Operational status</span><select name="status">${['todo','in_progress','blocked','follow_up_required','done','cancelled'].map(status=>`<option value="${status}" ${status===current.operationalStatus?'selected':''} ${!['todo','in_progress',current.operationalStatus].includes(status)?'disabled':''}>${esc(status.replaceAll('_',' '))}</option>`).join('')}</select><small>Document and payment stages follow their evidence.</small></label><label class="form-field"><span>Owner</span><select name="assigneeId">${Object.entries(PEOPLE).map(([id,p])=>`<option value="${esc(id)}" ${current.owner===id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label class="form-field"><span>Priority</span><select name="priority">${['Urgent','High','Medium','Low'].map(p=>`<option value="${p.toLowerCase()}" ${p===current.priority?'selected':''}>${p}</option>`).join('')}</select></label><label class="form-field"><span>Due date (UTC)</span><input type="datetime-local" name="dueAt" value="${current.due?new Date(current.due).toISOString().slice(0,16):''}"></label><button class="btn primary" ${busy?'disabled':''}>Save changes</button></form></section><section class="context-section"><h3>Related workflow</h3><p>Document, payment and case stages follow their recorded evidence.</p><button class="btn" data-full-workspace>Open full workspace</button></section></aside></div><footer class="detail-footer"><span>${icon('lock',13)}Visible to authorized staff</span><span>Updated ${date(current.updated,true)}</span><span class="push"></span><span class="footer-key">Esc</span><span>to return to board</span></footer>`;
 if(!dialog.open)dialog.showModal();publish();}
async function openTask(id){
 const version=++detailVersion;
 let card=store.tasks.find(r=>r.id===id||r.key===id);
 if(!card){if(/^[a-f0-9-]{36}$/.test(id)){const record=await request('detail',{workItemId:id});id=record.workItem?.key||record.item?.key||id;}const result=await request('read',{filters:{search:id}});card=result.cards.find(r=>r.id===id||r.key===id);}
 if(!card){toast('This work item is no longer available. Refresh the board to check its current state.');return;}
 const record=await request('detail',{workItemId:card.id});
 const options=card.type==='document'?await request('review-options'):null;
 if(version!==detailVersion)return;
 current=card;detail=record;reviewOptions=options?.rejectionReasons||[];tab='work';executionDirty=false;renderDetail();
}
async function mutate(operation,payload){if(busy)return;busy=true;const id=current?.id;try{await request(operation,payload);await load(store.page?.offset||0);if(id&&current?.id===id)await openTask(id);toast('Canonical record saved.');}catch(e){toast(e.message);}finally{busy=false;}}
document.addEventListener('click',e=>{const target=e.target.closest('button,[data-task],[data-board]');if(!target)return;const d=target.dataset;
 if(d.demoScope!==undefined){demoScope=!demoScope;view.q='';refresh();}
 if(d.saveDraft!==undefined)void saveDraft();
 if(d.reloadDraft!==undefined)void reloadDraft();
 if(d.task)void openTask(d.task).catch(e=>toast(e.message));
 if(d.board){switchBoard(d.board);void load().catch(e=>toast(e.message));}
 if(d.page!==undefined)void load(+d.page).catch(e=>toast(e.message));
 if(d.close!==undefined){document.querySelector('#task-dialog').close();publish();}
 if(d.tab){tab=d.tab;renderDetail();}
 if(d.action==='density'){view.compact=!view.compact;renderTools();renderBoard();}
 if(d.action==='favorite'){view.starred=!view.starred;renderHeader();}
 if(d.view){view.mode=d.view;renderHeader();renderBoard();}
 if(d.quick){view.quick=view.quick===d.quick?'all':d.quick;if(view.quick==='mine')view.owner='all';renderTools();refresh();}
 if(d.owner){view.owner=d.owner;if(view.quick==='mine')view.quick='all';renderTools();refresh();}
 if(d.action==='reset-demo')void load(store.page?.offset||0).catch(e=>toast(e.message));
 if(d.action==='clear-filters'){pinnedQuery={};Object.assign(view,{q:'',owner:'all',priority:'all',category:'all',quick:'all'});renderTools();refresh();}
 if(d.action==='board-workflow'){const t=filteredTasks()[0];if(t)void openTask(t.id).then(()=>{tab='workflow';renderDetail();});}
 if(d.action==='create'||d.createStatus!==undefined||d.fullWorkspace!==undefined)parent.postMessage({type:'audentra:board:full-workspace',workItemId:current?.id,studentId:current?.studentId},location.origin);
 if(d.related)void openTask(d.related).catch(e=>toast(e.message));
 if(d.original)parent.postMessage({type:'audentra:board:original',path:d.original},location.origin);
});
document.addEventListener('input',e=>{if(e.target.form?.id==='execution-form')executionDirty=true;if(['outreachSubject','outreachBody'].includes(e.target.name)){const form=e.target.form;drafts.set('outreach:'+current.id,{subject:form.elements.outreachSubject.value,body:form.elements.outreachBody.value});const label=form.querySelector('.draft-state'),saved=detail.outreachDraft;const dirty=(saved?.subject||'')!==form.elements.outreachSubject.value||saved?.body!==form.elements.outreachBody.value;if(label)label.textContent=dirty?'Unsaved changes'+(saved?.status==='draft'?' · saved version '+saved.version:''):saved?.status==='draft'?'Saved draft · version '+saved.version:'No unsent draft saved';}if(e.target.id==='board-search'){view.q=e.target.value;++loadVersion;clearTimeout(searchTimer);searchTimer=setTimeout(refresh,250);}if(e.target.name==='comment')drafts.set(current.id,e.target.value);if(e.target.name==='reason')drafts.set('review:'+current.document.id,e.target.value);if(e.target.name==='internalNote')drafts.set('internal:'+current.document.id,e.target.value);});
document.addEventListener('change',e=>{if(e.target.name==='decision'&&e.target.form?.id==='review-form')e.target.form.elements.reasonCode.required=e.target.value==='rejected';if(e.target.name==='reasonCode')drafts.set('review-reason:'+current.document.id,e.target.value);const map={'filter-quick':'quick','filter-owner':'owner','filter-category':'category','filter-priority':'priority','filter-group':'group','filter-sort':'sort'};if(map[e.target.id]){view[map[e.target.id]]=e.target.value;if(e.target.id==='filter-owner'&&view.quick==='mine')view.quick='all';if(e.target.id==='filter-quick'&&view.quick==='mine')view.owner='all';if(e.target.id==='filter-group'){renderTools();renderBoard();}else{renderTools();refresh();}}});
document.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);if(e.target.id==='outreach-form'){void sendOutreach(String(f.get('outreachSubject')||'').trim(),String(f.get('outreachBody')||'').trim());return;}if(e.target.id==='execution-form')void mutate('update',{workItemId:current.id,input:{expectedVersion:current.version,status:f.get('status'),assigneeId:f.get('assigneeId')==='TEAM'?null:f.get('assigneeId'),priority:f.get('priority'),dueAt:f.get('dueAt')?new Date(f.get('dueAt')+'Z').toISOString():null}});if(e.target.id==='comment-form')void mutate('comment',{workItemId:current.id,input:{body:f.get('comment'),expectedWorkItemVersion:current.version}});if(e.target.id==='review-form'){
 const input={workItemId:current.id,expectedWorkItemVersion:current.version,decision:f.get('decision'),note:f.get('reason'),internalNote:f.get('internalNote')||undefined,notifyStudent:true,...(f.get('decision')==='rejected'?{reasonCode:f.get('reasonCode')}:{})};
 const hash=JSON.stringify(input),prior=reviewCommands.get(current.document.id);
 const command=prior?.hash===hash?prior:{hash,key:crypto.randomUUID()};reviewCommands.set(current.document.id,command);
 void mutate('review',{documentId:current.document.id,input,idempotencyKey:command.key});
}});
document.querySelector('#task-dialog').addEventListener('close',()=>{++detailVersion;current=null;detail=null;executionDirty=false;publish();});
document.querySelector('#app').innerHTML='<main class="main"><p role="status">Loading university work items…</p></main>';
publish();void (async()=>{if(Object.keys(pinnedQuery).length){const result=await request('read',{filters:pinnedQuery});if(result.cards[0])view.board=result.cards[0].board;}await load();const task=new URL(location.href).searchParams.get('task')||location.hash.slice(1);if(task)await openTask(task);})().catch(e=>{document.querySelector('#app').innerHTML=`<main class="main"><p role="alert">${esc(e.message)}</p></main>`;publish();});

document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-task]')){e.preventDefault();void openTask(e.target.dataset.task).catch(error=>toast(error.message));}});
