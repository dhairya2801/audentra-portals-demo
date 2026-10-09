import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

// Import the actual pure TypeScript modules, retaining their real dependencies.
async function moduleUrl(url){
 let code=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const match of [...code.matchAll(/from ["'](\.[^"']+)["']/g)]){
  const dependency=await moduleUrl(new URL(match[1]+'.ts',url));
  code=code.replace(match[0],`from "${dependency}"`);
 }
 return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}
const {criticalPath,sortTasks}=await import(await moduleUrl(new URL('../app/components/enrollment-model.ts',import.meta.url)));
const {meetingHref}=await import(await moduleUrl(new URL('../app/components/appointments-logic.ts',import.meta.url)));
const task=(code,changes={})=>({id:code,code,title:code,status:'pending',blocking:false,dueAt:null,dependencyCodes:[],submissionType:'form',interactionType:'form',inputConfig:{},...changes});

test('smart order sees an urgent downstream deadline through multiple prerequisite levels',()=>{
 const now=Date.now(),a=task('start'),b=task('middle',{dependencyCodes:['start']}),c=task('finish',{dependencyCodes:['middle'],dueAt:new Date(now+86400000).toISOString()}),other=task('independent',{dueAt:new Date(now+2*86400000).toISOString()});
 const all=[other,a,b,c],before=JSON.stringify(all);
 const path=criticalPath(a,all,now);
 assert.equal(path.count,2);assert.equal(path.deadline,Date.parse(c.dueAt));assert.ok(path.minutes>0);
 assert.equal(sortTasks([other,a],'smart',all)[0].id,'start');
 assert.equal(sortTasks([other,a],'due',all)[0].id,'independent');
 assert.equal(JSON.stringify(all),before,'ranking must not mutate canonical prerequisites');
});
test('critical-path presentation handles cycles and ignores completed dependents',()=>{
 const a=task('a',{dependencyCodes:['b']}),b=task('b',{dependencyCodes:['a']}),done=task('done',{dependencyCodes:['a'],status:'completed',dueAt:'2000-01-01T00:00:00Z'});
 const result=criticalPath(a,[a,b,done]);assert.ok(Number.isFinite(result.minutes));assert.equal(result.count,1);assert.equal(result.deadline,Infinity);
});
test('a meeting Join link requires an explicit HTTPS location without embedded credentials',()=>{
 assert.equal(meetingHref({modality:'virtual',location:'https://meet.example.edu/session/123'}),'https://meet.example.edu/session/123');
 for(const location of ['javascript:alert(1)','http://example.edu','https://user:password@example.edu','Campus room 3',null])assert.equal(meetingHref({modality:'virtual',location}),null);
 assert.equal(meetingHref({modality:'in_person',location:'https://example.edu'}),null);
});
