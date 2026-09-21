# Camila: connected task-board activity and document decisions

Camila's 64-card demonstration now reads canonical student identities, stored originals,
requirements, review decisions, conversation threads and staff activity. The same seven
boards and original stylesheet remain in use. Field extraction, comparison values,
workflow controls, payment settlement and other workspaces remain previews.

- Staff can send portal messages from every card's Activity tab and the outreach workspace.
  Request guidance also sends through this connection. Ada replies through Help.
- Internal comments persist as staff work logs and never enter student deliveries.
- Approve and Request changes require explicit original-document review and a student note.
  Rejection uses the tenant's reason options. The student requirement shows that note.
- Requirement resubmissions reuse their card, retain previous originals, and reset the
  document review. Older originals remain downloadable. Stale decisions are rejected.
- Retries retain a request receipt across version refreshes after an uncertain response.
  Failed messages retain drafts. A confirmed save is not reported as failed if refresh fails.
- Five-day conversation expiry is explicit. Starting a new conversation preserves the old
  thread. Realtime invalidation, ten-second polling and focus refresh read canonical state.

The local backend seed adds stored demonstration PDFs and shared conversations for the
other managed students. Existing uploads and completed evidence are preserved; repeat
seeding preserves subsequent user activity. No parser/provider is invoked by these actions.

Validation: frontend lint/type-check/build and 141 tests; isolated Postgres checks for
scope, privacy, expiry, idempotency and card reuse; browser checks for both participants,
failed/lost responses, original rendering, request changes, replacement, duplicate decisions
and explicit approval confirmation. Commands are in `tools/university-explorer/camila-demo-connected.mjs`
and `camila-demo-approval.mjs` and require an explicitly isolated runtime.

Final verification: 1,438 API tests passed with the two Camila database suites enabled;
160 unrelated integration cases require additional services and were skipped. Global API
coverage is 62.67%, below the existing 67% gate. Node package tests passed separately.
All 141 frontend tests pass, along with lint, type-checking, build, the isolated browser
journeys and the interactive portal smoke check. The original task-board CSS remains unchanged.
