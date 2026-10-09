import { BOARDS, SPACES, PEOPLE, stageFor } from './data.js';
import { store, refreshIdentities } from './store.js';
import { openTask } from './detail.js';
import { switchBoard, view } from './board.js';
import { esc, icon, avatar, typeIcon, priority, statusBadge, date, toast } from './ui.js';
import { BUCKETS, summarize, bucketFor, reasonFor } from './summary-model.js';

const settings={version:'board',owner:'all',space:'all',q:'',bucket:'open',group:'attention',page:0,pages:{},selected:null};
try { const saved=JSON.parse(sessionStorage.getItem('audentra.camila.summary')||'null'); if(['board','focus','portfolio'].includes(saved?.version))settings.version=saved.version; } catch {}
let active=false, root=null, loading=false, error='', refreshedAt=null, model=null, picker=null, browseContext=null;
export const summaryActive=()=>active;
const button=(text,attrs='',cls='')=>`<button type="button" class="${cls}" ${attrs}>${text}</button>`;
const choose=(value,label,current)=>`<option value="${esc(value)}" ${value===current?'selected':''}>${esc(label)}</option>`;
const bucketMeta=id=>BUCKETS.find(b=>b.id===id);
const labelFor=id=>id==='all'?'All tasks':id==='open'?'Open tasks':bucketMeta(id)?.label;
const taskButton=(task,cls='sum-task-card')=>button(`<div class="sum-task-eyebrow">${typeIcon(task.type)}<span>${esc(task.key)}</span>${priority(task)}</div><strong>${esc(task.title)}</strong><span class="sum-task-student">${esc(task.student)} <span>· ${esc(BOARDS[task.board]?.space)}</span></span><div class="sum-task-foot"><span class="sum-reason ${bucketMeta(bucketFor(task,store.clock))?.color}">${esc(reasonFor(task,store.clock))}</span>${avatar(task.owner,'tiny')}</div>`,`data-summary-task="${esc(task.key)}"`,cls);
function persist(){try{sessionStorage.setItem('audentra.camila.summary',JSON.stringify({version:settings.version}));}catch{}}
function announce(){window.dispatchEvent(new Event('audentra:summary-navigation'));}
export function hideSummary(){active=false;document.body.classList.remove('show-task-summary');root?.setAttribute('hidden','');picker?.close();announce();}
export function showSummary(){
 active=true;
 const main=document.querySelector('.main');
 if(!main)return;
 if(!root?.isConnected){root=document.createElement('section');root.id='task-summary';root.setAttribute('aria-label','For You task summary');main.append(root);bind();}
 document.body.classList.add('show-task-summary');root.hidden=false;render();announce();
 root.querySelector('h1')?.focus({preventScroll:true});
}
function resetPages(){settings.page=0;settings.pages={};settings.selected=null;}
function clearFilters(){Object.assign(settings,{owner:'all',space:'all',q:'',bucket:'open'});resetPages();}
function header(){return `<header class="sum-header"><div><div class="sum-breadcrumb">Workspace <span>/</span> Task Board <span>/</span> For You</div><h1 tabindex="-1">For You <span class="sum-demo">Camila’s demo</span></h1><p>Your whole task landscape. A clear place to start.</p></div><div class="sum-design-switch" role="group" aria-label="Summary design">${[['board','columns','A','Board'],['focus','rows','B','Focus'],['portfolio','chart','C','Portfolio']].map(([id,ico,letter,name])=>button(`${icon(ico,16)}<span><small>${letter}</small> ${name}</span>`,`data-version="${id}" aria-pressed="${settings.version===id}"`,settings.version===id?'active':'')).join('')}</div></header>`;}
function toolbar(){return `<div class="sum-toolbar"><label class="sum-search">${icon('magnify',16)}<input id="sum-search" type="search" placeholder="Find a task or student…" aria-label="Search all tasks" aria-keyshortcuts="/" value="${esc(settings.q)}"></label><label class="sum-filter"><span>Scope</span><select id="sum-owner" aria-label="Task scope">${[['all','All visible tasks'],['ML','Assigned to me'],['TEAM','Team queue'],['EG','EDgent']].map(([id,n])=>choose(id,n,settings.owner)).join('')}</select></label><label class="sum-filter"><span>Area</span><select id="sum-space" aria-label="Task area">${choose('all','All areas',settings.space)}${SPACES.map(s=>choose(s.id,s.name,settings.space)).join('')}</select></label><span class="sum-toolbar-spacer"></span><span class="sum-source-count" data-total="${model.total}">${model.scoped.length} of ${model.total} tasks</span>${button(icon('refresh',15)+(loading?'Refreshing…':'Refresh'),'data-summary-action="refresh" '+(loading?'disabled':''),'sum-refresh')}</div>`;}
function metrics(){const values=[['open','Open tasks',model.open,'records','purple'],['overdue','Overdue',model.groups.overdue.length,'clock','rose'],['review','Needs review',model.groups.review.length,'checklist','amber'],['completed','Completed',model.completed,'check','green']];return `<div class="sum-metrics">${values.map(([id,label,count,ico,color])=>button(`<span class="sum-metric-icon ${color}">${icon(ico,19)}</span><span><small>${label}</small><strong>${count}</strong></span>${icon('chevron',13)}`,`data-bucket="${id}" aria-pressed="${settings.bucket===id}" data-count="${count}"`,'sum-metric '+(settings.bucket===id?'selected':''))).join('')}</div>`;}
function filterLine(){return `<div class="sum-results-line"><div class="sum-status-tabs" role="group" aria-label="Task status">${['open','all','completed'].map(id=>button(labelFor(id),`data-bucket="${id}" aria-pressed="${settings.bucket===id}"`,settings.bucket===id?'active':'')).join('')}${!['open','all','completed'].includes(settings.bucket)?button(`${labelFor(settings.bucket)} ${icon('close',12)}`,'data-bucket="open"','sum-active-filter'):''}</div><span class="sum-match-count" role="status">${model.selected.length} matching task${model.selected.length===1?'':'s'}</span>${settings.owner!=='all'||settings.space!=='all'||settings.q?button('Clear filters','data-summary-action="clear"','sum-text-button'):''}${settings.version==='board'?`<label class="sum-group">Group by <select id="sum-group" aria-label="Group board by">${choose('attention','Attention',settings.group)}${choose('area','Area',settings.group)}</select></label>`:''}</div>`;}
function empty(){return `<div class="sum-empty">${icon('checklist',32)}<h2>No tasks in this view</h2><p>Try another scope, area or search to explore your workload.</p>${button('Reset filters','data-summary-action="clear"','sum-primary')}</div>`;}
function pager(id,total,page,size){const pages=Math.ceil(total/size);return pages>1?`<div class="sum-pager"><span>${page*size+1}–${Math.min((page+1)*size,total)} of ${total}</span><div>${button(icon('chevron',13),`data-page="${esc(id)}" data-direction="-1" aria-label="Previous ${esc(id)} tasks" ${page===0?'disabled':''}`,'sum-prev')}${button(icon('chevron',13),`data-page="${esc(id)}" data-direction="1" aria-label="Next ${esc(id)} tasks" ${page>=pages-1?'disabled':''}`)}</div></div>`:`<div class="sum-pager"><span>${total} task${total===1?'':'s'}</span></div>`;}
function boardView(){
 const lanes=settings.group==='area'?SPACES.filter(space=>settings.space==='all'||space.id===settings.space).map(space=>({...space,label:space.name,description:'Boards and their tasks',tasks:model.selected.filter(t=>BOARDS[t.board]?.spaceId===space.id)})):
 BUCKETS.filter(b=>settings.bucket==='all'||settings.bucket==='open'&&b.id!=='completed'||settings.bucket===b.id).map(b=>({...b,tasks:model.selected.filter(t=>bucketFor(t,store.clock)===b.id)}));
 return `<div class="sum-board" style="--sum-lanes:${lanes.length}">${lanes.map(lane=>{const size=window.innerHeight<950?2:3,p=Math.min(settings.pages[lane.id]||0,Math.max(0,Math.ceil(lane.tasks.length/size)-1));return `<section class="sum-lane ${lane.color}"><header><h2><i></i>${lane.label}<span>${lane.tasks.length}</span></h2><p>${lane.description}</p></header><div class="sum-lane-cards">${lane.tasks.slice(p*size,(p+1)*size).map(task=>settings.group==='area'?`<div class="sum-hierarchy"><span>${icon('records',12)} ${esc(BOARDS[task.board].name)}</span>${taskButton(task)}</div>`:taskButton(task)).join('')||'<div class="sum-lane-empty">All clear here</div>'}</div>${pager(lane.id,lane.tasks.length,p,size)}</section>`;}).join('')}</div><p class="sum-explainer">${icon('info',13)} ${settings.group==='area'?'Area → board → task. These are the existing board relationships.':'Each task appears once: overdue first, then review, waiting and other work. Completed tasks are separate.'} Open any card to work on it.</p>`;
}
function focusView(){
 const size=window.innerHeight<950?4:6,page=Math.min(settings.page,Math.max(0,Math.ceil(model.selected.length/size)-1));
 const tasks=model.selected.slice(page*size,(page+1)*size);
 const selected=model.selected.find(t=>t.key===settings.selected)||tasks[0];
 if(!selected)return empty();
 settings.selected=selected.key;
 const board=BOARDS[selected.board],bucket=bucketMeta(bucketFor(selected,store.clock));
 const attention=model.selected.filter(t=>['overdue','review'].includes(bucketFor(t,store.clock))).length;
 const doneOnly=model.selected.every(t=>t.status==='completed');
 return `<section class="sum-focus-intro"><div><span class="sum-eyebrow">A LITTLE CLARITY FOR YOUR DAY</span><h2>${doneOnly?`${model.selected.length} completed task${model.selected.length===1?'':'s'}. A record of your progress.`:attention?`${attention} task${attention===1?' deserves':'s deserve'} a closer look.`:`${model.selected.length} task${model.selected.length===1?'':'s'}, one organized view.`}</h2><p>${doneOnly?'Revisit a task to review its recorded outcome and activity.':'Start with overdue work, then reviews. Select any task to see its context.'}</p></div><span class="sum-focus-mark">${icon('checklist',36)}</span></section><div class="sum-focus"><section class="sum-focus-queue"><header><h2>${doneOnly?'Completed work':'Your next moves'}</h2><span>Deadline, then priority</span></header><div class="sum-focus-rows">${tasks.map((task,index)=>button(`<span class="sum-rank">${page*size+index+1}</span><span class="sum-focus-row-copy"><strong>${esc(task.title)}</strong><small>${esc(task.key)} · ${esc(task.student)} · ${esc(boardName(task))}</small></span><span class="sum-focus-row-reason ${bucketMeta(bucketFor(task,store.clock)).color}">${esc(reasonFor(task,store.clock))}</span>${icon('chevron',14)}`,`data-preview-task="${esc(task.key)}" aria-pressed="${selected.key===task.key}"`,'sum-focus-row '+(selected.key===task.key?'selected':''))).join('')}</div>${pager('queue',model.selected.length,page,size)}</section><aside class="sum-preview" aria-label="Selected task preview"><div class="sum-preview-top">${typeIcon(selected.type)}<span>${esc(selected.key)}</span>${priority(selected)}</div><h2>${esc(selected.title)}</h2><p class="sum-preview-student">${esc(selected.student)} <span>· ${esc(selected.program)}</span></p><div class="sum-preview-reason ${bucket.color}">${icon(bucket.icon,18)}<div><strong>${esc(reasonFor(selected,store.clock))}</strong><p>${esc(stageFor(selected)?.description || 'Open this task to review its context.')}</p></div></div><dl><div><dt>Area / board</dt><dd>${esc(board.space)} / ${esc(board.name)}</dd></div><div><dt>Assigned to</dt><dd>${avatar(selected.owner,'tiny')}${esc(PEOPLE[selected.owner]?.name || selected.owner)}</dd></div><div><dt>Workflow stage</dt><dd>${statusBadge(selected)}</dd></div><div><dt>Due</dt><dd>${selected.due?date(selected.due,true)+' ET':'No deadline set'}</dd></div></dl>${selected.nextStep?`<div class="sum-next-step"><small>RECORDED NEXT STEP</small><p>${esc(selected.nextStep)}</p></div>`:''}${button(`Open task ${icon('arrow',16)}`,`data-summary-task="${esc(selected.key)}"`,'sum-primary')}<small class="sum-preview-note">Continue in the existing task workspace.</small></aside></div>`;
}
const boardName=task=>BOARDS[task.board]?.name || '';
function stack(tasks,board){const groups=BUCKETS.map(b=>({...b,count:tasks.filter(t=>bucketFor(t,store.clock)===b.id).length}));return `<div class="sum-stack" aria-label="Task distribution">${groups.filter(b=>b.count).map(b=>button('',`style="flex:${b.count}" data-browse="${esc(board)}" data-browse-bucket="${b.id}" aria-label="${esc(BOARDS[board] ? BOARDS[board].space+' / '+BOARDS[board].name : board)}: ${b.count} ${b.label.toLowerCase()} tasks" title="${b.count} ${b.label}"`,b.color)).join('') || '<span class="sum-stack-empty"></span>'}</div>`;}
function portfolioView(){
 const completed=model.completed,total=model.scoped.length,pct=total?Math.round(completed/total*100):0;
 return `<div class="sum-portfolio"><section class="sum-portfolio-main"><header class="sum-panel-head"><div><span class="sum-eyebrow">ACROSS YOUR WORKSPACE</span><h2>Workload by board</h2></div><span>${model.boards.filter(b=>b.tasks.length).length} boards · ${model.selected.length} tasks</span></header><div class="sum-legend">${BUCKETS.map(b=>button(`<i class="${b.color}"></i>${b.label}`,`data-bucket="${b.id}" aria-pressed="${settings.bucket===b.id}"`)).join('')}</div><div class="sum-portfolio-table"><div class="sum-portfolio-table-head"><span>Area / board</span><span>Task distribution · click to explore</span><span>Open</span><span>Total</span><span></span></div>${SPACES.filter(space=>settings.space==='all'||space.id===settings.space).map(space=>`<div class="sum-area-label"><i class="${space.color}"></i>${space.name}</div>${model.boards.filter(b=>b.spaceId===space.id).map(board=>{const tasks=model.selected.filter(t=>t.board===board.id);return `<div class="sum-portfolio-row">${button(`${icon('records',15)}${esc(board.name)}`,`data-browse="${board.id}"`,'sum-board-name')}${stack(tasks,board.id)}<span>${tasks.filter(t=>t.status!=='completed').length}</span><strong>${tasks.length}</strong>${button(icon('chevron',14),`data-browse="${board.id}" aria-label="Browse ${esc(space.name)} ${esc(board.name)} tasks"`)}</div>`;}).join('')}`).join('')}</div></section><aside class="sum-portfolio-side"><section class="sum-health"><header><h2>Scope completion</h2><span>${pct}% complete</span></header><div class="sum-donut" style="--sum-done:${pct}%" role="img" aria-label="${completed} of ${total} tasks in the selected scope completed"><div><strong>${total}</strong><span>tasks in scope</span></div></div><p class="sum-health-caption">All statuses in the selected scope</p><div class="sum-health-counts">${button(`<i class="purple"></i><span>Open</span><strong>${total-completed}</strong>`,'data-bucket="open"')}${button(`<i class="green"></i><span>Completed</span><strong>${completed}</strong>`,'data-bucket="completed"')}</div></section><section class="sum-ownership"><h2>Who’s handling the work?</h2>${[['ML','You'],['TEAM','Team queue'],['EG','EDgent']].map(([id,name])=>{const count=model.scoped.filter(t=>t.owner===id).length;return button(`${avatar(id,'tiny')}<span>${name}<i><b style="width:${total?count/total*100:0}%"></b></i></span><strong>${count}</strong>`,`data-owner="${id}" aria-label="Show ${name} tasks"`);}).join('')}<p>Ownership across the selected scope.</p></section></aside></div>`;
}
function footer(){return `<footer class="sum-footer"><span>${icon('info',13)} Workflow stages are a demo. ${button('How priorities work','data-summary-action="explain"','sum-text-button')}</span><span>${refreshedAt?'Refreshed '+new Date(refreshedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'All visible boards included'} · ${model.total} tasks</span></footer>`;}
function render(preserveControls=false){
 if(!active||!root)return;
 root.setAttribute('aria-busy',String(loading));
 model=summarize(store.tasks,settings,store.clock);
 const focused=document.activeElement;
 const focus=focused?.id,selection=focus==='sum-search'?{start:focused.selectionStart,end:focused.selectionEnd,direction:focused.selectionDirection}:null;
 const attributes=['data-version','data-bucket','data-page','data-direction','data-owner','data-summary-action'];
 const focusSelector=focused?.closest('#task-summary')?attributes.filter(a=>focused.hasAttribute(a)).map(a=>`[${a}="${CSS.escape(focused.getAttribute(a))}"]`).join(''):'';
 const scroll=root.scrollTop;
 const content=(error?`<div role="alert" class="sum-error">${esc(error)} ${button('Try again','data-summary-action="refresh"')}</div>`:'')+metrics()+filterLine()+(model.selected.length?(settings.version==='board'?boardView():settings.version==='focus'?focusView():portfolioView()):empty())+footer();
 if(preserveControls && root.querySelector('.sum-content')) {
  root.querySelector('.sum-content').innerHTML=content;
  const count=root.querySelector('.sum-source-count');count.textContent=`${model.scoped.length} of ${model.total} tasks`;count.dataset.total=String(model.total);
 } else root.innerHTML=header()+toolbar()+`<div class="sum-content">${content}</div>`;
 root.scrollTop=scroll;
 if(focusSelector)root.querySelector(focusSelector)?.focus({preventScroll:true});
 if(focus){const input=root.querySelector('#'+focus);if(input!==focused){input?.focus({preventScroll:true});if(selection&&input?.type==='search')input.setSelectionRange(selection.start,selection.end,selection.direction);}}
}
function dialog(title,body){
 if(!picker){picker=document.createElement('dialog');picker.className='sum-dialog';picker.setAttribute('aria-labelledby','sum-dialog-title');document.body.append(picker);picker.addEventListener('click',e=>{if(e.target.closest('[data-dismiss-summary]'))picker.close();const task=e.target.closest('[data-summary-task]');if(task){picker.close();openSummaryTask(task.dataset.summaryTask);}});}
 picker.innerHTML=`<header><h2 id="sum-dialog-title">${esc(title)}</h2>${button(icon('close',18),'data-dismiss-summary aria-label="Close task list"')}</header><div class="sum-dialog-body">${body}</div>`;
 if(!picker.open)picker.showModal();
}
function browse(board,bucket){browseContext={board,bucket};const tasks=model.selected.filter(t=>t.board===board&&(!bucket||bucketFor(t,store.clock)===bucket));dialog(`${BOARDS[board].space} / ${BOARDS[board].name}${bucket?' · '+labelFor(bucket):''}`,`<p>${tasks.length} matching tasks. Select a task to continue.</p><div class="sum-browse-tasks">${tasks.map(t=>taskButton(t)).join('')||'<p>No tasks match the current filters.</p>'}</div>`);}
async function refresh(){if(loading)return;loading=true;error='';render();try{await refreshIdentities();refreshedAt=Date.now();}catch{error='Could not refresh tasks. You’re viewing the last loaded data; your filters are retained.';}finally{loading=false;render();}}
function bind(){
 root.addEventListener('click',e=>{
  const target=e.target.closest('button');if(!target)return;
  if(target.dataset.version){settings.version=target.dataset.version;persist();render();return;}
  if(target.dataset.summaryTask){openSummaryTask(target.dataset.summaryTask);return;}
  if(target.dataset.previewTask){settings.selected=target.dataset.previewTask;render();root.querySelector(`[data-preview-task="${settings.selected}"]`)?.focus({preventScroll:true});return;}
  if(target.dataset.bucket){settings.bucket=target.dataset.bucket;resetPages();render();return;}
  if(target.dataset.owner){settings.owner=target.dataset.owner;resetPages();render();return;}
  if(target.dataset.browse){browse(target.dataset.browse,target.dataset.browseBucket);return;}
  if(target.dataset.page){const id=target.dataset.page,direction=Number(target.dataset.direction);if(id==='queue')settings.page=Math.max(0,settings.page+direction);else settings.pages[id]=Math.max(0,(settings.pages[id]||0)+direction);settings.selected=null;render();return;}
  if(target.dataset.summaryAction==='refresh'){void refresh();return;}
  if(target.dataset.summaryAction==='clear'){clearFilters();render();return;}
  if(target.dataset.summaryAction==='explain'){browseContext=null;dialog('How priorities work',`<p>Every design summarizes the same complete set of tasks visible to Camila. Scope and area filters carry across all three designs.</p><ol><li><strong>Overdue:</strong> open tasks past their due time.</li><li><strong>Needs review:</strong> exceptions, escalations, checked documents, approvals and student responses.</li><li><strong>Waiting:</strong> submissions, corrections, replies and balances.</li><li><strong>In progress:</strong> the remaining open work.</li></ol><p>Each task belongs to one group. Within a group, the earliest deadline comes first, followed by the recorded priority. Focus puts in-progress work ahead of waiting work.</p><p>Workflow stages use the existing demo preview. Deadlines follow the Task Board’s clock (${date(store.clock)}); uploaded documents use the current time. No urgency, savings or performance trends are generated.</p>`);}
 });
 root.addEventListener('input',e=>{if(e.target.id==='sum-search'){settings.q=e.target.value;resetPages();render(true);}});
 root.addEventListener('change',e=>{const key={'sum-owner':'owner','sum-space':'space','sum-group':'group'}[e.target.id];if(key){settings[key]=e.target.value;resetPages();render();}});
}
let lastOpenedKey=null;
document.querySelector('#task-dialog')?.addEventListener('close',()=>{if(active&&lastOpenedKey){const target=root.querySelector(`[data-summary-task="${CSS.escape(lastOpenedKey)}"],[data-preview-task="${CSS.escape(lastOpenedKey)}"]`);(target||root.querySelector('h1'))?.focus({preventScroll:true});}});
let pending;
window.addEventListener('audentra:demo-tasks-changed',()=>{clearTimeout(pending);pending=setTimeout(()=>{render(true);if(picker?.open&&browseContext){const y=picker.scrollTop;browse(browseContext.board,browseContext.bucket);picker.scrollTop=y;}},30);});
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent)return;if(e.data?.type==='audentra:approved-board:summary')showSummary();if(e.data?.type==='audentra:approved-board:show-board')hideSummary();if(e.data?.type==='audentra:approved-board:select'){hideSummary();if(BOARDS[e.data.board]&&e.data.board!==view.board)switchBoard(e.data.board);}});

window.addEventListener('resize',()=>{clearTimeout(pending);pending=setTimeout(()=>render(true),120);});

function openSummaryTask(key) {
 if(!store.tasks.some(task=>task.key===key)){render();toast('This task is no longer in the current dataset. Refresh to review available tasks.');return;}
 lastOpenedKey=key;
 openTask(key,model.selected.map(task=>task.key));
}

// Keep the existing board's slash shortcut useful on the summary as well.
document.addEventListener('keydown',event=>{
 if(active&&event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!document.querySelector('dialog[open]')&&!event.target.matches('input,textarea,select,[contenteditable]')){
  event.preventDefault();event.stopImmediatePropagation();root.querySelector('#sum-search')?.focus();
 }
},true);
