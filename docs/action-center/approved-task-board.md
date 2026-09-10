# Approved Task Board integration

The staff Task Board tab uses the approved `tmp_actioncenter` workspace at commit
`9593ee09a36537ccdd04a558a4ff7f26e52a1c9a`. Its HTML, CSS, ES modules, fonts, icons,
seed data, review tables and workflows remain unchanged in
`apps/web/public/action-center-approved`. `source-manifest.json` records the
SHA-256 hashes checked by the integration test.

The original staff top bar and entire sidebar stay in place. Selecting Task board
reveals Financial Aid, Enrollment and Campus Life projects directly beneath that
item. Their counts and selected board are published by `portal-bridge.js` from
the approved mock's own data. Switching projects uses its existing `switchBoard`.
Student 360 remains a separate primary staff navigation destination.

`ApprovedTaskBoard` isolates the workspace from portal global CSS. Its adapter hides
only the prototype's duplicate shell. Task dialogs expand the iframe to the full
viewport, preserving their document preview, review table, context and workflow
layout. Closing a dialog restores the board alongside the original staff sidebar.
The host's scroll settings are restored when leaving Task Board.

Messages are checked for origin and iframe source. Copied links reopen the existing
authenticated staff route (`?actionTask=ENR-184#tasks`). Explicit canonical work-item
links retain the previous backend-backed detail handler. No backend behavior or
new authentication path is introduced.

The board remains a UI demo: extraction, decisions, communications, payments and
automation use seeded records and browser-local persistence. Reset demo restores
the seed. Backend query criteria from other views are not applied to unrelated
mock records. Student 360 retains its existing canonical reads and demo fallbacks.

Run `node --test apps/web/tests/approved-task-board.test.mjs` for asset integrity
and route checks. The connected browser journey is
`tools/browser-e2e/specs/approved-task-board.spec.ts`; select a running portal with
`E2E_BASE_URL`. It uses visible staff demo sign-in and covers the original sidebar,
project navigation, review decisions, request automation, Student 360, persistence,
and real copied task links. This validates the mock integration, not backend
processing or communication delivery.
