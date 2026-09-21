export const DEMO_NOW = '2026-09-09T18:00:00Z';
export const PEOPLE = {
 ML:{name:'Marcus Lee',role:'Enrollment advisor',color:'purple'},
 AR:{name:'Amelia Rivera',role:'Enrollment specialist',color:'teal'},
 SP:{name:'Sarah Park',role:'Senior registrar',color:'rose'},
 JC:{name:'James Chen',role:'Financial aid advisor',color:'blue'},
 EG:{name:'EDgent',role:'Automated document agent',color:'purple'},
 TEAM:{name:'Team queue',role:'Next available team member',color:'gray'}
};
export const TYPES = {document:{name:'Document review',icon:'file',color:'blue',tab:'Review workspace'},outreach:{name:'Outreach',icon:'megaphone',color:'purple',tab:'Communications'},request:{name:'Student request',icon:'ticket',color:'teal',tab:'Request workspace'},payment:{name:'Payment',icon:'wallet',color:'green',tab:'Payment workspace'}};
const stage=(id,name,category,hours,owner,description)=>({id,name,category,hours,owner,description});
export const WORKFLOWS = {
 document:[stage('requested','Waiting for Submission','todo',72,'Student','Waiting for student upload'),stage('processing','Processing Document','active',1,'EDgent','Parse, extract & check'),stage('clean','Reviewing · Checks Passed','active',24,'Staff','Validate & approve'),stage('exceptions','Reviewing · Exceptions','warning',48,'Staff','Human judgment required'),stage('correction','Awaiting Correction','todo',168,'Student','Correction requested'),stage('resubmitted','Processing Resubmission','active',1,'EDgent','Recheck the new version'),stage('completed','Completed','done',0,'System','Requirement satisfied')],
 outreach:[stage('identified','Identified','todo',48,'Advisor','A student needs support'),stage('drafting','Preparing Outreach','active',24,'Staff','Personalize the message'),stage('approval','Awaiting Approval','active',24,'Approver','Review content & audience'),stage('waiting','Awaiting Response','active',72,'Student','Follow up with care'),stage('responded','Reviewing Response','active',24,'Staff','Address the next step'),stage('completed','Completed','done',0,'System','Outreach objective met')],
 request:[stage('received','Received','todo',24,'Staff','New student requests'),stage('reviewing','Reviewing Request','active',48,'Staff','Understand & coordinate'),stage('waiting','Awaiting Response','todo',120,'Student','More information needed'),stage('escalated','Resolving Escalation','warning',48,'Leader','Specialist input needed'),stage('completed','Completed','done',0,'System','Resolution recorded')],
 payment:[stage('requested','Requested','todo',72,'Payer','Payment outstanding'),stage('processing','Processing Payment','active',24,'System','Awaiting settlement'),stage('balance','Awaiting Balance','active',720,'Payer','Partially paid'),stage('exception','Resolving Payment','warning',48,'Finance','Reconciliation required'),stage('completed','Completed','done',0,'System','Payment settled')]
};
export const BOARDS = {
 'en-docs':{space:'Enrollment',spaceId:'en',name:'Document review',type:'document',prefix:'ENR',description:'Process and review enrollment documents against student records and checklist requirements.',team:'Enrollment operations'},
 'en-outreach':{space:'Enrollment',spaceId:'en',name:'Outreach',type:'outreach',prefix:'ENR',description:'Institution-initiated reminders, campaigns, and targeted follow-up for enrollment.',team:'Enrollment advising'},
 'en-requests':{space:'Enrollment',spaceId:'en',name:'Student requests',type:'request',prefix:'ENR',description:'Student-initiated questions and requests. Understand the ask, coordinate, and resolve.',team:'Enrollment operations'},
 'fa-docs':{space:'Financial Aid',spaceId:'fa',name:'Document review',type:'document',prefix:'FIN',description:'Review financial evidence and resolve verification requirements.',team:'Financial aid operations'},
 'fa-outreach':{space:'Financial Aid',spaceId:'fa',name:'Outreach',type:'outreach',prefix:'FIN',description:'Institution-initiated aid reminders, campaigns, and targeted student follow-up.',team:'Financial aid advising'},
 'fa-payments':{space:'Financial Aid',spaceId:'fa',name:'Payments',type:'payment',prefix:'FIN',description:'Track deposits, installments, and refunds through confirmed settlement.',team:'Student accounts'},
 'cl-housing':{space:'Campus Life',spaceId:'cl',name:'Housing requests',type:'request',prefix:'HOU',description:'Coordinate housing needs so every student has a place to belong.',team:'Residential life'}
};
export const SPACES=[{id:'fa',name:'Financial Aid',icon:'wallet',color:'purple',boards:['fa-docs','fa-outreach','fa-payments']},{id:'en',name:'Enrollment',icon:'graduation',color:'blue',boards:['en-docs','en-outreach','en-requests']},{id:'cl',name:'Campus Life',icon:'buildings',color:'teal',boards:['cl-housing']}];
export function stageFor(task){
 const base=WORKFLOWS[task.type].find(s=>s.id===task.status);
 if(task.type==='request'&&task.status==='waiting'&&task.requestWork?.sentAt){
  const api=task.requestWork.rule==='api';
  return {...base,name:api?'Awaiting Resolution':'Awaiting Response',owner:api?task.resolutionTeam||(task.board==='cl-housing'?'Residential Life':/defer|spring/i.test(task.title)?'Admissions':'Registrar'):'Student',hours:48,category:api?'active':'todo'};
 }
 return base;
}
export const columnFor = status=>status==='resubmitted'?'processing':['clean','exceptions'].includes(status)?'reviewing':status;
export function transitionsFor(task){
 const maps={
 document:{requested:[['processing','Start processing']],processing:[['clean','Submit to review'],['exceptions','Flag exceptions']],clean:[['completed','Approve'],['correction','Request correction']],exceptions:[['completed','Approve document'],['correction','Request correction']],correction:[['resubmitted','Resubmit document']],resubmitted:[['clean','Submit to review'],['exceptions','Flag exceptions']],completed:[]},
 outreach:{identified:[['drafting','Prepare outreach']],drafting:[['approval','Submit for approval']],approval:[['waiting','Approve & send'],['drafting','Request rework']],waiting:[['responded','Simulate student reply']],responded:[['completed','Complete outreach'],['drafting','Prepare follow-up']],completed:[]},
 request:{received:[['reviewing','Start review']],reviewing:[['waiting','Request information'],['escalated','Escalate'],['completed','Resolve request']],waiting:[['reviewing','Simulate student response'],['completed','Close with resolution']],escalated:[['reviewing','Return to review'],['completed','Resolve request']],completed:[]},
 payment:{requested:[['processing','Record payment']],processing:[['completed','Confirm settlement'],['balance','Record partial payment'],['exception','Flag payment issue']],balance:[['processing','Record next installment']],exception:[['processing','Retry payment']],completed:[]}
 };
 return (maps[task.type][task.status]||[]).map(([to,label])=>({to,label}));
}
const students=[['Maya Patel','BS Computer Science','2026-04821'],['Noah Williams','BS Business Administration','2026-04903'],['Sofia Martinez','BA Psychology','2026-04867'],['Ethan Brooks','BS Nursing','2026-05102'],['Olivia Chen','BS Data Science','2026-04731'],['Liam Johnson','BS Engineering','2026-05044'],['Amara Okafor','BA Public Health','2026-04986'],['Lucas Anderson','BS Biology','2026-04812'],['Isabella Rivera','BA Communication','2026-05028'],['Arjun Mehta','BS Computer Science','2026-05063'],['Charlotte Kim','BA Economics','2026-05116'],['Daniel Thompson','BS Environmental Science','2026-04894'],['Ava Wilson','BS Nursing','2026-04798'],['Benjamin Scott','BA History','2026-05072'],['Zoe Nguyen','BS Data Science','2026-05129'],['Samuel Davis','BS Engineering','2026-04841'],['Layla Hassan','BA Psychology','2026-04947'],['Henry Garcia','BS Business Administration','2026-05006']];
const hoursAgo=n=>new Date(Date.parse(DEMO_NOW)-n*3600000).toISOString();
function activity(who,text,kind='history',hours=4){return {who,text,kind,at:hoursAgo(hours)};}
function make(board,key,title,status,studentIndex,owner='ML',priority='Medium',extra={}) {
 const b=BOARDS[board],s=students[studentIndex%students.length];
 const task={board,key,title,status,type:b.type,student:s[0],program:s[1],studentId:s[2],cohort:'Fall 2026',owner,priority,team:b.team,delegation:owner==='EG'?'Automated agent':owner==='TEAM'?'Team queue':'Direct assignment',created:hoursAgo(27),updated:hoursAgo(3),entered:hoursAgo(3),labels:[],category:b.type==='document'?'Transcript':b.name,version:1,exceptions:[],resolved:[],visited:[],activity:[],...extra};
 if(Date.parse(task.created)>Date.parse(task.entered))task.created=new Date(Date.parse(task.entered)-24*3600000).toISOString();
 const stage=stageFor(task);
 task.due=stage.hours?new Date(Date.parse(task.entered)+stage.hours*3600000).toISOString():null;
 task.visited=task.visited.length?task.visited:(b.type==='document'?(status==='requested'?[]:status==='processing'?['requested']:status==='resubmitted'?['requested','processing','exceptions','correction']:status==='completed'?['requested','processing','clean']:status==='correction'?['requested','processing','exceptions']:['requested','processing']):WORKFLOWS[b.type].slice(0,WORKFLOWS[b.type].findIndex(x=>x.id===status)).map(s=>s.id));
 task.activity=[activity('EG',`${TYPES[b.type].name} task created from ${b.type==='outreach'?'a journey signal':'the student portal'}.`,'history',27),activity('EG',`Assignee changed: Team queue → ${PEOPLE[owner].name}.`,'history',26),activity(owner,`Status changed to ${stage.name}.`,'history',3)];
 if(b.type==='document'&&!['requested','processing'].includes(status))task.activity.splice(2,0,activity('EG',`Processed document v${task.version}; extracted ${['Income verification','Identity'].includes(task.category)?6:20} fields and compared them with configured requirements.`,'history',4));
 if(status==='correction')task.activity.push(activity('ML','Correction requested: please upload a complete, legible document.','history',2.8));
 if(status==='resubmitted')task.activity.push(activity('student','Resubmitted a corrected document; processing restarted.','history',.2));
 if(status==='completed')task.activity.push(activity(owner,b.type==='document'?'Approved document. Linked requirement marked complete.':'Work completed; outcome recorded.','history',2));
 if(b.type==='payment') {task.amount=extra.amount||500;task.paid=status==='completed'?task.amount:extra.paid||0;task.direction=extra.direction||'Inbound';task.transactions=task.paid?[{id:'TXN-'+key.split('-')[1]+'01',date:'Sep 8, 2026',method:'ACH •••• 4821',amount:task.paid,status:'Settled'}]:[];}
 if(b.type==='outreach'){task.messages=[{who:'ML',at:hoursAgo(25),channel:'Portal message',text:board==='fa-outreach'?`Hi ${s[0].split(' ')[0]}, I’m checking in about your financial aid next steps. I’m here if you’d like to work through them together.`:`Hi ${s[0].split(' ')[0]}, we’re excited to welcome you this fall. Have you had a chance to choose an orientation session? I can help find one that fits your schedule.`}];if(status==='responded'||status==='completed')task.messages.push({who:'student',at:hoursAgo(3),channel:'Portal reply',text:'Thanks for checking in! I work on weekday mornings. Is there an afternoon session available?'});}
 task.activity[0].at=task.created;
 task.activity[1].at=new Date(Date.parse(task.created)+60000).toISOString();
 for(let i=2;i<task.activity.length;i++)task.activity[i].at=new Date(Date.parse(task.entered)+(i-2)*1000).toISOString();
 task.updated=task.activity.at(-1).at;
 return task;
}
export function seedTasks(){
 const docs=[
 make('en-docs','ENR-184','Review final high school transcript','exceptions',0,'ML','High',{hero:true,labels:['Final transcript','Enrollment blocker'],category:'Transcript',entered:hoursAgo(19.7),exceptions:['name','graduation']}),
 make('en-docs','ENR-201','Verify transfer credits & course equivalency','exceptions',6,'SP','Urgent',{labels:['Transfer credit'],entered:hoursAgo(54),exceptions:['credits'],category:'Transfer record'}),
 make('en-docs','ENR-198','Confirm name on residency evidence','exceptions',8,'AR','High',{labels:['Identity check'],exceptions:['name'],category:'Identity'}),
 make('en-docs','ENR-213','Request final high school transcript','requested',1,'ML','Medium',{labels:['Final transcript']}),
 make('en-docs','ENR-215','Collect official transfer transcript','requested',9,'AR','High',{labels:['Transfer student'],category:'Transfer record'}),
 make('en-docs','ENR-218','Request proof of residency','requested',10,'TEAM','Medium',{labels:['Residency'],category:'Identity'}),
 make('en-docs','ENR-219','Collect graduation certificate','requested',15,'TEAM','Low',{labels:['International'],category:'Graduation certificate'}),
 make('en-docs','ENR-209','Extract final transcript fields','processing',2,'EG','Medium',{labels:['EDgent processing'],entered:hoursAgo(.15)}),
 make('en-docs','ENR-211','Recheck corrected final transcript','resubmitted',7,'EG','High',{labels:['Resubmitted · v2'],entered:hoursAgo(.1),version:2}),
 make('en-docs','ENR-216','Parse official transfer record','processing',14,'AR','Medium',{processingMode:'manual',labels:['Manual processing'],category:'Transfer record',entered:hoursAgo(.05)}),
 make('en-docs','ENR-190','Review final high school transcript','clean',3,'AR','Medium',{labels:['20 checks passed']}),
 make('en-docs','ENR-192','Verify graduation certificate','clean',4,'ML','Medium',{labels:['20 checks passed'],category:'Graduation certificate'}),
 make('en-docs','ENR-195','Review official transfer transcript','clean',13,'SP','Low',{labels:['Transfer student'],category:'Transfer record'}),
 make('en-docs','ENR-203','Confirm residency documentation','clean',16,'AR','Low',{labels:['Identity matched'],category:'Identity'}),
 make('en-docs','ENR-172','Replace incomplete transcript scan','correction',5,'ML','High',{labels:['Missing page 2'],exceptions:['graduation'],correctionNote:'Please upload both pages of your final transcript, including the graduation date.'}),
 make('en-docs','ENR-177','Provide legible graduation certificate','correction',11,'AR','Medium',{labels:['Student notified'],category:'Graduation certificate',correctionNote:'Please provide a legible copy with the award date visible.'}),
 make('en-docs','ENR-165','Approve final high school transcript','completed',12,'ML','Low',{labels:['Requirement satisfied']}),
 make('en-docs','ENR-168','Verify official transfer record','completed',17,'SP','Medium',{labels:['24 credits accepted'],category:'Transfer record'}),
 make('en-docs','ENR-169','Confirm graduation certificate','completed',9,'AR','Low',{labels:['Requirement satisfied'],category:'Graduation certificate'})
 ];
 const hero=docs[0];
 hero.created='2026-09-07T13:00:00Z';hero.updated='2026-09-09T14:15:00Z';hero.uploaded='2026-09-08T22:14:00Z';
 hero.activity=[
 {who:'EG',kind:'history',at:'2026-09-07T13:00:00Z',text:'Task created. Final high school transcript requested for Fall 2026 enrollment.'},
 {who:'student',kind:'history',at:'2026-09-08T22:14:00Z',text:'Uploaded Maya_Patel_Final_Transcript.pdf · version 1 · 248 KB.'},
 {who:'EG',kind:'history',at:'2026-09-08T22:14:05Z',text:'Status changed: Requested → Processing Document.'},
 {who:'EG',kind:'history',at:'2026-09-08T22:14:18Z',text:'Parsed 2 pages; extracted 20 fields with 98.4% confidence. All pages are legible.'},
 {who:'EG',kind:'history',at:'2026-09-08T22:14:22Z',text:'Completed 20 checks. Detected a partial name match and unconfirmed graduation.'},
 {who:'EG',kind:'history',at:'2026-09-08T22:14:24Z',text:'Status changed: Processing Document → Reviewing · Exceptions. Staff judgment required.'},
 {who:'EG',kind:'history',at:'2026-09-08T22:14:25Z',text:'Assignee changed: EDgent → Marcus Lee. Delegation: human review required.'},
 {who:'EG',kind:'history',at:'2026-09-08T22:14:26Z',text:'Stage SLA updated: 48 hours. Due Sep 10, 6:14 PM EDT; processing SLO met in 26 seconds.'},
 {who:'ML',kind:'history',at:'2026-09-09T13:05:00Z',text:'Priority changed: Medium → High. Transcript is blocking enrollment clearance.'},
 {who:'SP',kind:'comment',at:'2026-09-09T14:15:00Z',text:'The middle-name omission can be accepted if the date of birth and school match. We still need confirmation that the diploma was awarded, not just an expected date.',visibility:'Enrollment team'}
 ];
 hero.activity.push({who:'EG',kind:'communication',channel:'Portal notification',at:'2026-09-08T22:14:27Z',text:'We received your transcript, Maya. Your enrollment advisor will review the document and let you know if anything else is needed.'});
 hero.activity.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 hero.entered='2026-09-08T22:14:24Z';hero.due='2026-09-10T22:14:24Z';
 const other=[
 make('en-outreach','ENR-431','Help book an orientation session','responded',0,'ML','High',{labels:['Student replied','Orientation']}),
 make('en-outreach','ENR-452','Deposit paid, orientation not booked','identified',3,'AR','Medium',{labels:['Journey signal']}),
 make('en-outreach','ENR-418','Follow up on missing transcript','drafting',5,'ML','High',{labels:['Second attempt']}),
 make('en-outreach','ENR-476','Welcome first-generation students','drafting',6,'EG','Low',{labels:['EDgent draft']}),
 make('en-outreach','ENR-437','Review transfer-credit guidance','approval',7,'SP','Medium',{labels:['Draft ready']}),
 make('en-outreach','ENR-429','Confirm placement test availability','waiting',9,'AR','High',{labels:['Portal · 2 attempts']}),
 make('en-outreach','ENR-460','Follow up before enrollment deadline','waiting',14,'ML','Urgent',{labels:['No response'],entered:hoursAgo(79)}),
 make('en-outreach','ENR-388','Confirm orientation booking','completed',11,'ML','Low',{labels:['Objective met']}),
 make('en-requests','ENR-088','Change major before orientation','reviewing',4,'ML','High',{labels:['Program change'],requestText:'I’d like to change my major from Data Science to Computer Science before orientation. I’ve completed Calculus I and Introduction to Programming. Can you help me understand whether this changes my scholarship or graduation timeline?',requestedProgram:'BS Computer Science'}),
 make('en-requests','ENR-091','Defer enrollment to spring','received',10,'AR','High',{labels:['Deferral']}),
 make('en-requests','ENR-084','Update preferred name on record','received',15,'TEAM','Medium',{labels:['Student record']}),
 make('en-requests','ENR-077','Assess transfer-credit eligibility','reviewing',7,'SP','Medium',{labels:['Registrar input']}),
 make('en-requests','ENR-083','Confirm spring start date','waiting',16,'AR','Medium',{labels:['Awaiting documents']}),
 make('en-requests','ENR-079','Review exceptional deferral request','escalated',12,'SP','Urgent',{labels:['Policy exception'],entered:hoursAgo(52)}),
 make('en-requests','ENR-072','Correct name on enrollment record','completed',2,'ML','Low',{labels:['Record updated']}),
 make('fa-payments','FIN-312','Reconcile fall tuition installment','balance',0,'JC','High',{labels:['Installment 2 of 4'],amount:6400,paid:1600}),
 make('fa-payments','FIN-310','Collect enrollment deposit','requested',1,'JC','Medium',{labels:['Deposit'],amount:500}),
 make('fa-payments','FIN-318','Collect fall housing deposit','requested',6,'TEAM','Medium',{labels:['Housing deposit'],amount:750}),
 make('fa-payments','FIN-298','Confirm tuition ACH settlement','processing',8,'JC','High',{labels:['ACH pending'],amount:3200}),
 make('fa-payments','FIN-286','Track monthly tuition installment','balance',11,'JC','Medium',{labels:['Payment plan'],amount:8000,paid:4000}),
 make('fa-payments','FIN-271','Resolve declined enrollment deposit','exception',3,'JC','Urgent',{labels:['Card declined'],amount:500,entered:hoursAgo(55)}),
 make('fa-payments','FIN-264','Reconcile housing overpayment refund','exception',4,'SP','Medium',{labels:['Outbound refund'],amount:750,direction:'Outbound'}),
 make('fa-payments','FIN-240','Confirm full tuition settlement','completed',9,'JC','Low',{labels:['Settled'],amount:6400}),
 make('cl-housing','HOU-030','Coordinate an accessible room assignment','reviewing',6,'AR','High',{labels:['Accessibility'],requestText:'I need a step-free route from my room to the main entrance and a bathroom on the same floor. Can we discuss available options before move-in?'}),
 make('cl-housing','HOU-035','Review late housing application','received',15,'TEAM','Medium',{labels:['Late application']}),
 make('cl-housing','HOU-027','Confirm roommate preferences','waiting',12,'AR','Low',{labels:['Student follow-up']}),
 make('cl-housing','HOU-028','Coordinate early arrival accommodation','escalated',5,'SP','High',{labels:['Specialist review']}),
 make('cl-housing','HOU-022','Confirm requested room swap','completed',16,'AR','Low',{labels:['Assignment updated']})
 ];
 for(let i=0;i<9;i++) other.push(make('fa-docs',`FIN-${151+i}`,['Verify household income statement','Review signed award acceptance','Validate identity verification'][i%3],['requested','processing','clean','exceptions','correction','completed','clean','requested','completed'][i],i,'JC',i===3?'High':'Medium',{category:i%3===2?'Identity':'Income verification',labels:['Aid verification'],exceptions:i===3?['income']:[],entered:hoursAgo(i===1?.1:3)}));
 for(let i=0;i<8;i++) other.push(make('fa-outreach',`FIN-${120+i}`,['Explain the financial aid offer','Follow up on award acceptance','Help complete verification','Arrange a payment-plan conversation'][i%4],['identified','drafting','approval','waiting','responded','waiting','completed','identified'][i],i,'JC',i===4?'High':'Medium',{labels:['Financial aid','Portal']}));
 for(const t of other){
  if(t.type==='request')t.activity.push({who:'student',kind:'communication',channel:'Inbound student email',at:t.created,text:t.requestText||`I need help with ${t.title.toLowerCase()}. Could you explain my options and next steps?`});
  if(t.type==='outreach'&&['waiting','responded','completed'].includes(t.status))for(const message of t.messages)t.activity.push({who:message.who,kind:'communication',channel:message.channel,at:message.at,text:message.text});
  t.activity.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 }
 return [...docs,...other];
}
