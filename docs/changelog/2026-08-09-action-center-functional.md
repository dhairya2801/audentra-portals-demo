# Functional Enrollment Action Center — portals

## Student experience

- Every enrollment requirement can open a help request linked to that exact
  item, with the requirement changing to `Help requested` after submission.
- Document upload now has one unambiguous `Submit files` action and does not
  treat previously stored failed documents as a new selection.
- Transcript pages distinguish uploading, parsing, review-required, retrying,
  parsed, and review-ready states while preserving the original file.
- Student messages and notification counts update from staff outreach without a
  manual page refresh.

## Staff work management

- Added task creation with student, task type, team, assignee, priority, status,
  and due date.
- Added ownership, component, type, priority, status, and due-date filters.
- Added deterministic priority/due-date sorting and Jira-style modal work-item
  inspection instead of a permanently docked inspector.
- Redesigned Action Center detail into Overview, Next Step, Outcomes, Comments,
  and History, including channel guidance, AI insight state, transcript state,
  disposition, follow-up actions, student context, and SLA information.

## Realtime and recovery UX

- Added a cursor-aware fetch-based SSE client compatible with credentialed
  tenant headers.
- Added global staff notification banners and action links for new inquiries and
  document interventions.
- Added reconnect behavior and bounded polling/focus fallback.
- Added non-destructive stale-update messaging so staff decides when to refresh
  an open detail view.

## Dashboard alignment

- Moved Campus Life immediately below the welcome context.
- Grouped Enrollment, Financials, and Classrooms beside a height-matched student
  calendar and removed the duplicate Campus Life summary card.

## Verification

- Type checking, linting, 36 rendered/unit behavior tests, and the production
  Next.js build pass.
- Browser validation covered the complete student-to-staff-to-student flow,
  including realtime notification counts and staff resolution history.
