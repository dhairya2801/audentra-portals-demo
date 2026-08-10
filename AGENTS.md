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
- Student experience-update dialogs are portal-visit scoped: aggregate all
  eligible enrollment/onboarding updates into one accessible dialog, never
  re-open it during route navigation or active-session realtime refreshes, and
  defer the displayed bundle atomically. A new browser visit or a return after
  five minutes inactive may present current canonical updates again.
- Long-running AI, parsing, and transcription states need explicit pending,
  retry, failure, and stale-update UX.
- Action Center communications must display the API's returned canonical work
  item. Only an outbound `portal` communication is a confirmed student inbox
  delivery in the current implementation; do not present recorded external
  email or voice activity as externally delivered until an approved provider
  adapter confirms it.
- EAC summaries are advisory revisions. Always keep raw communication and
  document evidence visible, label pending or stale coverage, and let staff
  record the authoritative CRM outcome separately.
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

## Journey-builder interaction rules

- Treat the workflow map as an orientation and selection surface over canonical
  prerequisite data, not as browser-owned workflow persistence.
- Keep onboarding and enrollment separate. A map may include recursive
  cross-journey prerequisites, but must not render every tenant step as one
  undifferentiated graph.
- Preserve the map/list pair: the map explains stages and branching, while the
  list provides deterministic ordering and accessible move controls.
- Canvas coordinates are authoring metadata only. Keep prerequisite IDs as the
  canonical graph, publish connections immediately with an expected version,
  and publish dragged coordinates only after the staff member chooses Save
  layout.
- Conditional edges are canonical target-side `activation` rules, not canvas
  decoration. A condition must point to one of the target's selected
  prerequisites and one of that source's checkbox, required selection, or
  bounded number fields. Preserve explicit switch cases (`equals`, `one_of`),
  default paths (`none_of`), and numeric threshold comparisons; render each
  condition on the edge and keep it editable from the target node.
- `Simplify layout` is deterministic authoring assistance, not a graph rewrite.
  Rank nodes with longest-path layering, perform alternating barycenter sweeps
  to reduce crossings, then apply fixed spacing and independent connector lanes
  so nodes and arrows remain readable. Do not change prerequisites, activation
  rules, task IDs, or publication state while arranging coordinates.
- Explain branch semantics in the editor: a non-matching path becomes Not
  applicable, no student response or document is deleted, and a later merge can
  wait for the selected branch while safely accepting skipped alternatives.
- Built-in onboarding screens retain stable IDs and route contracts. Staff may
  edit supported content and fields but cannot delete, deactivate, or reorder
  those system screens.
- Custom steps and forms must use the controlled task/field palettes supported
  by the student runtime. Reject unknown dependencies, inactive prerequisites,
  duplicate stable keys, and dependency cycles before publication.
- Journey templates append collision-safe, editable steps in one versioned
  publication. They must never replace existing steps or rewrite completed
  student work. Preserve each template's internal dependencies and allow entry
  nodes to attach to an existing prerequisite.
- Multi-page forms use schema version `1`. The paged `form` object is canonical;
  a flattened `fields` projection remains only for backward compatibility.
  Page IDs and field IDs must be unique and stable across the whole form.
- Form templates replace only the unsaved editor draft. Staff must still review
  and explicitly publish the resulting form.
- The protected eight-screen first-time onboarding gate remains separate from
  custom onboarding actions. Custom actions use the same requirement runtime as
  enrollment after that gate is complete.
- Keep student previews derived from the same working configuration as the
  editor. Draft changes remain local until an explicit, version-checked publish.

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
