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
