import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../public/action-center-approved/', import.meta.url);
const read = path => readFileSync(new URL(path, root));

test('approved assets match every source-of-truth byte and contain no meeting attachments', () => {
  const manifest = JSON.parse(read('source-manifest.json'));
  assert.equal(manifest.sourceCommit, '9593ee09a36537ccdd04a558a4ff7f26e52a1c9a');
  for (const [path, hash] of Object.entries(manifest.files)) {
    assert.equal(createHash('sha256').update(read(path)).digest('hex'), hash, path);
  }
  const actual = readdirSync(root, {recursive: true}).filter(path => /\.[a-z0-9]+$/i.test(path)).sort();
  assert.deepEqual(actual, [...Object.keys(manifest.files), 'portal-bridge.js', 'source-manifest.json'].sort());
});

test('staff route keeps authenticated loading and canonical deep links around the approved mock', () => {
  const portal = readFileSync(new URL('../app/staff/staff-portal.tsx', import.meta.url), 'utf8');
  assert.match(portal, /view === "tasks" && !requestedWorkItemId/);
  assert.match(portal, /<ApprovedTaskBoard \/>/);
  assert.match(portal, /<ApprovedBoardNavigation/);
  assert.match(portal, /<Student360Workspace/);
  assert.match(portal, /initialWorkItemId=\{requestedWorkItemId\}/);
  assert.match(portal, /getStaffOperationsWorkspace/);
  const bridge = read('portal-bridge.js').toString();
  assert.match(bridge, /url\.searchParams\.set\('actionTask', key\)/);
  assert.match(bridge, /url\.hash = 'tasks'/);
  assert.doesNotMatch(bridge, /fetch\(|localStorage|\/v1\//);
});
