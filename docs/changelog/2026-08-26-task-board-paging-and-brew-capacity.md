# 2026-08-26 — Task board pages the server; Morning Brew gets people & capacity

Companion to the platform change of the same date (bounded
`GET /v1/staff/action-center`, `staffCapacity` in the Morning Brew). Contract
snapshot synced.

## Task board

- Reads `/v1/staff/action-center` with the toolbar mapped onto the server query
  (`buildActionCenterQuery` / `actionCenterQueryToParams` in
  `task-board-utils.ts`); search debounced 300 ms. Pages of 100 with **Load
  more**; only loaded items are rendered, grouped by status in one pass;
  "Showing X of total". Column headers show board-wide counts.
- Default is open work (four columns); closed columns appear for `closed` /
  `all` / a closed status. New toggles **Stale** and **Owner unavailable**, a
  **Sort** select, assignee/component selects from the server facets (people
  on leave / departed / away are labelled).
- Cards show `signals` badges: Overdue *N*d, Stale *N*d, Owner departed / on
  leave until … / away until …, Unassigned.
- After a drag-drop, task creation or a detail change the loaded range is
  re-read from the server; the 10 s workspace poll only triggers a silent
  reload when the board's `generatedAt` changed.
- `openTaskBoard(query)` deep link: Morning Brew priorities, capacity signals
  and office rows open the board pre-filtered.
- The student directory no longer computes per-student open-item counts from
  a partial page; the record links to the board filtered by the student.

## Morning Brew

- "People & capacity" section: summary line (staff · on leave · departed ·
  away today · over cap · falling behind · spare capacity · items owned by
  someone unavailable · unassigned · stale), up to ten ranked signals with
  severity, detail, action and a board link, and a compact offices table.
- Priorities with `boardQuery` navigate to the filtered board.
- Coverage note when `engagementScan.activitySignal` is false.

## Tests

`tests/staff-task-board.test.mjs` and `tests/morning-brew.test.mjs` cover the
query serializer, deep-link inverse, column grouping, owner badges, the
capacity mapping and the priority deep links.
