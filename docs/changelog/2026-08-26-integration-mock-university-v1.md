# 2026-08-26 — integration/mock-university-v1: the bounded backend under the finalized design

Merges `feat/mock-university-ops` (task board pages the bounded
`GET /v1/staff/action-center`; Morning Brew people & capacity) on top of the
staff/advising portal in `main`. `feat/staff-edward-v2` had no portal
changes. The rule for this pass: functional improvements from the better
backend, no redesign of Morning Brew, the Action Center, navigation or the
visual language.

## Kept from the ops branch

- Task board reads pages of 100 from the server with **Load more** and
  "Showing X of N"; the toolbar maps onto the server query (search debounced
  300 ms); column headers show board-wide counts.
- Default view is **open work** (four columns). "Closed work" / "All
  statuses" / a closed status reveal the Done and Cancelled columns.
- **Sort** select (priority, due, updated, created, longest untouched).
- Assignee and Team options are annotated with open counts and, for people
  on leave / departed / away, their availability.
- Compact per-card signal badges: Overdue *N*d, Stale *N*d, Owner
  departed / on leave until … / away until …, Unassigned.
- Deep links: Morning Brew priorities, capacity signals and office rows, and
  the student record's "Open every task … on the board" open the board
  pre-filtered (`openTaskBoard(query)`).
- Morning Brew **People & capacity** section (summary line, ranked signals,
  offices table) in the existing brew panel styling; the engagement
  coverage note.
- The student directory shows `completed/total checklist` instead of an
  open-item count that was computed from a partial page.

## Changed to preserve the existing design

- The ops branch replaced the original **Task type** filter (Enrollment /
  Document review / Communication) with nothing. It is back, now served by
  the API's `workType` parameter.
- The ops branch added a separate strip of pill toggles ("Stale · N",
  "Owner unavailable · N", overdue/unassigned counters) under the filter
  grid. That strip is gone; the two filters are one **Signals** select
  inside the existing filter grid (Any / Stale / Owner unavailable), so the
  board keeps its original toolbar shape. The counters it showed are already
  on the column headers and in Morning Brew.

## Also

- `appointments/page.tsx` used `Intl.DateTimeFormat("en-US", …)` for the
  adviser's next open time; it now uses `formatTenantDate` like every other
  student page (this was failing `rendered-html.test.mjs` on `main`).
- `apps/web/.env.integration.example` — the portal settings for testing
  against the integration API on :4300.
- Contract snapshot synced with the platform (`StaffActionCenterQuery`
  gains `actionType`, `workType`, `studentId`, `inProgressDays`).
