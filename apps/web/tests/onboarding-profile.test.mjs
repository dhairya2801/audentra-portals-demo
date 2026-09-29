import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const source = await readFile(new URL('../app/onboarding/profile.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
const {loadOnboardingProfile} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
test('fresh accounts can open onboarding before their university profile exists', async () => {
  const missing = Object.assign(new Error('Student not found in this university'), {status:404, code:'UNIVERSITY_STUDENT_NOT_FOUND'});
  assert.equal(await loadOnboardingProfile(() => Promise.reject(missing)), null);
});
test('existing profile values and canonical version are preserved', async () => {
  const profile = {firstName:'Ada', pronouns:'she/her', version:17};
  assert.equal(await loadOnboardingProfile(() => Promise.resolve(profile)), profile);
});
test('profile authentication, authorization, server, network, abort and unrelated missing-resource errors still reject', async () => {
  for (const error of [
    Object.assign(new Error('Unauthorized'), {status:401}),
    Object.assign(new Error('Forbidden'), {status:403}),
    Object.assign(new Error('Unavailable'), {status:503}),
    Object.assign(new Error('Different resource'), {status:404,code:'STUDENT_PROFILE_NOT_FOUND'}),
    Object.assign(new Error('Wrong status'), {status:500,code:'UNIVERSITY_STUDENT_NOT_FOUND'}),
    new TypeError('Failed to fetch'), new DOMException('Aborted','AbortError'),
  ]) await assert.rejects(loadOnboardingProfile(() => Promise.reject(error)), e => e === error);
});
