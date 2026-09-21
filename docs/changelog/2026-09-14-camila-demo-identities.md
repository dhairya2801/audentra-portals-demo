# Camila demo — step 1: real identities

The demo now signs in only as Camila Abernathy (`AU-55ff7e408818`) or Ada Kettleby
(`SYN-000061`). Camila's existing nine advisees plus Ada supply the ten-student
roster. Previous staff records and adviser history remain intact.

The task board keeps the deployed mock's styling, seven boards, 64 starting
cards, column distribution, document specimens and workflow tabs. Its cards
now load from `/v1/staff/demo-task-board` through the portal API client. Each
card has a real `staff_work_item` ID and student relationship. Names, student
references, program, intake, email and Camila's identity come from the backend.
The related-work panel groups cards by their actual student identity.

The endpoint returns only the signed-in staff member's configured demo cards
whose students still belong to that adviser. A separate membership table stores
template keys and order; it does not store parser results or fake domain evidence.
This is a curated board; older university work items are preserved outside it.

Only the identity read is enabled across the iframe boundary. Document uploads,
document metadata, parsing, review decisions, messages, payments and workflow
commands are still mock in this step. The footer identifies that boundary.
Simulated edits use a separate, scenario/staff-scoped browser storage key.
Reload always restores backend identities over saved previews. Reset clears
simulation state without touching backend work or student records. A failed
identity read shows Retry, never fallback fake students.

Run the backend migration and `tools/university/seed_camila_task_board.py` once
as described in the platform runbook. The seed is transactional, uses stable
IDs and a version marker, and preserves subsequent changes when run again.
Start the API with `tools/university/run_demo_excellence.py` for the restricted
demo; the general university runtime remains available for broad development.

Validation:

```sh
node tools/university-explorer/camila-demo-identities.mjs
npm run typecheck
npm run lint
npm test
```

The browser check covers all 64 visible card identities, backend IDs, all seven
boards, mobile, detail tabs, login restrictions, simulated-write isolation,
stale cache rehydration, reset and load failure/retry. Artifacts are under
`artifacts/demo-task-board-parity/identities/`.

The earlier `demo-task-board-parity.mjs` and source hashes document the frozen
mock before identity integration. They are not the acceptance test for this
step's deliberately changed names. The stylesheet still matches the deployment
byte for byte. Original source hashes are retained as provenance.

Next step: actual uploaded files and upload-driven task creation/update. No
document or conversation link is invented by the identity seed.

Validation results: browser regression passed; 137 portal tests and the production
build passed; portal/platform lint and typecheck passed. The isolated PostgreSQL
regression passed with 100% coverage of the new projection. All 1,424 backend
tests and the Node suites passed, but the full backend test command failed its
repository coverage gate (62.37% versus 67%); 161 integration/configuration-dependent
tests were skipped. The coverage threshold was not changed.
