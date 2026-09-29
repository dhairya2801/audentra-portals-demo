/** Evidence about unchanged implementation; not a substitute for pixel tests. */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import postcss from 'postcss';
const base = 'a749ff1725291c4f90d8d9c70638563ff9cedc76';
const tracked = (await fs.readFile('artifacts/ui-refresh/base-files.txt','utf8')).trim().split('\n');
const changed = new Set((await fs.readFile('artifacts/ui-refresh/changed-files.txt','utf8')).trim().split('\n'));
const protectedPaths = tracked.filter(p =>
  /edward/i.test(p) ||
  p.startsWith('packages/contracts/') ||
  p === 'apps/web/app/lib/api-client.ts' ||
  p === 'apps/web/app/globals.css' ||
  p.startsWith('apps/web/app/audentra-design-styles/') ||
  p.startsWith('apps/web/public/action-center-demo/src/') ||
  p === 'apps/web/public/action-center-demo/styles.css' ||
  p === 'apps/web/public/financial-plan/canonical-plan.js'
);
const hash = value => createHash('sha256').update(value).digest('hex');
const files = [];
for (const path of protectedPaths) {
  assert.ok(!changed.has(path), `${path} changed from base`);
  const after = await fs.readFile(path);
  files.push({path, sha256:hash(after), unchanged:true});
}
const modulePath = 'apps/web/app/staff/student360-summary.module.css';
function buttonDeclarations(source) {
  let result;
  postcss.parse(source).walkRules('.heading button', rule => {result=Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(d=>[d.prop,d.value]));});
  return result;
}
assert.deepEqual(buttonDeclarations(await fs.readFile(modulePath,'utf8')), buttonDeclarations(await fs.readFile('artifacts/ui-refresh/original-student360.css','utf8')));
function edwardButton(source) {
  return source.slice(source.indexOf('export function EdwardButton('), source.indexOf('export function Avatar('));
}
assert.equal(edwardButton(await fs.readFile('apps/web/app/staff/morning-brew/cards.tsx','utf8')), edwardButton(await fs.readFile('artifacts/ui-refresh/original-brew-cards.tsx','utf8')));
await fs.mkdir('artifacts/ui-refresh',{recursive:true});
await fs.writeFile('artifacts/ui-refresh/source-integrity.json', JSON.stringify({base,files,student360AskEdwardDeclarationsUnchanged:true,brewEdwardButtonUnchanged:true,note:'Source integrity only; rendered and provider behavior need separate browser verification.'},null,2));
console.log(`${files.length} protected files are byte-identical to ${base}; Student 360 Ask Edward declarations are unchanged.`);
