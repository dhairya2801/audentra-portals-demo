# Audentra Portals contributor guide

This repository is the active Next.js frontend for student and staff portals.
Backend persistence, migrations, workers, provider credentials, and authorization
belong in the sibling `Audentra-platform` repository.

## Repository boundaries

- Consume the platform through `apps/web/app/lib/api-client.ts`; do not recreate
  backend business rules or persistence in browser state.
- Keep `packages/contracts` synchronized with the canonical platform snapshot.
- Every request must retain credentialed HTTP and the active tenant header.
- Never expose server API keys, model credentials, student files, or sensitive
  backend errors through `NEXT_PUBLIC_*`, browser logs, fixtures, or screenshots.

## State and interaction rules

- Treat API data as canonical. Optimistic UI must reconcile versions and retain
  user input when the server reports a conflict.
- Realtime events invalidate affected resources; reconnect with a cursor and keep
  a bounded polling/focus fallback. Never treat an SSE payload as the record.
- Long-running AI, parsing, and transcription states need explicit pending,
  retry, failure, and stale-update UX.
- Preserve tenant theming while keeping structure, typography, accessibility,
  and interaction behavior consistent across institutions.
- Student-facing content must be fetched from the platform on navigation or
  refresh. Content authoring stays deterministic and does not trigger LLM work.

## Managed-content interaction rules

- A staff publication writes canonical platform data. A student who already has
  the page open keeps the rendered snapshot until navigation or refresh; realtime
  notifications may announce material changes but must not silently replace the
  page beneath them.
- Send an idempotency key and the rendered event version when registering for a
  Campus Life event. Treat already-registered responses as success, surface
  stale/inactive/past-event conflicts, and disable duplicate submission while a
  request is pending.
- A cancelled or retired event disappears after the next canonical read. Keep
  its student notification/history accessible even though the event card is no
  longer rendered.
- Classrooms are informational. Do not add browser-only enroll/add-course state.
  Render optional approved YouTube media through privacy-enhanced
  `youtube-nocookie.com` embeds with an accessible external-link fallback.
- Keep staff Knowledge Base, Core Play, club, event, and course editors backed by
  platform CRUD. Do not persist published content only in React state.
- Enrollment and onboarding remain a distinct graph-aware form builder with a
  controlled input palette. Do not fold journey steps into generic content CRUD
  or mutate completed student work from the editor.

## Validation

Run the relevant subset while developing and all gates before handoff:

```text
npm run typecheck
npm run lint
npm test
npm run build
```

Use the browser journey suite for authentication, uploads, realtime state,
student/staff handoffs, and backend-driven content changes.
