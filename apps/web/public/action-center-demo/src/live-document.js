// Canonical evidence projected into the existing four-column review table.
const configured = {
 transcript:[['date_of_birth','Date of birth'],['transcript_type','Transcript type'],['program','Program / credential'],['attendance_dates','Attendance dates'],['gpa','GPA'],['gpa_scale','GPA scale'],['total_credits','Credits earned']],
 identity:[['document_subtype','Document type'],['date_of_birth','Date of birth'],['nationality','Nationality'],['issuing_country','Issuing country'],['passport_number','Passport number'],['expiry_date','Expiry date']],
 health:[['date_of_birth','Date of birth'],['vaccination_records','Vaccination records'],['exemption','Documented exemption'],['titer_result','Titer result']],
 financial_aid:[['tax_year','Tax year'],['household_size','Household size'],['household_income','Household income'],['student_income','Student income']],
};
export function liveFieldSchema(t){
 const e=t.actualDocument.extraction||{},completed=e.status==='completed'||e.staffCorrected;
 const base=[['studentName','Full name'],['institutionName','Institution / issuer'],['issueDate','Issue date'],['academicTerm','Academic term']];
 const supplied=(e.fields||[]).map(f=>[f.key,f.label]);
 const aliases={attendance_dates:['attendance','attendance_period'],program:['credential_awarded','credential','degree','program_name'],gpa:['final_year_gpa','cumulative_gpa'],gpa_scale:['grade_scale','grading_scale'],total_credits:['cumulative_credits','credits_earned']};
 const keys=new Map(supplied);
 const expected=(configured[t.actualDocument.category]||[]).map(([key,label])=>{
  const actual=keys.has(key)?key:(aliases[key]||[]).find(k=>keys.has(k));
  return actual?[actual,keys.get(actual)]:[key,label];
 });
 const entries=new Map([...base,...expected,...supplied]);
 for(const key of e.validation?.missingFields||[])if(!entries.has(key))entries.set(key,key.replaceAll('_',' '));
 const values=new Map((e.fields||[]).map(f=>[f.key,f.value]));
 for(const [k] of base)values.set(k,e[k]);
 const rows=[...entries].map(([id,label],i)=>({id,label,source:completed?String(values.get(id)||''):'',system:id==='studentName'?t.student:'Review original',policy:'Document evidence',page:1,number:i+1,rule:id==='studentName'?'identity':'record',optional:!(e.validation?.missingFields||[]).includes(id),reason:'Compare the document with the student record.'}));
 for(const [i,c] of (completed?e.courses||[]:[]).entries()){
  for(const [key,label] of [['term','Term'],['sourceCode','Course code'],['title','Course'],['credits','Credits'],['grade','Grade']])rows.push({id:`course_${i}_${key}`,label:`${label} · row ${i+1}`,source:String(c[key]??''),system:'Review original',policy:'Course evidence · no credit awarded',page:1,rule:'record',optional:true});
 }
 return rows;
}
