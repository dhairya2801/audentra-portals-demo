# Route and interaction coverage

The refresh uses the existing shells/primitives plus dedicated board, financial and Morning Brew presentation. The main rendered sweep covers **64 route/viewport cases**: student routes at 1440×1000 and 390×844, every staff destination at desktop, and staff Board/Brew/Student 360 at 1280×1000 and 390×844. Enrollment and financial overview were additionally captured at 1280×900 and 390×900. Sign-in and the landing page were inspected separately.

The sweep recorded no page errors, alerts or uncontained overflow. It checks route rendering and layout, not every backend mutation or every permission combination.

## Route inventory

| Existing route/view | Presentation and rendered evidence |
| --- | --- |
| `/`, `/sign-in`, `/staff` signed out | Existing entry/auth layouts, fields and demo access refined; both sign-ins captured before/after; landing captured separately. |
| `/onboarding` | Fresh-account opening failure fixed and checked live. All ten existing screen states rendered at 1440/1280/390px via read-only API replay; forms, selects, dialogs, ranking, loading/error/retry checked. Real acceptance is blocked by an expired seeded offer. See [onboarding evidence](onboarding.md). |
| `/dashboard` | Existing cards, program strip, calendar and shell; desktop/phone sweep. |
| `/enrollment` | Original purple header, refined progress/contact summary, task grouping/status/action hierarchy; desktop/laptop/phone. Sorting, drawer, requirement navigation and simulated loading/error/retry passed. |
| `/enrollment/requirements/[slug]` | Reached an actual requirement form from the existing task drawer. No submission/upload performed. |
| `/enrollment/ferpa` | Shared sections/fields/dialog presentation; desktop/phone. |
| `/appointments` | Advising information moved into the shared overlapping summary; How this works below it. Desktop/laptop/phone layout, booking drawer, How this works dialog, Escape and booking-trigger focus return checked. No booking/cancellation submitted. |
| `/classrooms` (My Degree) | Existing academic cards/requirements; desktop/phone. |
| `/health` | Existing records/statuses; desktop/phone. |
| `/housing` | Existing residence/preferences surface; desktop/phone. Assigned housing coordinator shown from the advising API; unavailable/retry and missing-assignment states checked. Email uses that coordinator’s address; existing Messages navigation preserved. |
| `/campus-life` | Existing events surface; desktop/phone. Clubs tab separately rendered. |
| `/campus-life/clubs/[clubId]` | Shared shell and existing drawer refined; Aster Chamber Singers detail route/drawer rendered at desktop and phone, with no page overflow; supplementary screenshots/results saved. |
| `/profile`, `/documents` | Existing profile/document workspace; desktop/phone. Documents redirect preserved. No profile writes. |
| `/messages`, `/help` | Existing lists, request surfaces and shared fields; desktop/phone. No messages/requests sent. |
| `/payments` | Existing payment workspace; desktop/phone. No payment submitted. |
| `/financials` | Amounts/comparisons and mobile stacking refined; desktop/laptop/phone. Breakdown dialog and Escape checked. |
| `/financials/payments`, `#timeline` | Existing payment planning/history/calendar; desktop/phone. Phone Review payments navigation checked. |
| `/financials/aid` | Existing award tables/disclosures; desktop/phone. |
| `/financials/expenses`, `#coverage` | Existing cost/coverage sections; desktop/phone. |
| `/financials/expenses/housing`, `/meals` | Existing campus catalogs; desktop/phone. |
| `/financials/expenses/simulator` | Existing Plan Studio and result panels; desktop/phone. Calculations/renderer unchanged. |
| `/staff#morning_brew` | Existing brief, setup/customization and detail surfaces; desktop/laptop/phone. Metric/insight/meeting/email dialogs, Escape/focus return and customize cancel/save checked. |
| `/staff#tasks` | Existing board/list, all seven boards, filters and task details; desktop/laptop/phone. Native drag/drop checked on browser-local outreach preview with local state restored. |
| `/staff#students` | Directory, selected record, Student 360 summaries and record panels; desktop/laptop/phone. |
| `/staff#profile`, `#overview` | Existing profile/operational panels; desktop. |
| `/staff#messages`, `#journeys` | Existing message workspace and journey surface; desktop. No sends or workflow edits. |
| `/staff#knowledge`, `#core_plays` | Existing managed-content workspaces; desktop. No publication. |
| `/staff#campus_life`, `#academics` | Existing managed-content workspaces; desktop. |
| `/staff#outreach` | Already-present Developing/Action Center view; desktop. Nothing restored from the guide. |

Excluded: `/edward`, `/staff#edward`, `/dev/edward`, `/dev/staff-edward`, Edward API handlers, parent-specific pages and `/delegate`. Floating/contextual Edward surfaces are excluded even inside refreshed pages. The existing shared financial document receives its presentation when reused; parent access/logic remains unchanged.

## Interaction evidence

`artifacts/ui-refresh/interactions/results.json` records ten passing groups:

1. Board/list switch, search, empty state, priority filter/clear, keyboard detail opening and all detail tabs.
2. All seven configured boards reachable.
3. Native drag-and-drop on an existing browser-local outreach preview; local state restored afterward. Institutional write requests intercepted, none attempted.
4. Morning Brew metric/insight/meeting/email dialogs, keyboard containment, Escape and focus restoration.
5. Morning Brew customize cancel/save through its existing browser-local preferences.
6. Enrollment sorting, task drawer and requirement form navigation.
7. Financial breakdown dialog and all nine sections.
8. Phone financial navigation and intentional staff board horizontal scrolling.
9. Phone navigation opening, 25 Tab steps within the focus trap, Escape and trigger focus return.
10. Enrollment loading/error/retry using an isolated failed-read simulation; actual purple action/original gradient header and loaded font asserted.

Edward has a separate **27/27 exact** computed-style, relative-geometry and isolated-screenshot suite against the committed base. It covers launchers/panels/composer at three widths, hover/focus and contextual entry points. No message was submitted. See [README.md](README.md#edward-evidence) for isolation methodology and limitations.

## Remaining limits

- Fresh signup now completes real onboarding against an isolated PostgreSQL/MinIO backend, including expired-template regression, no-access FERPA signing, final My Enrollment and a new sign-in. See [onboarding evidence](onboarding.md). Delegate grants, uploads and payments are not claimed as tested. The subsequent restored-demo/new-account follow-up verifies both named demo sign-ins and three real OpenAI answers for an explicitly authorized fictional account; existing demo records were not sent to the provider. No shared demo records were reset. The backend full test command still fails its coverage gate (62.24% vs 67%; 1,454 passed, 167 optional integrations skipped).
- Every alternate requirement/upload extraction state, every staff editor and all role/permission variants are not exhaustively exercised.
- Real staff task mutations, unrelated conflict/rollback paths, uploads, payments, non-onboarding form saves, communications and provider replies were not submitted. Connected institutional write regression needs a disposable backend fixture.
- Long task titles and institutional labels were inspected in current demo data. Arbitrarily long tenant names, translations, zoom combinations and older browser engines were not exhaustively tested.
- Reduced-motion rules and new token contrast have focused checks; keyboard checks cover critical dialogs/navigation. This does not certify full WCAG conformance or every original untouched color/control.
- Morning Brew remains demo-backed at this committed base, with its existing disclaimer. Newer uncommitted API-connected work in the original checkout was deliberately excluded.

No unresolved execution-permission blocker remains. These are explicit validation limits, not claims that unchanged workflows are broken.
