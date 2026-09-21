/** Edward action previews remain server-owned from proposal through receipt. */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("action client sends only immutable confirmation coordinates", async () => {
  const [api, card] = await Promise.all([
    source("../app/lib/api-client.ts"),
    source("../app/components/edward-action-card.tsx"),
  ]);
  assert.match(api, /ConfirmEdwardActionInput/);
  assert.match(card, /expectedVersion: intent\.version/);
  assert.match(card, /contentSha256: intent\.contentSha256/);
  assert.match(api, /student\/assistant\/action-intents/);
  assert.match(api, /staff\/assistant\/action-intents/);
  assert.match(api, /getStudentEdwardAction/);
  assert.match(api, /getStaffEdwardAction/);
  assert.doesNotMatch(api, /confirmEdwardAction[\s\S]{0,300}(studentId|tenantId|staffMemberId)/);
});

test("structured confirmation renders exact scope and risk-sensitive controls", async () => {
  const card = await source("../app/components/edward-action-card.tsx");
  assert.match(card, /confirmationMode === "strong_confirm"/);
  assert.match(card, /confirmationMode === "external_confirm"/);
  assert.match(card, /I reviewed the target, scope, and exact effect/);
  assert.match(card, /preview\.changes\.map/);
  assert.match(card, /preview\.workItem/);
  assert.match(card, /preview\.cohort\.count/);
  assert.match(card, /preview\.cohort\.sample\.map/);
  assert.match(card, /never action authority/);
  assert.match(card, /Preview expires at/);
});

test("failed receipts can never render as completed and email send is a second step", async () => {
  const card = await source("../app/components/edward-action-card.tsx");
  assert.match(card, /receipt\.status === "failed"[\s\S]{0,120}"Not completed"/);
  assert.match(card, /The message is prepared but has not been sent/);
  assert.match(card, /Queue email for sending/);
  assert.match(card, /confirmStaffEmailSendIntent/);
  assert.match(card, /emailIntent\.recipients\.join/);
  assert.match(card, /emailIntent\.body/);
});

test("conversation surfaces persist and rehydrate action intent cards", async () => {
  const [student, thread, staff] = await Promise.all([
    source("../app/components/edward-assistant.tsx"),
    source("../app/components/edward-thread.tsx"),
    source("../app/components/staff-edward-assistant.tsx"),
  ]);
  assert.match(student, /actionIntents: response\.actionIntents \?\? \[\]/);
  assert.match(thread, /<EdwardActionCard intent=\{intent\} actor="student"/);
  assert.match(staff, /<EdwardActionCard intent=\{intent\} actor="staff"/);
});

test("Edward Lab exposes policy, confirmation, execution and receipt facts", async () => {
  const [contract, inspector] = await Promise.all([
    source("../app/lib/edward-lab.ts"),
    source("../app/components/edward-trace-inspector.tsx"),
  ]);
  for (const field of [
    "actionPolicyResult",
    "actionDenialReason",
    "actionAuthorizationCapability",
    "actionBlastRadius",
    "actionExecutionResult",
    "actionLatencyMs",
  ]) {
    assert.match(contract, new RegExp(`${field}\\?`));
  }
  assert.match(inspector, /Action plane/);
  assert.match(inspector, /Preview provenance/);
  assert.match(inspector, /Server-issued receipt/);
  assert.match(inspector, /trace\.actionReceipt/);
});
