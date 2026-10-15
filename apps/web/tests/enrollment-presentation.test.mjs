import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../app/components/enrollment-presentation.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {visibleEnrollmentRequirements,enrollmentPresentation}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const item=(code,status='ready')=>({id:`id-${code}`,code,status,title:code,description:'Original',slug:code.replaceAll('_','-'),version:3,submissionType:'document',documentCategory:'transcript',dependencyCodes:[],inputConfig:{expectedDocumentType:'transcript'}});
test('known seeded duplicates collapse to one stable upload requirement through its lifecycle',()=>{
 const records=['ada_demo_transcript','official_transcript','camila_enr_190','ada_updated_transcript','custom_college_transcript','identity_document'].map(code=>item(code));
 for(const status of ['ready','submitted','under_review','rejected','completed']){
  const current=records.map(record=>record.code==='ada_updated_transcript'?{...record,status}:record);
  const before=structuredClone(current);
  const visible=visibleEnrollmentRequirements(current);
  assert.deepEqual(visible.map(r=>r.code),['ada_updated_transcript','custom_college_transcript','identity_document']);
  assert.equal(visible[0],current[3]);
  const display=enrollmentPresentation(visible[0]);
  for(const field of ['id','code','slug','status','version','submissionType','documentCategory','inputConfig','dependencyCodes'])assert.deepEqual(display[field],current[3][field]);
  assert.equal(display.title,['submitted','under_review'].includes(status)?'Your final transcript is under review':'Submit your final transcript');
  assert.deepEqual(current,before);
 }
});
test('normal and custom journeys retain distinct requirements and canonical evidence',()=>{
 const records=[item('official_transcript'),item('custom_college_transcript'),item('camila_enr_190')];
 assert.equal(visibleEnrollmentRequirements(records),records);
 assert.equal(enrollmentPresentation(records[1]),records[1]);
 const fallback=[item('ada_demo_transcript'),item('official_transcript')];
 assert.deepEqual(visibleEnrollmentRequirements(fallback),[fallback[0]]);
 assert.deepEqual(visibleEnrollmentRequirements([]),[]);
});
