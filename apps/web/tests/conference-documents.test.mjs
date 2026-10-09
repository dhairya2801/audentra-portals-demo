import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldSchema,reviewFor,checkField} from '../public/action-center-demo/src/review-model.js';
const task=(extraction)=>({student:'Ada Kettleby',category:'Identity / passport',version:1,status:'processing',exceptions:[],actualDocument:{category:'identity',extraction}});
test('fresh stored document never inherits preview or seeded extracted values',()=>{
 const t=task({status:'pending_staff',fields:[],courses:[]});
 t.review={version:1,values:{studentName:'Old demo name',passport_number:'old value'}};
 assert.ok(fieldSchema(t).length>5);
 assert.ok(Object.values(reviewFor(t).values).every(value=>value===''));
 assert.equal(reviewFor(t).processed,false);
 assert.equal(fieldSchema(t).find(f=>f.id==='studentName').system,'Ada Kettleby');
});
test('staff parsing result replaces the blank projection using persisted evidence only',()=>{
 const t=task({status:'pending_staff',fields:[],courses:[]});reviewFor(t);
 t.actualDocument.extraction={status:'completed',studentName:'ADA KETTLEBY',fields:[{key:'passport_number',label:'Passport number',value:'DEMO-US-061'}]};
 assert.equal(reviewFor(t).values.passport_number,'DEMO-US-061');
 assert.equal(reviewFor(t).values.date_of_birth,'');
 assert.equal(checkField(fieldSchema(t)[0],reviewFor(t).values.studentName),'match');
 t.actualDocument.extraction={...t.actualDocument.extraction,studentName:'Ada Kettleby',staffCorrected:true};
 assert.equal(reviewFor(t).values.studentName,'Ada Kettleby');
});
test('transcript rows retain term, source course code, credits and grade without seeded courses',()=>{
 const t=task({status:'completed',fields:[{key:'attendance_period',label:'Attendance dates',value:'2022–2026'}],courses:[{term:'Fall 2025',sourceCode:'ENG 401',title:'English Literature IV',credits:1,grade:'A'}]});t.actualDocument.category='transcript';
 const rows=fieldSchema(t);
 assert.equal(rows.filter(f=>f.label==='Attendance dates').length,1);
 assert.equal(rows.find(f=>f.id==='course_0_sourceCode').source,'ENG 401');
 assert.equal(rows.find(f=>f.id==='course_0_credits').source,'1');
 assert.equal(rows.find(f=>f.id==='course_0_grade').source,'A');
 assert.ok(!rows.some(f=>f.source==='AP Calculus BC'));
});
