// One field schema and decision model for manual entry and agent extraction.
const courseRows = [
 ['calculus','AP Calculus BC','1.0 credit · A','MATH elective · grade ≥ C'],
 ['english','English Literature IV','1.0 credit · A−','English requirement · grade ≥ C'],
 ['programming','AP Computer Science A','1.0 credit · A','CS placement evidence · grade ≥ B'],
 ['physics','Physics Honors','1.0 credit · B+','Science requirement · grade ≥ C'],
 ['government','US Government','0.5 credit · A','Social science · grade ≥ C'],
 ['arts','Visual Arts','0.5 credit · A','Elective · grade ≥ C']
];
export function fieldSchema(t) {
 const flag=id=>(t.sourceExceptions||t.exceptions).includes(id)&&t.version===1;
 const row=(id,label,source,system,policy,extra={})=>({id,label,source,system,policy,page:1,...extra});
 const name=row('name','Full name',flag('name')?(t.student.split(' ')[0]+' '+t.student.split(' ').at(-1)[0]+'.'):(t.student),t.student,'ENR-02 · Legal identity',{number:1,reason:'Name differs from the application. Compare date of birth and institution before accepting the variation.'});
 const dob=row('dob','Date of birth','Feb 18, 2008','Feb 18, 2008','ENR-02 · Identity corroboration');
 if(t.category==='Income verification')return [name,row('income','Annual income',flag('income')?'$68,240':'$62,400','$62,400','FIN-03 · Application income',{number:2,reason:'The statement differs from the aid application. Confirm the correct tax-year total.'}),row('year','Tax year','2025','2025','FIN-03 · Current tax year'),row('household','Household size','4','4','FIN-03 · Dependents'),row('signature','Signature','Present','Present','FIN-05 · Signed declaration'),row('issued','Statement date','Sep 8, 2026','Sep 8, 2026','FIN-05 · Current statement')];
 if(t.category==='Identity')return [name,dob,row('id','Student ID',t.studentId,t.studentId,'ENR-02 · Record association'),row('residency','Residency','In-state','In-state','ENR-03 · Residency'),row('expiry','Valid through','Feb 18, 2030','Feb 18, 2030','ENR-03 · Valid identification'),row('quality','Document quality','Legible','Legible','ENR-03 · Readable evidence')];
 const fields=[name,dob,row('institution','Institution',t.category==='Transfer record'?'North Valley Community College':'Westfield High School',t.category==='Transfer record'?'North Valley Community College':'Westfield High School','ENR-04 · Recognized institution'),row('graduation','Graduation status',flag('graduation')?'Expected · Jun 12, 2026':'Awarded · Jun 12, 2026','Awarded · Jun 12, 2026','ENR-04 · Diploma award confirmed',{number:2,page:2,reason:'An expected date does not confirm graduation. Request a final transcript showing the diploma award.'}),row('gpa','Cumulative GPA','3.78 / 4.00','Minimum 2.50 / 4.00','ENR-05 · Admission threshold',{rule:'gpa'}),row('credits','Credits earned',flag('credits')?'18.0':'24.0','24.0','ENR-08 · Credit minimum',{number:3,reason:'Six credits are missing from the verified total. Course equivalency needs registrar review.'}),row('enrollment','Attendance dates','Sep 2022 – Jun 2026','Sep 2022 – Jun 2026','ENR-04 · Attendance record'),row('credential','Credential','High school diploma','High school diploma','ENR-04 · Completion requirement',{page:2}),row('scale','Grading scale','4.00 unweighted','4.00 unweighted','ENR-05 · Normalize GPA',{page:2}),row('standing','Academic standing','Good standing','Good standing','ENR-05 · Academic eligibility',{page:2}),...courseRows.map(([id,label,source,system])=>row(id,label,source,system,'ENR-08 · Course and grade verification',{rule:'course'})),row('transfer','Transfer assessment','AP coursework recorded','Registrar assessment required','ENR-08 · Harvest only; no credit awarded',{rule:'record',page:2}),row('delivery','Record source','School registrar','School registrar','ENR-04 · Official source',{page:2}),row('issued','Issued date',t.version>1?'Sep 9, 2026':!flag('graduation')?'Sep 8, 2026':'May 29, 2026','Record issue date','ENR-04 · Retain source date',{rule:'record'}),row('signature','Registrar signature','Elizabeth Warren','Elizabeth Warren','ENR-04 · Authorized signatory')];
 if(t.category==='Transfer record'){
  const update=(id,changes)=>Object.assign(fields.find(f=>f.id===id),changes);
  update('graduation',{source:'No degree awarded',system:'No degree required',rule:'record',reason:null,policy:'ENR-08 · Harvest award information'});
  update('credential',{source:'Undergraduate coursework',system:'Undergraduate coursework'});
  update('enrollment',{source:'Aug 2024 – May 2026',system:'Aug 2024 – May 2026'});
  update('transfer',{source:'College coursework recorded',system:'Registrar equivalency assessment required'});
  update('delivery',{source:'College registrar',system:'College registrar'});
  const titles=['Calculus I','English Composition II','Introduction to Programming','General Physics I','US Government','Introduction to Visual Arts'];
  courseRows.forEach(([id],i)=>update(id,{label:titles[i],source:'3.0 credits · '+['A','A−','A','B+','A','A'][i],system:'Transfer elective · grade ≥ C'}));
 }
 return fields;
}
export function reviewFor(t) {
 t.sourceExceptions??=[...t.exceptions];
 if(!t.review||t.review.version!==t.version){
  const manual=t.processingMode==='manual';
  t.review={version:t.version,lastProcessor:manual?'manual':'agent',mode:manual?'manual':'agent',values:Object.fromEntries(fieldSchema(t).map(f=>[f.id,['requested','processing','resubmitted'].includes(t.status)?'':f.source])),decisions:{},processed:!['requested','processing','resubmitted'].includes(t.status)};
  if(t.status==='correction')for(const f of fieldSchema(t))if(checkField(f,t.review.values[f.id])==='flag')t.review.decisions[f.id]={action:'correction',note:t.correctionNote||'Please upload a complete, legible document.',who:'ML',at:t.updated};
  for(const id of t.resolved||[])t.review.decisions[id]={action:'accept',note:'Previously recorded staff decision'};
 }
 return t.review;
}
const normalize=value=>value.toLowerCase().replace(/[−–]/g,'-').replace(/\s+/g,' ').trim();
export function checkField(field,value) {
 if(!value?.trim())return 'empty';
 if(field.rule==='record')return 'recorded';
 if(field.rule==='gpa')return /^\d+(\.\d+)?\s*\/\s*4\.00$/.test(value.trim())&&parseFloat(value)>=2.5&&parseFloat(value)<=4?'match':'flag';
 if(field.rule==='course')return normalize(value)===normalize(field.source)?'match':'flag';
 return normalize(value)===normalize(field.system)?'match':'flag';
}
export function reviewSummary(t) {
 const r=reviewFor(t),fields=fieldSchema(t),flagged=fields.filter(f=>checkField(f,r.values[f.id])==='flag');
 return {fields,total:fields.length,empty:fields.filter(f=>checkField(f,r.values[f.id])==='empty'),flagged,pending:flagged.filter(f=>!r.decisions[f.id]),corrections:flagged.filter(f=>r.decisions[f.id]?.action==='correction'),accepted:flagged.filter(f=>r.decisions[f.id]?.action==='accept')};
}
export function assertApprovable(t) {
 const s=reviewSummary(t);
 if(s.empty.length)throw Error(`Enter the ${s.empty.length} remaining document values before finishing.`);
 if(s.pending.length)throw Error(`Resolve ${s.pending.length} flagged checks in the review table first.`);
 if(s.corrections.length)throw Error('A corrected document is required before approval.');
}
