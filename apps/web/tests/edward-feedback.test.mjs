/** Edward response feedback production and Lab integration seams. */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("student and staff response controls submit the exact message and trace", async () => {
  const [control, student, staff, client] = await Promise.all([
    source("../app/components/edward-response-feedback.tsx"),
    source("../app/components/edward-assistant.tsx"),
    source("../app/components/staff-edward-assistant.tsx"),
    source("../app/lib/api-client.ts"),
  ]);

  assert.match(control, /assistantMessageId: string/);
  assert.match(control, /traceId: string/);
  assert.match(control, /traceId: target\.traceId/);
  assert.match(control, /chooseRating\("positive"\)/);
  assert.match(control, /chooseRating\("negative"\)/);
  assert.match(control, /writtenFeedback: normalized/);
  assert.match(control, /Thanks for the feedback\./);

  for (const [kind, chat] of [
    ["student", student],
    ["staff", staff],
  ]) {
    assert.match(chat, /<EdwardResponseFeedback/);
    assert.match(chat, new RegExp(`assistantKind: "${kind}"`));
    assert.match(chat, /assistantMessageId: message\.id/);
    assert.match(chat, /traceId: message\.traceId/);
    assert.match(chat, /traceId: response\.requestId|response\.requestId \? \{ traceId/);
  }

  assert.match(
    client,
    /\/v1\/student\/assistant\/messages\/\$\{encodeURIComponent\(assistantMessageId\)\}\/feedback/,
  );
  assert.match(
    client,
    /\/v1\/staff\/assistant\/messages\/\$\{encodeURIComponent\(assistantMessageId\)\}\/feedback/,
  );
  assert.equal((client.match(/method: "PATCH"/g) ?? []).length >= 2, true);
});

test("the Staff Edward page uses the durable production assistant", async () => {
  const portal = await source("../app/staff/staff-portal.tsx");
  assert.match(portal, /<StaffEdwardAssistant staffName=\{staffName\} variant="embedded"/);
  assert.doesNotMatch(portal, /previewStaffEdward/);
  assert.match(portal, /view !== "edward"/);
});

test("both Labs expose their own feedback and reuse the exact trace inspector", async () => {
  const [studentLab, staffLab, feedbackLab, proxy] = await Promise.all([
    source("../app/components/edward-lab.tsx"),
    source("../app/components/staff-edward-lab.tsx"),
    source("../app/components/edward-feedback-lab.tsx"),
    source("../app/api/edward-lab/feedback/route.ts"),
  ]);

  assert.match(studentLab, /User Feedback/);
  assert.match(studentLab, /<EdwardFeedbackLab assistantKind="student"/);
  assert.match(staffLab, /User Feedback/);
  assert.match(staffLab, /<EdwardFeedbackLab assistantKind="staff"/);

  assert.match(feedbackLab, /selected\.traceId/);
  assert.match(feedbackLab, /fetchTraceWithRetry/);
  assert.match(feedbackLab, /<EdwardTraceInspector trace=\{trace\}/);
  for (const label of ["Question", "Edward response", "Written feedback"]) {
    assert.ok(feedbackLab.includes(label), `feedback detail must show ${label}`);
  }
  assert.match(proxy, /\/internal\/assistant\/feedback/);
  assert.match(proxy, /ASSISTANT_KINDS/);
  assert.match(proxy, /RATINGS/);
});
