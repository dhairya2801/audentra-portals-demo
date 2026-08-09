# Functional content management — portals

## Campus Life

- Added a student registration action tied to the event version currently on
  screen and protected by an idempotency key.
- Added pending, registered, retry, stale, unavailable, and already-registered
  handling without optimistic records that could diverge from the platform.
- Kept content refresh-driven: staff edits do not silently replace an open
  student page, while existing realtime notification counters announce material
  changes and cancellations.
- A retired event disappears after the next read; its notification remains
  available to explain what happened to the student's prior registration.

## Classrooms

- Added optional featured-video fields to the staff course editor.
- Added URL validation and a clear action so media can remain null.
- Rendered approved videos or playlists through `youtube-nocookie.com` in the
  student course-detail view with title, description, source, and an accessible
  external YouTube link.
- Kept the course experience informational: there is no student-side enroll or
  add-course mutation.

## Staff content workspaces

- Event, club, course, Knowledge Base, and Core Play pages consume platform-backed
  records and retain explicit save/publish interactions.
- Knowledge Base and Core Play records are durable content only. Future LLM
  retrieval is intentionally outside this release.

## Enrollment and onboarding boundary

- No journey behavior was changed. The existing builder already provides a
  dependency map, cycle-aware prerequisites, ordered steps, required/active
  flags, and controlled task types for approval, forms, single/multiple select,
  file upload, signature, payment, information, structured selection, and
  scheduling.
- Form steps expose short text, email, phone, date, yes/no, single-choice, and
  multiple-choice controls with a live student preview.

## Browser verification

- Registered a student for an event, changed its time/location as staff, observed
  the notification without replacing the open student page, and verified the
  new content after refresh.
- Removed a second registered event, observed its cancellation notification, and
  verified that it disappeared after refresh.
- Published updated course-video metadata, opened the student course detail, and
  verified a privacy-enhanced embed with no student mutation action.
- TypeScript checks, lint with zero errors, the production build, and all 36
  rendered/unit behavior tests pass.
