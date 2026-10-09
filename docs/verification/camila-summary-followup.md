# Camila demo: news, responsive layouts, and three task summaries

Worktree: `morning-brew-sprint-1oct-v2`, branch of the same name. This follow-up builds on the existing Morning Brew v2 implementation (original baseline `21c2435`); it does not resurrect the rejected sprint implementation. No merge or deployment.

## Request checklist

- [x] Higher Ed News: one horizontal row, four equal cards on desktop, previous/next controls matching Pulse, article range, keyboard/native scrolling, all retrieved articles. Two cards on narrower screens, one on phones. Preserve the live feed, source dates, refresh, caching and image fallbacks.
- [x] Footer: only a right-aligned “Change what’s in it” action; opens onboarding step one. Keep the separate demo provenance note.
- [x] Monitor spacing: remove Morning Brew’s 92rem width cap and Student 360’s 1700px cap. Keep existing bounded page gutters. Let existing Task Board columns grow across the available width.
- [x] For You: new navigation entry immediately below Task Board and above Financial Aid, only in Camila’s demo workspace. Three implemented designs, shared source and filters, native task details.
- [x] Loading, initial failure/retry, empty dataset, filtered empty, refresh failure/recovery, keyboard focus, notification overlap, existing board filter retention.
- [x] Review desktop/laptop, large monitor, ultrawide and narrower rendered screens; inspect screenshots and refine spacing, contrast, labels and height.

## The three designs

- **A — Board:** a Jira-like triage board. Exclusive attention lanes, counts, compact cards, lane paging, plus an Area grouping that exposes the existing area → board → task relationship. No fictional epics or stories.
- **B — Focus:** a prioritized queue next to an always-visible task preview. Shows the reason, student, due date, assignee, current stage and recorded next step where available. Recommended for Camila’s daily work: it makes the next decision and action easiest without opening every task first.
- **C — Portfolio:** board-level distributions, an overall completion ring, ownership distribution and drilldowns from each bar segment. Suited to a PM’s cross-board review.

Switch with the A/B/C control at the top right. Search, scope, area and status carry between designs; the selected design persists for the browser session. The original board’s filters remain independent and survive a visit to the summary. Clicking the parent Task Board item returns to the original board.

## Data and behavior

All designs use the complete `getDemoTaskBoard().cards` snapshot already consumed by the demo board, through the existing credentialed portal API bridge. Verification compared API and in-memory totals: **66 tasks across seven boards** at the time of testing. No first-page aggregation, new task backend, hardcoded summary totals or new financial behavior.

Cards deduplicate by canonical ID before aggregation. Scope defaults to all visible demo tasks; personal, team queue and EDgent scopes are explicit. Completion and workflow stages retain the existing demo interpretation. Due-date classification matches the existing Task Board clock: the pinned demo clock for workflow previews, current time for uploaded documents. Those limitations are explained in the “How priorities work” dialog.

Buckets are exclusive: completed first; overdue open tasks; reviews/approvals/exceptions; waiting; remaining in-progress work. Within a group, earliest deadline precedes recorded priority. Focus places active work ahead of waiting work after overdue tasks and reviews. No fabricated AI urgency or historical performance data. The original board’s SLA label now says “No deadline” for open tasks without a due date, instead of incorrectly calling them completed.

Task edits use the existing detail flows. Changes to the shared store invalidate the summary, and the existing API polling/focus/invalidation path remains in place. A failed manual refresh retains the last loaded data and filters. Tests restore reversible demo workflow changes and never send external email/invites or move money.

## Preview

Open <http://localhost:3012/staff>, choose **Camila Abernathy**, then **Task Board → For You**. API health: <http://localhost:4112/health>.

From this worktree:

```sh
python3 tools/morning-brew-v2/start-api.py
cd apps/web
API_PROXY_ORIGIN=http://127.0.0.1:4112 NEXT_PUBLIC_DEMO_STAFF_LOGIN_ENABLED=true node ../../node_modules/next/dist/bin/next dev --webpack --hostname 0.0.0.0 --port 3012
```

The API helper uses the existing isolated Morning Brew database and private local configuration. Do not start a second copy if these ports are already running.

## Reproducible verification

```sh
node --test apps/web/tests/task-summary.test.mjs
node tools/morning-brew-v2/summary-verify.mjs
MB_BROWSER=webkit node tools/morning-brew-v2/summary-verify.mjs
node tools/morning-brew-v2/summary-source-states.mjs
node tools/morning-brew-v2/responsive-review.mjs
MB_BROWSER=webkit node tools/morning-brew-v2/responsive-review.mjs
node tools/morning-brew-v2/verify.mjs
MB_BROWSER=webkit node tools/morning-brew-v2/verify.mjs
node tools/morning-brew-v2/evidence.mjs
node tools/morning-brew-v2/states.mjs
npm run typecheck
npm run lint
npm test
npm run build
```

WebKit on this Ubuntu host needs the local `/tmp/morning-brew-v2-webkit/run` wrapper: it supplies extracted Ubuntu `libavif13`, `libgav1-0`, and `libyuv0` alongside Playwright’s WPE bundle. This is Linux WebKit coverage, not a test on macOS Safari or a physical iPhone.

Screenshots, baseline captures, browser results and feed evidence are in ignored `artifacts/morning-brew-v2/`. Browser scripts exercise 390, 820, 1366, 1440, 2560 and 3440px widths, and laptop heights down to 768px. All three default summary designs fit without material vertical scrolling on laptop/desktop; phone layouts intentionally allow more scrolling.

The ten aggregation tests include a 503-task dataset, deduplication, exclusive groups, deadline boundaries, filtering, sorting, completion and assignee changes, zero records, and truthful SLA labels for open tasks without deadlines. The browser task journey opens all 66 actual demo tasks, exercises all three views, performs and restores the existing Complete outreach demo transition, verifies chart drilldowns and error recovery, and checks keyboard use. Existing Morning Brew journeys cover team settings, drafts/calendar context, proposal controls, feedback persistence, Edward’s displayed Pulse context and real news retrieval.

## Final checks

- Repository gates: **169 tests passed**, typecheck passed, production build passed, lint passed with the same **25 existing warnings** and no errors.
- Chrome and Linux WebKit: all three summary designs, every one of the 66 task details, shared filters, lane paging, chart drilldowns, scope totals, reversible completion, retained board filters, keyboard switching/search and failed-refresh recovery.
- Browser stress checks preserve the search element and selected text through resize and data refresh. Task dialogs stay above refresh notices; the summary's design switch remains unobstructed.
- Both engines: 28 responsive surface/viewport combinations each. Chrome also inspected the actual Student 360 demo record at monitor, laptop and narrower widths.
- Existing Morning Brew journeys passed in Chrome and WebKit. Chrome exercised news loading/empty/stale/failure/image fallback, feedback retry/skip, email category empties, and read-only team permissions. Actual publisher retrieval was separately confirmed.
- No external emails/invites, real payments, merges or deployments were performed.
