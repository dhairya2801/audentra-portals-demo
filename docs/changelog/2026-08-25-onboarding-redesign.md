# 2026-08-25 — First-time onboarding, rebuilt to the design system's ten screens

The student's first-time onboarding gate (`apps/web/app/onboarding/`) now renders
the redesigned flow from `audentra-design` (commit `544d100` and the refinements
after it): a step rail, a hero band per screen, plain choice lists instead of
carded radios, one deadline per screen, and the modals the design specifies
(celebration with confetti, decline, authorize, waiver, hall drawer, help
ladder). The platform contract is unchanged.

## Screens and platform steps

The platform still owns eight ordered steps and refuses a step saved out of
sequence, so the ten screens follow the step order and map onto it:

| Screen | Platform step | Notes |
| --- | --- | --- |
| 1 Your offer | `offer` | `POST /admission-offers/{id}/accept`, then the step |
| 2 Confirm your details | `about_you` | Kept in the browser until screen 3 writes the step; edited from either afterwards |
| 3 How the university reaches you | `about_you` | The one `PUT` for both screens; pronouns go to `PATCH /student/profile` |
| 4 Where you will live | `housing` | Preference and up to three ranked halls from the housing plan |
| 5 Health and accessibility | `campus_life` | `accommodationInterest`; the immunization record uploads as a `health` document |
| 6 Emergency contact | `emergency_contacts` | One to three contacts |
| 7 Who can see your record | `family_permissions` | The FERPA authorization writes itself through its own endpoints; the step records the answer |
| 8 Your student photo | — | Optional; uploads as an `other` document. Skipping is browser-local |
| 9 Review and sign | `review_and_sign` | Typed signature only; signs the FERPA release too when it is still unsigned |
| 10 Deposit | `deposit` | `POST /student/payments/deposit` when paying now; a waiver records `waiver_or_deferral` |

The finish card calls `POST /student/onboarding/complete` and opens the portal.

## What the browser keeps beside the record

`sessionStorage` holds the unsaved draft, the fact that screen 2 was finished
before screen 3 wrote `about_you`, and whether the optional photo was set aside.
None of it is claimed as saved on the server; a new browser session lands on the
first screen the platform's record leaves open.

## What has no endpoint, and what the screens say instead

- A student-initiated decline: the modal names Admissions as the office that
  records it and links to the tenant's admissions contact.
- Mobile-number verification: choosing text records `communicationPreference:
  "sms"` without a code.
- A waiver reason: the choice is recorded; the office reads it from there.
- Aster Points for sharing: not shown, because nothing credits them.

## Design system

New vendored components under `apps/web/app/design-system/`: `ChoiceList`,
`FieldGroup`, `Modal`, `ReadPanel`, `Signature`, `Select`; `StepRail` gains a
help block. Their rules live in
`audentra-design-styles/onboarding-patterns.css` (the reference repo's two
appended blocks of 2026-08-24, with the handful of selectors that collide with
existing portal rules scoped under `.onboarding`) and the replaced
`features/onboarding.css`. The legacy `.offer-card` rules left `globals.css`.

## Tests

`tests/rendered-html.test.mjs` assertions that named the previous UI's
identifiers were rewritten to the new ones; the contract-level assertions
(step order, `expectedVersion`, the accept/deposit/complete commands, tenant
formatting) are unchanged. `upload-proxy-contract.test.mjs` now looks for the
10 MiB guard in every emitted client chunk, because the uploader is no longer
split into a chunk of its own once onboarding stopped importing it.
