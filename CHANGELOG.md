# Changelog

This changelog summarizes user-visible releases. Detailed notes are separated
by persona so students, staff, and implementation teams can review only the
changes that affect them.

## 2026-08-10 - Live support conversations and engineering documentation

### Student and staff portals

- Replaced the disconnected support handoff with one live Help/Messages thread.
  Student replies and staff-delivered portal replies now refetch into both
  portals from the canonical platform record.
- Added explicit five-day active-conversation language and safe retry/error
  behavior. Inactive threads leave active inboxes, while protected history
  remains available to the platform for audit and recovery.

### Engineering documentation

- Kept the architecture explorer out of the staff product. The self-contained
  employee-onboarding atlas lives in the platform repository at
  `docs/architecture/audentra-system-flow-explorer.html` and documents help
  conversations, transcript recovery, Action Center enrichment, scheduled
  work, conditional journeys, and content publication.

### Deployment

- Added a portable Kubernetes web workload with standard Service, Ingress,
  HPA, PDB, NetworkPolicy, and thin GKE/EKS image overlays. It documents the
  required build-time portal/API origins for credentialed API and SSE traffic.

See [live conversation and system-map details](docs/changelog/2026-08-10-live-conversations-and-system-map.md).

## 2026-08-10 — Action Center handoff and recovery refinements

### Staff experience

- Replaced the ambiguous header overflow control with an accessible AI-refresh
  icon and made **Mark complete** persist the canonical interaction or work-item
  outcome.
- Kept source communication, call recordings, transcript revisions, official
  outcome controls, advisory AI summaries, conversation signals, related
  uploaded files, and history in distinct Action Center sections.
- Made portal-channel outreach create a real student inbox delivery and show
  the canonical delivery state after the API responds.

### Student experience

- Requirement upload and help flows now preserve the original file, surface
  parse/retry/review states clearly, and keep the linked task visible as staff
  work progresses.
- Enrollment and onboarding updates are grouped and deferred as one portal-visit
  decision instead of interrupting route navigation with a chain of dialogs.

See [Action Center handoff and recovery details](docs/changelog/2026-08-10-action-center-handoff-and-recovery.md).

## 2026-08-10 — Calm, grouped student updates

### Student portal

- Enrollment and onboarding updates now appear together once per portal visit,
  rather than reopening as the student moves between routes.
- **Remind me later** saves the full displayed bundle; incoming realtime
  changes refresh canonical portal state without creating a new blocking dialog
  during an active visit.
- Returning after five minutes away from the visible portal is treated as a
  new visit and may present the current canonical bundle again.

## 2026-08-10 — Graph-first enrollment and onboarding studio

### Staff journey design

- Replaced the dense journey editor with a draggable, zoomable workflow canvas
  with connection ports, dependency arrows, deterministic layout
  simplification, explicit layout saving, and focused enrollment/onboarding
  views.
- Added executable Yes/No, switch/default, multi-value case, and numeric
  threshold paths with labeled conditional edges, all/any matching,
  skipped-branch semantics, and safe path convergence.
- Added a compact map/list switch and focused each map on the selected journey
  plus only the external prerequisites needed to understand it.
- Reorganized step editing into Details, Student experience, Dependencies, and
  Publishing sections while preserving stable IDs and versioned publication.
- Added nine append-only journey scaffolds, including decision-based and
  readiness-score onboarding examples with switch/default and threshold paths,
  plus international, transfer, support-first, enrollment-essential,
  comprehensive multi-office, financial-aid, and document-recovery flows.
  Staff can preview dependencies and attach entry nodes before publishing.

### Student form design

- Added multi-page form authoring with a page outline, visual field palette,
  accessible ordering and duplication controls, stable page/field keys, and a
  live student-portal preview.
- Added bounded numeric fields with minimum, maximum, and step controls for
  scoring, placement, eligibility, and other threshold-driven journeys.
- Added five editable form scaffolds for profile/contact, support intake,
  orientation preferences, emergency contacts, and simple confirmation.
- Added native page-by-page validation and state preservation in the student
  runtime, with one canonical submission after the final page.
- Kept built-in onboarding screens protected while allowing staff to edit their
  student-facing language, ownership, rewards, and configured fields.

### Realtime staff updates

- Replaced the generic "new inquiry" banner with event-specific notices for
  inquiries, replies, parsing review, recovered documents, follow-ups, blocked
  reviews, SLA escalation, new work, and background AI guidance refreshes.
- Scheduled lifecycle changes now emit their realtime notice immediately; a
  later AI enrichment is identified separately instead of looking like a replay
  of the original student request.

See [Detailed journey-builder changelog](docs/changelog/2026-08-10-journey-builder-ux.md).

## 2026-08-10 — Durable tenant content management

### Campus Life

- Added database-backed student event registration with pending, registered,
  stale, unavailable, and retry states.
- Added realtime notification visibility for material event changes and
  cancellations while keeping page content refresh-driven.

### Classrooms

- Added optional staff-curated course-video fields and privacy-enhanced YouTube
  embeds in student course details.
- Kept courses informational with no browser-only enrollment action.

### Staff content workspaces

- Connected event, club, course, Knowledge Base, and Core Play editors to
  durable platform CRUD and preserved explicit review-and-publish behavior.

See [Detailed content-management changelog](docs/changelog/2026-08-10-content-management-functional.md).

## 2026-08-09 — Functional enrollment action center

### Students

- Added requirement-scoped help requests and a visible `Help requested` state.
- Fixed document selection and submission so persisted failed files are not
  mistaken for newly selected files.
- Added clear transcript retry, parsing, and successful-review states without
  losing access to the original upload.

### Staff

- Added Jira-style task creation, priority sorting, advanced filters, and modal
  work-item details.
- Redesigned the Enrollment Action Center around Overview, Next Step, Outcomes,
  Comments, and History with tenant-aware visual theming.
- Added realtime inquiry and action notifications with reconnect and fallback
  refresh behavior.

### Student home

- Reordered Campus Life, Enrollment, Financials, Classrooms, and Calendar into
  the agreed dashboard hierarchy and removed duplicate Campus Life content.

See [Detailed Action Center changelog](docs/changelog/2026-08-09-action-center-functional.md).

## 2026-07-31 — Student experience and staff operations

### Student users

- Expanded onboarding into a complete, resumable enrollment-intake flow with
  housing and roommate preferences, support interests, emergency contacts,
  family permissions, review, signature, and deposit planning.
- Added clearer enrollment progress and optional follow-up summaries.
- Redesigned Financials with an accessible cost-coverage visualization,
  clearer balance context, aid sources, and required-document actions.
- Added Campus Life search and category filters.
- Added Edward voice input and optional spoken replies on supported browsers.
- Improved small-text readability and responsive behavior across portal pages.
- Connected staff document decisions, published content, and notifications to
  the same student-facing records used by the portal.

See [Detailed student changelog](docs/changelog/2026-07-31-student-experience.md).

### Staff users

- Added authenticated staff operations routes for each tenant.
- Added Today, Action Center, shared Task Board, Students, Messages, Journeys,
  Campus Life, Academics, Knowledge Base, Core Plays, and Edward workspaces.
- Added a Jira-style task board with drag-and-drop status changes, assignment,
  prioritization, escalation, student context, and append-only activity.
- Added a personal Action Center with prioritized students, risk evidence,
  recommended actions, and communication history.
- Added structured journey, event, club, and course editing. Raw YAML remains an
  internal versioned persistence format and is no longer shown to staff.
- Added Edward-assisted configuration drafts with explicit review and publish
  confirmation.
- Added a deterministic 400-student local cohort for workflow and scale testing.
- Improved task-board sizing, scrolling, responsive behavior, and journey-label
  wrapping at desktop and mobile breakpoints.

See [Detailed staff changelog](docs/changelog/2026-07-31-staff-operations.md).

### Engineering and operations

- Added shared staff contracts, staff API routes, PostgreSQL migration
  `0018_staff_action_center.sql`, audit/outbox integration, local credential
  authentication, and durable preview-state upgrades.
- Added tenant-owned journey, Campus Life, and academic configuration documents.
- Added lifecycle-safe detached portal commands that avoid nested npm process
  trees on Windows.
- Added student/staff architecture, sequence diagrams, state-freshness guidance,
  production boundaries, and an implementation runbook.
- Expanded rendered web, API, state-store, and portal lifecycle coverage.

See [Staff portal implementation and operations](docs/24-staff-portal-implementation-and-operations.md).
