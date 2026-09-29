# Onboarding follow-up

## Account creation failure

Reproduced with a new disposable credential account against the existing test API through the local preview. Sign-up returned 201, bootstrap and onboarding returned 200, and `/v1/student/profile` returned 404 with `UNIVERSITY_STUDENT_NOT_FOUND`. The onboarding loader previously rejected its entire `Promise.all` when this optional profile enrichment failed.

The onboarding-specific profile reader now treats **only that exact status/code combination** as an unavailable profile. The existing onboarding record supplies the identity/contact fields, and the actual offer, housing, documents, payments and FERPA reads remain required. No fabricated profile, version, record, authorization, or successful write is introduced. All other profile failures still surface and support retry. Existing profiles retain their values and versioned writes. The optional pronouns control explicitly explains its unavailable state, and never attempts a write without a canonical profile version.

That initial loader fix changed no backend code. The follow-up below now repairs new-account offer creation and canonical portal reads in a separate backend worktree. The shared API client, contracts, and Edward UI remain unchanged. The explicitly requested Edward follow-up below changes only backend record selection for students absent from an import.

## Presentation

- Reused Enrollment's shared 34px desktop / 27px phone heading scale and purple header treatment. The offer card overlaps by the same 20px / 14px as other student summaries. A resume notice retains its own space rather than colliding with a form.
- Refined the existing ten-screen rail, saved/current states, forms, select menus, offers, residence choices, document areas, review tables, deposit information, dialogs, loading, errors and missing-offer state.
- Applied the existing portal semantic tokens: purple actions/selection, navy text/progress framing, teal progress fill, readable neutral surfaces, restrained borders, radii and shadows. Phone controls use 44px minimum touch targets; reduced motion is respected.
- Kept the guide's semantic color roles, flat controls, focus visibility, institutional identity hierarchy and clear field labels. Adapted its typography to existing Geist for readable forms and consistent portal text. Ignored mandatory Montserrat, fixed color percentages, decorative gradient cards and new fields/steps: these would impair continuity or change the product's requirements.
- Kept the website's ten-screen/eight-step workflow, step order, save/resume behavior, signature and deposit rules, institution marks, original Phosphor icons, help actions and demo disclosures. The guide is not a replacement specification for those workflows.

## Evidence

| Evidence | Location |
| --- | --- |
| Real signup failure | `artifacts/ui-refresh/onboarding/before.png` |
| Real account after fix | `artifacts/ui-refresh/onboarding/real-account-after-1440.png`, `real-account-after-390.png` |
| Flow before styling (same account after the functional fix) | `artifacts/ui-refresh/onboarding/flow-before.png` |
| All ten screen states at 1440, 1280 and 390px | `artifacts/ui-refresh/onboarding/{offer,details,contact,housing,health,emergency,permissions,photo,review,deposit}-{width}.png` |
| Screen checks | `artifacts/ui-refresh/onboarding/screen-results.json` |
| Error retry, loading, missing offer, existing profile, live account | `artifacts/ui-refresh/onboarding/state-results.json` |
| Dialogs and ranking | `help.png`, `help-mobile.png`, `decline.png`, `housing-drawer.png`, `housing-ranked.png`, `waiver.png` in the same folder |
| Edward | `artifacts/ui-refresh/onboarding/edward/result.json`: 13 exact computed-style, geometry and isolated-pixel comparisons against the committed base |

The screen-state sweep is explicitly **read-only API replay**, not proof of completed real onboarding. It checks all ten rendered screens at three widths, no horizontal page overflow, common heading sizing, long names, missing-profile disabling, field validation, select keyboard controls, mobile step disclosure, help focus containment/Escape, decline, residence detail/ranking/reordering and waiver dialogs. The permissions fixture is the new account's unavailable-authorization state. Signature submission, document upload, FERPA grants, final completion and payments were not performed.

Edward's launcher, contextual controls, panel and unsent composer were compared at 1440, 1280 and 390px, including desktop hover and keyboard focus. The comparison explicitly establishes keyboard modality on both pages before checking focus rings. Source integrity also confirms all 123 protected existing files remain byte-identical to the base. No assistant/provider message was submitted.

## New-account workflow fix (September 29 follow-up)

The previously documented expired-offer blocker is now fixed in the local implementation. Self-service signup was copying the oldest seeded student's offer deadline. On September 29 that could immediately produce an expired offer. The development/preview-only signup path now prefers a current catalog template and grants **new** offers at least 30 days to respond, preserving a later configured deadline. Existing offers are not renewed, and offer acceptance still rejects expired offers and another student's offer.

Three related issues surfaced during real browser testing and are also fixed:

- Profile, academic and financial portal projections use an imported university dossier only when that specific student exists in the tenant's import. Fresh accounts use their own existing canonical public records. No borrowed demo data, fabricated dossier, migration or change to import-backed students is involved. Imported students keep their existing projections; the later Edward follow-up applies the same per-student selection to assistant reads.
- Completing or changing FERPA access updates onboarding's version. Onboarding now reads that saved record before submitting the enrollment acknowledgment and refreshes its version after access changes. Version checks remain enforced; no blanket retry overwrites concurrent edits.
- The existing shared Select closed when its own options scrolled. It now keeps the menu open for internal scrolling and scrolls only its list when navigating by keyboard. Outside scrolling still closes the anchored menu. Edward does not use this primitive.

Completion opens **My Enrollment**, matching the button's wording. The finish message points to the real checklist instead of claiming nothing remains. Existing configured requirements, dependencies, completion rules, payments, optional photo and document flows are preserved.

### Real verification

`tools/ui-refresh/signup-onboarding.mjs` completed a new-email journey against disposable PostgreSQL and MinIO services, with real API writes and no response interception. The fixture deliberately expired existing offer templates and marked Aster as having a university import while leaving the new student absent from it. Acceptance, all ten screens/eight stored steps, real FERPA signing and acknowledgment generation, deferred deposit, final completion, and the portal handoff passed. A fresh credential sign-in retained the same completed onboarding version and requirement IDs/statuses. No payment, email delivery, student document upload or assistant request was submitted.

This test account has **2 of 9 enrollment requirements complete**, **6 ready** and **1 blocked**. The two completed items are profile verification and family permissions. These counts come from its configured journey; the demo account's four remaining steps are not copied. The fuller housing requirement remains open under existing completion rules despite the onboarding housing preference being saved.

Live offer, details, review, completion and enrollment screens passed overflow checks at 1440, 1280 and 390px. Long-menu End/typeahead/internal scrolling/Escape checks passed. Profile, academic, financial and advising endpoints all returned 200 for the new student.

| New evidence | Location |
| --- | --- |
| Real flow, new sign-in and canonical states | `artifacts/ui-refresh/signup/completion.json` |
| Portal reads without an imported dossier | `artifacts/ui-refresh/signup/portal-reads.json` |
| Live offer, details, review and finished onboarding | `artifacts/ui-refresh/signup/{active-offer,details,review,onboarding-finished}-{1440,1280,390}.png` |
| Actual remaining checklist | `artifacts/ui-refresh/signup/enrollment-{1440,1280,390}.png` |
| Edward visual comparison | `artifacts/ui-refresh/signup/edward/result.json` |
| Checks and browser logs | `artifacts/ui-refresh/signup/*.log` |

The source-integrity audit still passes for all 123 protected files. The follow-up Edward comparison uses the same disposable student record in the refresh and unchanged base previews; realtime streams are disabled only in that visual comparison. Launcher, contextual entry, panel and unsent composer are checked at desktop/laptop/phone widths. Those pixel tests did not submit messages; the later provider test below separately verifies real answers.

### Checks and limitations

- Frontend: typecheck, lint (24 existing warnings, no errors), production build and all 155 regression tests pass.
- Backend: lint and full Python/Node typechecks pass. All 218 Node tests pass. The new PostgreSQL regression passes and rolls back its mutations; it covers expired seed signup, missing-import fallback, acceptance idempotency, completion, remaining requirements and offer ownership/expiry enforcement.
- The standard backend `npm test` gate is **not green**: 1,454 Python tests pass and 167 optional integrations skip, but coverage is 62.24%, below the existing 67% threshold. The threshold was not reduced. Node tests were run separately because that coverage exit stops the combined command.
- Existing previously expired accounts are not silently renewed. These fixes apply to newly created development/preview offers. Production admissions policy and institutional data are unchanged.
- The test site has not been deployed. This is local implementation and isolated-service evidence.

### Worktrees and preview

Frontend: `audentra-portal-refresh`, branch `design/cohesive-portals-refresh`, base `a749ff1725291c4f90d8d9c70638563ff9cedc76`.

Backend: `audentra-onboarding-platform`, branch `fix/new-account-onboarding`, base `be65e22f275e2225f8d2bd5b95269e0a16d54378`. This is a separate worktree from the committed backend integration tip; unrelated changes in `platform` were excluded.

The running preview is **http://localhost:3000/sign-in**, now proxying the full-demo API on `http://127.0.0.1:4102` (see the follow-up below). Create an account with a new email and phone. The local API uses the disposable `audentra-signup-test-pg` (port 5544) and `audentra-signup-test-storage` (port 9100) services. All new test data belongs to those services, not the shared preview database.

To restart the frontend with that API running:

```sh
API_PROXY_ORIGIN=http://127.0.0.1:4102 NEXT_PUBLIC_DEMO_STUDENT_LOGIN_ENABLED=true NEXT_PUBLIC_DEMO_STAFF_LOGIN_ENABLED=true npm --workspace @vv/web run dev -- --port 3000
```

Run the writing browser regression **only with the disposable local API proxy**:

```sh
AUDENTRA_SIGNUP_E2E=isolated node tools/ui-refresh/signup-onboarding.mjs
```

Backend setup, test commands and runtime requirements are in the sibling backend's `docs/signup-onboarding-fix.md`. Changes are unmerged and undeployed. Session files and captured records are ignored local evidence, not distributable fixtures.

## Ada/Camila and new-account Edward follow-up

The earlier signup check left the frontend connected to a **compact test database** with unrestricted demo login configuration. That hid the named demo buttons; no Ada/Camila UI or records had been deleted. The interactive preview is now connected to a new isolated full copy of `audentra_university_vnext`, named `audentra_university_signup_review`, through the existing restricted `run_demo_excellence.py` launcher. Ada and Camila's browser sign-ins both pass. The source database and prior compact test database are retained, not reset or rewritten. Sessions/accounts belonging to different test databases are not transferred across their tenant boundaries.

New-account information was already persisted in `person`, `student`, `credential_account`, `student_profile`, `student_onboarding`, admission offers and the requirement engine. Edward selected university-only reads for any student in an imported tenant, even when that student had no imported dossier. It now checks **student membership** before enabling those imported reads, and otherwise reads the student's canonical portal records. The imported snapshot clock is also excluded for these new accounts; their deadlines use the current operational clock. The hold-release refusal no longer tries to enrich its answer from a nonexistent imported account. No fabricated birth dates, grades, charges, residence assignments or copied demo histories are added merely to satisfy the import schema.

The existing imported Ada path, tenant separation and delegate scope restrictions have an explicit local regression. Existing accounts with no imported dossier also benefit without requiring a backfill or a new signup. No Edward launcher, panel, composer, card, styling, interaction, tool definition, prompt or model configuration was changed.

After explicit user consent, the real browser sent **only the fictional newly created Morgan Test account's data** to the configured OpenAI provider. Three questions returned real `openai / gpt-6-luna` answers that matched saved values:

1. Full name and email matched the new signup/profile.
2. Remaining enrollment requirements came from its own checklist.
3. Housing preference was off campus and emergency contact was Alex Test, parent, matching onboarding.

No provider requests were submitted for Ada or Camila. The new account was created and fully onboarded in the same full-demo database used by the restored preview. Its configured checklist has 2 completed items, 5 ready and 2 blocked; the earlier 6-ready/1-blocked evidence above belongs to the separate compact fixture. Neither count is forced to match the demo.

Evidence is in `artifacts/ui-refresh/signup-edward/`: `result.json`, `ada-sign-in.png`, `camila-sign-in.png`, and `fictional-account-edward.png`. Raw provider responses are not exported. The signup browser check, same-account repeat sign-in, and 1440/1280/390px screenshots were repeated against this full-demo copy. All 123 protected frontend files remain byte-identical to the refresh base.

```sh
# Local demo sign-in checks only (no model request):
AUDENTRA_SIGNUP_E2E=isolated node tools/ui-refresh/signup-edward.mjs
# Explicitly authorized fictional-account OpenAI check:
AUDENTRA_SIGNUP_E2E=isolated AUDENTRA_PROVIDER_CHECK=1 node tools/ui-refresh/signup-edward.mjs
```

Backend lint/typecheck and two isolated database tests pass. Full Python run: 1,454 passed, 167 skipped; 218 Node tests passed separately. The existing coverage gate still fails at 62.2% versus 67%; it was not weakened. Frontend application code was unchanged in this follow-up; its previous typecheck/lint/build/155-test results remain applicable. No merge or deployment was performed.

## Original document storage repair (September 29)

The isolated full-demo database copy referenced original document objects that had
not been copied into its separate MinIO bucket. This caused HTTP 503 responses in
the Task Board viewer. Copied 119 existing source objects into the isolated bucket,
without overwriting any destination uploads; all copied bytes passed SHA-256
comparison. Source storage and records were left intact. No viewer/Edward code
change was needed. `node tools/ui-refresh/documents.mjs` now verifies all 22 board
originals, actual PDF rendering, download byte parity, expanded view and
failure/retry recovery, with zero browser errors or application writes.
