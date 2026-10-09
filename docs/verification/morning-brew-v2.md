# Morning Brew spreadsheet implementation

Sole requirements: `../audentra-portal-release/Morning_Brew_Changes.xlsx` (23 rows; all ID, Change, Requested by, Owner, Status and Call time cells read). No standalone dependencies column exists; dependencies are expressed in Change.

## Reset record

Removed using `git worktree remove --force`: `audentra-portal-refresh-sprint-1oct` (base `21c2435b1c3560486985af38c539fa4e337746dc`) and its rejected financial backend companion `audentra-platform-sprint-1oct` (base `7fda3a2`). Their branches were deleted. No rejected files or commits were copied.

New frontend branch/worktree: `morning-brew-sprint-1oct-v2`, from `21c2435`. New supporting backend branch: `morning-brew-sprint-1oct-v2`, worktree `morning-brew-platform-sprint-1oct-v2`, from `7fda3a2`. The original dirty frontend and all other worktrees remain untouched. Compared the later release branch: product source matches the selected frontend baseline; differences are deployment/docs. No later product edits require importing into this sprint.

## Checklist

- MB-01 (Dhairya, To do): remove repeated title/update masthead only.
- MB-02 (Team, To do): exclusive three-way email classification; total and category counts agree.
- MB-04–08 (Laura + Dr. Zaibis; UI owner unspecified, To do): HOLD. No approved copy, comparison list, examples and length limits found in supplied/repository materials. Preserve Intelligence UI/copy.
- MB-09 (owner unspecified, To do): team-scoped visibility in existing customization, permission checked and persisted.
- MB-10 (Parked): no background redesign.
- MB-12 (Dhairya, In progress): Pulse Edward context agrees with displayed metric/filter/period; preserve assistant design.
- MB-13 (Laura, To do): separate purple upward draft-edit arrow from Send reply.
- MB-14–15 (owner unspecified, To do): complete known related email/event metadata, explicitly unknown fields.
- MB-16 (Laura feature write-up, To do; after MB-14/15): detected request, contextual proposed time, separate draft regeneration/invite actions, honest availability.
- MB-17 (Laura, To define): restrained in-drawer calendar inspection; draft remains intact. No approved proposal found; layout is an implementation assumption.
- MB-18 (Dhairya, To do): prep feedback popup, reasons, text, Skip/Submit and persistence.
- MB-19–20 (Parked): no month view or broad daily-panel redesign.
- MB-21/25 (Dhairya / unspecified, To do): real cached feed, refresh/dedup/dates/links/images and failure states.
- MB-22 (Laura + Dr. Zaibis, To do; after feed): five real-article review drafts, only supported institutional data; approval by Ajlan + Dr. Zaibis required.
- MB-23 (Laura + Dr. Zaibis, To do; after approved examples): draft rules only; do not activate editorial generation.
- MB-26 (owner unspecified, To define): clearly provisional demo customization examples, separate from held Intelligence redesign.

## Implemented outcome

- **MB-01/02:** Duplicate masthead removed. The default eight-message brief reconciles as 4 important unread + 4 pending response + 0 waiting on replies. Each message ID is counted once. Precedence: resolved excluded; waiting/replied first; important-and-unread second; other response-needed messages third. Read informational messages are excluded. Existing email filters use the same classification. A demo reply moves its message into waiting without changing the total.
- **MB-09:** Existing customization switch now saves a tenant/component team policy. `staff_role_capability` controls writes via `morning_brew.team.configure`; the migration grants it only to named existing leadership role codes. Non-managers see the current choice and a disabled switch. Writes require the rendered version; conflicts retain unsaved choices. Audit/outbox and team-scoped realtime invalidation commit with the setting. Reads refetch after invalidation, focus, or a bounded 60-second poll while the brief is visible. Personal depth/topics remain browser preferences.
- **MB-12:** Pulse sends the exact displayed value, goal, period, selected comparison, forecast, definition, topic labels and existing cohort filters to the existing Edward window. The backend explains the labeled demo snapshot deterministically; it does not substitute live cohort counts or claim a cause. Live-record questions retain the existing authorized pipeline. Edward's visual design is unchanged.
- **MB-13–17:** Purple upward edit arrow separated from Send reply. Related metadata has readable cards and inline expansion; absent sent dates, CC, recurrence history or discussion evidence are explicitly unavailable. Meeting-request detection considers same-topic conversations and matching upcoming demo events; a chosen time regenerates the draft with an explicit unconfirmed proposal. The calendar inspector is a restrained expandable panel inside the existing drawer (implementation assumption because no approved MB-17 proposal was found). Draft text survives inspection. No external send or invitation occurs when a draft changes.
- **MB-18:** Prep thumbs open four appropriate reasons, optional comment, Skip details and Submit. Ratings persist against the staff account/demo sheet. Failed saves retain inputs; retry IDs prevent duplicate writes.
- **MB-21/25:** Real Higher Ed Dive RSS retrieval runs server-side on demand. The tenant cache refreshes after 15 minutes; explicit refresh permits a check after 60 seconds. Conditional ETag/Last-Modified requests, a 10-second timeout, bounded XML, URL/date validation and deduplication protect the read. Publication dates and publisher links are visible. Last-good articles survive a failed fetch with a stale label. Publisher images have an initials fallback. Actual retrieval included October 5, 2026 articles. This is a request-driven feed, not a new background ingestion platform.
- **MB-22/23:** Five real publisher-article candidates paired with actual query results or explicit missing-data boundaries are in `docs/review/morning-brew-news-review-draft.md`. Institutional query results are from synthetic demo records and clearly labeled. Rules are documentation only, pending required approval; nothing generates institutional news insights.
- **MB-26:** Existing customization examples now explicitly identify provisional/demo figures. No production metrics or held Intelligence cards were rewritten.

## Holds and concrete dependencies

- MB-04–08: unchanged pending Laura/Dr. Zaibis approved copy, comparison rules, examples and approximate length limits. No approval package was found.
- MB-10, MB-19, MB-20: parked. No Student Financials, For You, month-view, background or broad daily-panel redesign.
- MB-14/15: the pinned demo messages lack provider sent timestamps/CC lists; most events lack recurrence history and discussion notes. The UI identifies those gaps rather than fabricating metadata.
- MB-16/17: this Morning Brew has no connected live staff-calendar availability/invitation adapter, nor a provider-authorized recipient calendar. Create calendar invite is visibly disabled. The two availability checks and real invitation delivery need that integration and appropriate permissions. The internal student-appointment capability does not confer access to staff/recipient external calendars.
- The existing draft-revision Edward entry point is retained. No OpenAI provider credential is configured in this preview; broad generative revision/live reasoning is not claimed to work. Displayed-Pulse explanation is verified independently of that credential.
- MB-22/23 require actual approved institution data for non-demo institution-specific examples and the named stakeholder approvals before activation.

## Verification actually completed

Baseline screenshots captured before frontend product edits. Personally reviewed baseline and final Chrome screenshots at 1440×1000, 820×1000 and 390×844; reviewed WebKit desktop/narrow screenshots. No document horizontal overflow at narrow widths. Related metadata cards were refined after visual inspection.

- Chrome and Playwright WebKit: team visibility save/reload, both toggle directions, demo example label, draft retention, proposed time, unavailable invitation, upward arrow, deliberate demo reply, category count reconciliation, persisted prep feedback, exact Pulse-to-Edward response, news refresh/images. No page exceptions in the main browser runs. WebKit used the installed Linux engine with locally extracted image-library dependencies; **this is not a test on Apple's Safari application or iOS hardware**.
- Chrome additional checks: loading/empty/error/stale news and image fallback through isolated browser response interception; no mock data replaced the server feed. Email category filters/empty state, feedback error retention/retry/Skip and read-only team UI. Final smoke checks exercised inline related email/event inspection and actual team realtime invalidation/refetch.
- PostgreSQL integration in `audentra_university_morning_brew_v2`: teammate visibility, denied non-manager write, rejected other-tenant actor, stale-version conflict, feedback retry/conflicting ID/malformed payload, one persisted record per ID, and failed-news retrieval retaining last-good data. The test restores the prior team/cache setting.
- Frontend gates: typecheck passed; lint passed with 25 warnings; 159 tests passed; production build passed (see final handoff if a later gate changes).
- Backend gates: typecheck, lint and build passed; Node workspace tests passed. Full Python run: 1,472 passed, 173 skipped, 2 warnings. **`npm test` does not pass its aggregate coverage gate: 62.1% versus required 67%.** External/integration fixtures are among skipped tests. The additional Morning Brew PostgreSQL test was run separately and passed. The coverage threshold was not weakened.
- Contract snapshots match byte-for-byte. Diff reviewed against spreadsheet IDs; no merge/deploy and no real emails, invitations or payments were executed.

## Working preview and restart

Frontend: http://localhost:3012/staff — choose **Camila Abernathy** under the demo staff profiles. API: http://127.0.0.1:4112. Complete the two existing customization steps if the brief has not yet been set up in that browser. Use **Change what's in it** at the bottom to reach team visibility and provisional examples.

From this frontend worktree, if the preview is stopped:

```sh
python3 tools/morning-brew-v2/start-api.py
cd apps/web
API_PROXY_ORIGIN=http://127.0.0.1:4112 NEXT_PUBLIC_DEMO_STAFF_LOGIN_ENABLED=true node ../../node_modules/next/dist/bin/next dev --webpack --port 3012
```

The helper uses the existing local `audentra-handoff-postgres-1` container and private sibling `.env.handoff`, creates/uses only the isolated database named above, and applies the companion worktree's migration 0081. It does not print credentials. Local Node/Python dependencies are linked to already installed environments; no installation is needed to restart these worktrees. Stop any prior process on these two preview ports before restarting. Outside this workstation, provision a migrated isolated synthetic database and install each repository's locked dependencies before using its normal launch commands.

Reproducible checks from this worktree: `node tools/morning-brew-v2/verify.mjs`, `node tools/morning-brew-v2/states.mjs`, `node tools/morning-brew-v2/final-smoke.mjs`, and `python3 tools/morning-brew-v2/verify-backend.py`. WebKit: `MB_BROWSER=webkit node tools/morning-brew-v2/verify.mjs` (local wrapper `/tmp/morning-brew-v2-webkit/run`). `evidence.mjs` refreshes the locally stored review evidence used by the failure-state check. Screenshots/evidence are under ignored `artifacts/morning-brew-v2/`; logs under `/tmp/mb-v2-*`.
