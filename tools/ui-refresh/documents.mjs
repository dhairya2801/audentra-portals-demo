import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, expect, request } from '@playwright/test';

// Read-only document checks. Sign-in creates only the normal demo session.
const base = process.env.PORTAL_BASE || 'http://localhost:3000';
const output = process.env.DOCUMENT_CHECK_OUTPUT || 'artifacts/ui-refresh/documents';
await fs.mkdir(output, { recursive: true });
const api = await request.newContext({ baseURL: base });
const browser = await chromium.launch();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  assert.ok((await api.post('/v1/auth/demo/staff/sign-in-as', { data: { staffRef: 'AU-55ff7e408818' } })).ok());
  const record = await (await api.get('/v1/staff/demo-task-board')).json();
  const documents = [...new Map(record.cards.flatMap(card => card.documents).map(doc => [doc.id, doc])).values()];
  assert.ok(documents.length > 0, 'The fixture must include original documents');
  for (const document of documents) {
    const response = await api.get(document.contentPath);
    assert.ok(response.ok(), `Original ${document.id}: HTTP ${response.status()}`);
    assert.equal((await response.body()).length, document.sizeBytes);
  }
  const card = record.cards.find(card => card.board === 'en-docs' && card.documents[0]?.mimeType === 'application/pdf');
  assert.ok(card, 'A PDF document card must be available');
  const page = await browser.newPage({ storageState: await api.storageState(), viewport: { width: 1512, height: 982 } });
  const errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/v1/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push(request.url()); });
  await page.goto(`${base}/staff#tasks`);
  const board = page.frameLocator('#approved-task-board');
  await board.locator(`[data-task="${card.key}"]`).click();
  const canvas = board.locator('[data-original-document] canvas');
  await expect(canvas).toBeVisible();
  assert.ok(await canvas.evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] && pixels[i] < 100 && pixels[i + 1] < 100 && pixels[i + 2] < 100) return true;
    return false;
  }), 'Original PDF renders actual visible content');
  await page.screenshot({ path: `${output}/original-pdf.png` });
  const downloaded = page.waitForEvent('download');
  await board.getByRole('button', { name: 'Download original document', exact: true }).click();
  const download = await downloaded;
  const original = await api.get(card.documents[0].contentPath);
  assert.equal(hash(await fs.readFile(await download.path())), hash(await original.body()));
  await page.route('**/v1/staff/documents/*/content', route => route.fulfill({ status: 503, json: { error: { message: 'Test storage failure' } } }));
  await page.reload();
  await board.locator(`[data-task="${card.key}"]`).click();
  await expect(board.locator('[data-original-document]')).toContainText('The original file could not be displayed');
  await page.unroute('**/v1/staff/documents/*/content');
  await board.locator('[data-original-document]').getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(canvas).toBeVisible();
  await board.getByRole('button', { name: 'Expand document', exact: true }).click();
  await expect(board.locator('#action-dialog [data-original-document] canvas')).toBeVisible();
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  const result = { base, documentCount: documents.length, checks: ['original endpoints and file lengths', 'visible PDF content', 'download SHA-256 parity', 'storage failure and retry', 'expanded document'], errors, writes };
  await fs.writeFile(`${output}/results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  await api.dispose();
}
