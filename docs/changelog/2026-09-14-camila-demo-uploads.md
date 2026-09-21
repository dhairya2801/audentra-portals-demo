# Camila demo: original uploads

Ada's student-portal uploads now appear on Camila's task board after object storage confirms the original. The starting board still contains 64 cards. A submission fills an unused document slot for that student and board; when those slots run out, it creates another card. Financial-aid uploads enter Financial Aid; other documents enter Enrollment. Repeated requests reuse the document/card, and replacement submissions for the same requirement retain the card and earlier original files.

The card reads the student's identity, original filename, upload timestamp, size, MIME type, work-item creation timestamp and document IDs from PostgreSQL. PDFs render with the pinned PDF.js dependency inside the existing document pane, including real page counts, navigation and zoom. Images display the uploaded image. Download retrieves the exact stored bytes. The original CSS remains unchanged. The board refetches on invalidation/focus and every ten seconds, preserving open tabs and local review drafts; it defers refreshing while an input or action dialog is active.

Parsing, field comparisons, approvals, correction messages, workflow controls and the other tabs remain simulated. These uploads are stored as `manual_review` / `under_review` with no extraction results or parser job. Review controls cannot mutate their real document decisions. Existing completed/waived requirements are preserved. Unlinked mock cards keep their sample documents until a real upload fills them. Earlier originals are retained and exposed in the board API; the document pane displays the latest upload.

Use the student's Profile → Documents → “Send Aster a document” flow for an additional upload. No accepted requirement needs to be reset.

## Runtime and deployment

Apply platform migration `0078_staff_demo_documents.sql` after the step-1 seed/migration, then restart the API. The existing restricted demo launcher and ten-student assignment are unchanged. Other students without a configured demo adviser board retain the standard processing path.

`npm install` installs the exact PDF.js version. The existing dev/build/start wrapper runs `scripts/prepare-document-viewer.mjs` to copy its browser worker, fonts and supporting assets into the ignored `public/document-viewer` directory before serving or building. No public CDN or external document-rendering service is used.

## Validation

- Isolated PostgreSQL checks cover storage reservation versus attachment, idempotency, assignment/actor scope, requirement resubmission, original retention, completed requirement preservation, slot exhaustion, financial routing, worker/lazy reconciliation, and absence of extraction jobs.
- The focused backend run passes 67 tests; the new document/board repositories have 95.9% combined coverage.
- `camila-demo-uploads.mjs` exercises the student upload UI against a disposable database: automatic staff refresh, visibly rendered multipage PDF, page/zoom controls, download byte equality, actual image rendering, expanded view, file failure/retry, and mock review isolation. It requires explicit `CAMILA_UPLOAD_TESTS=1` and an isolated `PORTAL_BASE`; it rejects interactive demo port 3009.
- Frontend lint, typecheck, production build and 137 tests pass. Backend lint/typecheck and Node tests pass. Full backend Python execution passes all 1,424 tests at the first full run, with 161 environment-dependent skips; the global coverage gate remains below 67% (62.3%). The subsequently added storage-routing test case passes in the focused run.

All mutating integration/browser checks used disposable databases. The interactive demo's 64 seeded cards and existing student documents were preserved.

## Pending checklist upload

The local demo now also seeds **Upload updated transcript** for Ada through
`platform/tools/university/seed_ada_upload_request.py`. It appears under documents
that still need attention and opens the normal requirement upload form at
`/enrollment/requirements/ada-updated-transcript` (choose a file, then **Send to
Aster**). Existing accepted originals and existing requirement states are retained.
Setup retains 64 staff cards; uploading fills Ada's available document slot.
The scenario addition is repeat-safe and never resets a submitted request.

Verified the pending entry and requirement upload in the isolated browser runtime:
submission links to the new requirement, reaches Camila's board, enters staff
review without extraction, and preserves all previously accepted documents.
