# Action Center handoff and recovery refinements

Date: 2026-08-10

## Staff-facing workflow

- The Action Center header now has one direct completion action and a compact
  refresh icon for queued AI refreshes. Completion either records the active
  interaction outcome or updates the work item when no interaction exists.
- Overview, Next Step, Outcomes, Comments, and History remain separate views.
  This keeps task guidance, channel selection, raw evidence, confirmed CRM
  outcome fields, advisory intelligence, and audit history distinct.
- Next Step starts an interaction only when needed. Recording an outbound portal
  message sends it through the platform, then renders the returned canonical
  delivery state and timeline rather than assuming delivery in the browser.
- Outcomes show source communication, revision-safe call transcription, the
  AI outcome summary, conversation signals, and staff-confirmed completion or
  follow-up controls. Related records are restricted to student-uploaded files.

## Student and staff handoff

- Requirement upload pages retain selected-file state separately from stored
  failed files, preventing an existing parser failure from being submitted as a
  new upload by mistake.
- Student help requests and subsequent replies are surfaced to staff through
  the durable realtime notice and canonical workspace refresh paths.
- Student inbox data refreshes from SSE invalidations with polling and focus as
  recovery. The displayed message record remains API-owned.

## Update-dialog behavior

- Eligible enrollment/onboarding updates are gathered into one accessible
  dialog at the beginning of a portal visit. Browser route navigation and
  realtime refreshes do not show another dialog.
- Deferring a bundle is a single API operation. If any record is stale or
  rejected, the portal keeps the bundle visible rather than partially saving a
  reminder decision.
- Returning to a visible portal after five minutes inactive starts a new visit;
  closing/reopening a browser tab naturally starts a new browser-session visit.

## Scope boundary

- The current portal can confirm delivery only for the internal portal channel.
  Email and voice communications are recorded as evidence until a future
  provider adapter reports a durable external delivery result.
