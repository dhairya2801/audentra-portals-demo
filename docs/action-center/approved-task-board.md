# Approved Task Board integration

The staff Task Board tab displays the exact approved `tmp_actioncenter` prototype
at commit `9593ee09a36537ccdd04a558a4ff7f26e52a1c9a`. HTML, CSS, ES modules, fonts,
icons and seed data are vendored unchanged in `apps/web/public/action-center-approved`.
`source-manifest.json` records SHA-256 hashes, checked by the Node integration test.
Meeting attachments, screenshots and prototype development dependencies are excluded.

`ApprovedTaskBoard` uses a full-viewport same-origin iframe so portal global CSS,
font metrics and containing blocks cannot alter the approved board or native dialogs.
The existing staff route still performs authentication and loads its canonical
workspace. No new route, backend endpoint, dependency or authentication shortcut
is introduced. The approved prototype already includes the surrounding Audentra
shell, so the host does not render a second shell or Edward overlay around it.

`portal-bridge.js` is the only runtime adapter. It connects existing surrounding
navigation to staff views and makes copied task links reopen the authenticated
staff route (`?actionTask=ENR-184#tasks`). Messages are checked for both origin and
iframe source. Prototype board/detail/assignment/workflow interactions are untouched.
Explicit canonical work-item links from other portal pages keep their previous
backend-backed detail handler; the normal Task Board tab always shows the approved UI.

The approved board remains a UI demo: seeded people, extraction, decisions,
communications, payment entries and automation are local mock state, persisted in
the prototype's existing browser-local storage. None write canonical platform data.
Board query links from Morning Brew open the approved default board; backend query
criteria are not mapped onto unrelated mock records. Reset demo restores the seed.

## Validation

Run `node --test apps/web/tests/approved-task-board.test.mjs` for asset integrity and
route isolation. The connected browser journey is
`tools/browser-e2e/specs/approved-task-board.spec.ts`; use `E2E_BASE_URL` to select a
running local or deployed portal. It signs in through the visible demo login,
opens Task Board, completes mock review and request flows and returns to the portal.
This is mock integration acceptance, not proof of backend processing or delivery.

The normal desktop comparison uses 1440×900 and 1920×1080 viewports. The adapter
temporarily removes the host page's scrollbar and reserved gutter while mounted,
then restores them on exit. Without this, the otherwise unchanged board is ten
pixels narrower than its approved source.
