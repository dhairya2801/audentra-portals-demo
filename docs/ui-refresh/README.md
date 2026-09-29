# Portal refresh — review handoff

Latest follow-up: [onboarding fix, styling, validation and limitations](onboarding.md). Fresh signup now completes real onboarding and repeat sign-in. Ada/Camila demo sign-ins are restored, and live OpenAI checks on an explicitly authorized fictional new account verify its saved identity, remaining requirements and onboarding answers.

Implemented in an isolated frontend worktree, with rendered desktop, laptop and phone validation complete for the accessible demo flows. Changes are uncommitted and ready for review. No merge, push or deployment was performed. Remaining coverage limits are explicit in [coverage.md](coverage.md).

## Worktree and preview

- Worktree: `/home/dhairya2801/Dhairya/projects/worktrees/audentra-vnext/audentra-portal-refresh`
- Branch: `design/cohesive-portals-refresh`
- Frontend base: `a749ff1725291c4f90d8d9c70638563ff9cedc76`
- Source checkout: `../portals`, branch `integration/audentra-vnext-portals`.
- `audentra-vnext` contains independent frontend/backend repositories. Backend tip at inspection: `be65e22f275e2225f8d2bd5b95269e0a16d54378`; the signup/Edward follow-up is isolated in `../audentra-onboarding-platform` on `fix/new-account-onboarding` from that tip.
- Uncommitted source-checkout Morning Brew/API/contracts work was preserved and excluded. No resets or stashes in source worktrees. Follow-up database migrations/seeds and browser writes use isolated local test services only.
- Dependencies were copied from the existing installation into an ignored, independent `node_modules`. No package or lockfile changed. A fresh checkout can use `npm ci` with Node 22.

```sh
cd /home/dhairya2801/Dhairya/projects/worktrees/audentra-vnext/audentra-portal-refresh
API_PROXY_ORIGIN=http://127.0.0.1:4102 \
NEXT_PUBLIC_DEMO_STUDENT_LOGIN_ENABLED=true \
NEXT_PUBLIC_DEMO_STAFF_LOGIN_ENABLED=true \
npm --workspace @vv/web run dev -- --port 3000
```

Open [student sign-in](http://localhost:3000/sign-in) and select Ada; open [staff sign-in](http://localhost:3000/staff) and select Camila. A preview was running on port 3000 at handoff. The unchanged committed-base preview used port 3019 in `/tmp/audentra-refresh-baseline`.

The API proxy connects to existing demo data. Visual checks did not reset demo data, publish content, send messages, upload documents or submit institutional record changes. Existing login/activity telemetry remains active. The drag-and-drop check used an existing browser-local outreach preview, restored its local store afterward, and blocked institutional write requests.

The current preview uses a full local copy of the existing demo database, retaining Ada (`SYN-000061`) and Camila (`AU-55ff7e408818`), with the patched backend on port 4102. The smaller signup fixture on port 4101 is **not** the interactive preview. The ignored `apps/web/.env.local` retains this proxy and both demo-login flags for restarts. Backend startup is documented in `../audentra-onboarding-platform/docs/signup-onboarding-fix.md`; the original source database and temporary test database remain intact.

## Design direction

Housing contact correction: the summary now reads the student's `housing_coordinator` assignment from the existing advising API, displaying that person's name/office and using their email address. The generic Admissions fallback and enrollment-only note were removed. Loading, unavailable/retry and unassigned states are explicit; no assignment or backend records changed. Desktop/phone assigned-contact, message navigation, missing-assignment and failed-read/retry checks passed in `artifacts/ui-refresh/housing-contact/results.json`. Required gates passed in `housing-*.log`.

Appointments follow-up: the existing adviser card now uses the shared overlapping summary slot. Its main row matches Enrollment’s compact 116px desktop/laptop body, keeping advising status, next available time, the illustrated advisor and the original booking action. Advisor office details, slot counts and other contacts are preserved in a supporting Your advising team card below How this works. The existing How this works rail starts below that summary alongside the booking topics; it follows the main content on phones, like the other rails. No booking rules or data changed. Desktop/laptop/phone screenshots and dialog checks are in `artifacts/ui-refresh/appointments/`.

Latest student-frame follow-up: [student-frame.css](../../apps/web/public/portal-theme/student-frame.css) now owns the common header/summary geometry for React student pages and the financial iframe. It uses Enrollment's 34px desktop / 27px phone titles, 13.5px / 12.5px supporting text, 20px / 14px overlap, and 24px / 18px summary padding. Desktop headers have a 184px minimum; phone headers a 220px minimum. Long real content can grow without clipping. Summaries with one cell fill the available width. No summary was added where a page did not already have one.

Advisor summary initials now have a decorative illustrated person fallback in the guide's simple portrait style. The local SVG gives a single 1.4-second greeting, disabled with reduced motion. Existing record photos remain photos; names, office notes and contact actions are unchanged. The original shared Avatar component and Edward avatars are untouched. Financial header copy was shortened without changing facts or available actions.

Latest screenshots: [Enrollment](../../artifacts/ui-refresh/frame-after/enrollment-1440.png), [Financials](../../artifacts/ui-refresh/frame-after/financials-1440.png), [phone Financials](../../artifacts/ui-refresh/frame-after/financials-390.png), [phone Housing](../../artifacts/ui-refresh/frame-after/housing-390.png).

Latest evidence is in `artifacts/ui-refresh/frame-after/`: the student layout sweep asserts title/lede sizing, overlap, padding and lack of page overflow across 36 route/viewport cases. `details.json` records reduced-motion/animation checks, long advisor-name wrapping and unchanged financial Edward control styles. `artifacts/ui-refresh/frame-edward/result.json` records 13 exact student Edward comparisons against the base. Typecheck, lint, tests and build passed (`frame-*.log`); lint retains 24 existing warnings. Run `node tools/ui-refresh/student-frame.mjs` to repeat the layout sweep. Earlier screenshots and restoration checks below document previous stages of the review.

Following review, the original student purple page headers were restored by removing the refresh overrides: gradient, white typography, motifs, responsive sizing and summary overlap now come directly from the unchanged base styles. This includes the embedded My Financials header. Updated enrollment/financial screenshots are in `after/`; the earlier route-sweep screenshots predate this follow-up. Nine comparisons of enrollment, financials and Help at 1440, 1280 and 390px confirmed the original gradient, text colors, heading sizes, padding, radii, minimum height and motif visibility. Evidence is in `artifacts/ui-refresh/headers/`; typecheck, lint, tests and build also passed again (`header-*.log`). The follow-up assistant run matched the first 15 comparisons, then stopped at a 53-pixel raster difference confined to the staff launcher’s E glyph at 1280px, despite identical computed styles and relative geometry. This repeated on retry; the latest run is not a new 27/27 pass. No staff/Edward source or styles changed in this header follow-up, and the 123-file source integrity check passed again. The 27/27 evidence below is from the preceding full refresh review.

A shared purple/navy identity, quiet neutral surfaces, clear action hierarchy and readable financial figures unify the portals. Student screens retain their original purple headers and use comfortable touch controls; staff retains a wide, efficient workspace. The Jira-style board remains the same board, with intentional horizontal scrolling, compact metadata and clearer cards.

The guide was read and rendered, including foundations, buttons, Morning Brew controls, Task Board, Student 360 and next-step patterns. Montserrat was also evaluated on actual board and financial content using temporary browser-only styling. Detailed adopted/adapted/rejected decisions and reasons are in [design-decisions.md](design-decisions.md).

## Implementation

- `apps/web/public/portal-theme/tokens.css`: new semantic `--portal-*` tokens shared with existing embedded workspaces.
- `portal-theme/primitives.css`: presentation for existing controls, fields, cards, tabs, feedback and dialogs; no new component library.
- `app/audentra-design-styles/refresh/`: opt-in student, staff, Morning Brew and entry presentation.
- `portal-theme/board.css`: cards, columns, list, filters and task details; original board CSS/JavaScript unchanged.
- `portal-theme/financials.css`: existing nine financial sections; canonical renderer, API adapter and calculations unchanged.
- `student360-summary.module.css`: local record/financial readability; Ask Edward declarations unchanged.
- Staff navigation uses existing vendored Phosphor icons; institution identity leads the staff header and Audentra attribution stays in the sidebar. Edward's view retains its original header and icon.
- Morning Brew news cards display the existing publisher mark when an image fails. The committed base lacks some news images; unrelated uncommitted assets were not imported.

The scoped presentation layer deliberately leaves legacy shared styles and inherited root typography untouched. Editing those would indirectly restyle Edward. It does not paste the guide stylesheet or scripts into the application.

## Edward evidence

**27 comparisons passed against the separately served, unchanged committed base.** Each compared computed properties, relative element geometry and byte-identical isolated screenshots. Coverage includes student/staff launchers, open panels and unsent composer input at 1440, 1280 and 390 pixels; desktop hover/focus; enrollment contextual controls; Morning Brew contextual controls/panel; and Student 360's Ask Edward control.

Screenshots hide the surrounding portal and use a transparent background so changed page colors are not counted as assistant pixels. Floating controls/panels retain their natural viewport position. Contextual controls use a common screenshot origin after their natural dimensions/relative geometry are compared, since the surrounding layout moves them. This establishes the tested surfaces' appearance and local interactions; it is not a claim about unexercised provider replies, history or error states.

The source audit separately confirms **123 protected existing files unchanged**, Student 360 Ask Edward declarations unchanged, and Morning Brew's `EdwardButton` implementation unchanged. Assistant components/styles, API contracts, board logic, financial renderer and original global styles are included.

Scope boundaries exclude Edward classes/labels/navigation, Morning Brew assistant areas and upload retry actions. Student 360's existing button receives only `data-edward-preserve`, with its handler and declarations retained. Enrollment action groups are excluded from generic primitive sizing because changing a sibling could stretch Ask Edward. No assistant refactor was needed. Shared tooltips outside the opt-in root retain their original appearance.

- [Comparison results](../../artifacts/ui-refresh/edward/result.json)
- [Student panel before](../../artifacts/ui-refresh/edward/student-panel-1440-before.png) / [after](../../artifacts/ui-refresh/edward/student-panel-1440-after.png)
- [Staff panel before](../../artifacts/ui-refresh/edward/staff-panel-1440-before.png) / [after](../../artifacts/ui-refresh/edward/staff-panel-1440-after.png)
- [Protected source manifest](../../artifacts/ui-refresh/source-integrity.json)

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed; 0 errors, 24 existing warnings.
- `npm test`: passed, 14 test files, including presentation guards and its production build.
- `npm run build`: passed independently after the final visual changes.
- `git diff --check`: passed.
- Browser route sweep: **64 route/viewport cases**, no page errors, reported alerts or uncontained overflow. Additional checks rendered the landing page, Clubs tab and an actual club detail route at desktop/phone without overflow. This is a sweep, not exhaustive testing of every action on each page.
- Browser interactions: **10 groups passed** covering board/list/search/priority/clear/detail tabs, all seven boards, local preview drag/drop, Morning Brew dialogs/customization, enrollment sorting/drawer/requirement navigation, all financial sections/breakdown, mobile navigation/focus trapping and loading/error/retry simulation.
- Edward: **27 exact comparisons passed**.
- Keyboard checks include board detail opening, dialog Escape/focus restoration and 25 Tab steps within the mobile navigation trap. Student primary touch controls are 44px on phones; staff board overflow is intentionally contained. New default text/action/status token contrast checks pass at least 4.5:1. This is not an exhaustive accessibility certification.

Results: [route sweep](../../artifacts/ui-refresh/audit/results.json), [interaction checks](../../artifacts/ui-refresh/interactions/results.json). The guide experiment and additional route screenshots are in `artifacts/ui-refresh/guide` and `artifacts/ui-refresh/audit`.

## Screenshots

Before images come from the committed-base preview with the same available demo profiles. After images show the implemented worktree. Dates, task counts and API state can differ between captures; screenshots do not imply those data were changed by the refresh.

| Screen | Before | After |
| --- | --- | --- |
| Student enrollment | [Before](../../artifacts/ui-refresh/before/student-enrollment.png) | [After](../../artifacts/ui-refresh/after/student-enrollment.png) |
| Student financials | [Before](../../artifacts/ui-refresh/before/student-financials.png) | [After](../../artifacts/ui-refresh/after/student-financials.png) |
| Student phone enrollment | [Before](../../artifacts/ui-refresh/before/student-enrollment-390.png) | [After](../../artifacts/ui-refresh/after/student-enrollment-390.png) |
| Student phone financials | [Before](../../artifacts/ui-refresh/before/student-financials-390.png) | [After](../../artifacts/ui-refresh/after/student-financials-390.png) |
| Staff Morning Brew | [Before](../../artifacts/ui-refresh/before/staff-brew.png) | [After](../../artifacts/ui-refresh/after/staff-brew.png) |
| Staff Task Board | [Before](../../artifacts/ui-refresh/before/staff-board.png) | [After](../../artifacts/ui-refresh/after/staff-board.png) |
| Staff task detail | [Before](../../artifacts/ui-refresh/before/staff-task-detail.png) | [After](../../artifacts/ui-refresh/after/staff-task-detail.png) |
| Staff Student 360 | [Before](../../artifacts/ui-refresh/before/staff-student360.png) | [After](../../artifacts/ui-refresh/after/staff-student360.png) |

## Reproducing browser evidence

With Playwright/Chromium and both previews running, from this worktree:

```sh
PORTAL_BASE=http://localhost:3000 PHASE=after node tools/ui-refresh/capture.mjs
PORTAL_BASE=http://localhost:3000 node tools/ui-refresh/audit.mjs
PORTAL_BASE=http://localhost:3000 node tools/ui-refresh/interactions.mjs
PORTAL_BASE=http://localhost:3000 BASELINE_BASE=http://localhost:3019 node tools/ui-refresh/verify-edward.mjs
bash tools/ui-refresh/source-integrity.sh
```

Artifacts and authentication state are ignored by Git and remain local. Do not publish session JSON or demo records. The earlier execution-permission blocker was resolved; it is no longer a handoff blocker. The [onboarding follow-up](onboarding.md) now verifies real fresh-account acceptance, all onboarding steps, signing, portal handoff and repeat sign-in against isolated services; the expired-template and missing-import fixes are in a separate backend worktree. That follow-up documents the backend coverage-gate limitation. Other write/provider workflow gaps remain as listed in the coverage document.
