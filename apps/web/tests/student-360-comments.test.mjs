import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/staff/student-360.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/staff/student-360-comments.module.css", import.meta.url), "utf8");

test("comments and portal messages are separate Student 360 workspaces", () => {
  assert.match(source, /Internal comments/);
  assert.match(source, /function MessagesPanel/);
  assert.match(source, /Student portal conversation/);
  assert.match(source, /Portal messaging/);
  assert.match(source, /getStaffInquiryThread/);
  assert.match(source, /updateStaffInquiry/);
  assert.match(source, /notifyStudent:\s*true/);
  assert.match(source, /Synced with the student portal conversation/);
  assert.doesNotMatch(source, /Prototype thread/);
  assert.doesNotMatch(source, /I uploaded my housing preferences/);
  assert.doesNotMatch(source, /Comments & messages/);
});

test("comments supports team and visibility controls with a sticky composer", () => {
  assert.match(source, /All teams/);
  assert.match(source, /My team/);
  assert.match(source, /Authorized staff/);
  assert.match(source, /Staff collaboration record/);
  assert.doesNotMatch(source, /Staff \+ student/);
  assert.match(styles, /position:\s*sticky/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 1\.55fr\)/);
  assert.match(styles, /\.messagesWorkspace/);
  assert.match(styles, /\.messageThread/);
});
