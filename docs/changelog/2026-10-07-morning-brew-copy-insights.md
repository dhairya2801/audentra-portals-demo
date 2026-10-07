# Morning Brew copy and Institutional Intelligence on test

Ports the Morning Brew feature from `Audentra-ai/Audentra-portals` branch
`codex/morning-brew-copy-insights` at `24202364ce731c0b0b694de929eb5905f3d76996`.
The feature commit is `eef1df780bac605e6d2ab0070a589f8016419f16`; the final
commit updates upstream test validation. Unrelated upstream changes and its
component-test infrastructure are not imported into this older deployment.

Vercel inspection confirmed that `test.audentra.ai` served deployment
`dpl_3YTiHJp2ory98JcoJC3Bvw4XYPMm`, from demo-repository commit
`99660488e2203815151a900244546dac19fdd24d`. This release starts from that live
commit, preserving the October 2 document fixes absent from demo `main`.

## Changes

- All 13 setup copy changes and three illustrative intelligence scenarios:
  financial-aid delay, registration capacity, and student disengagement.
- Shared cards for dashboard and setup previews, forecast arithmetic,
  expandable evidence, matching detail data, and explicit demo labeling.
- Preserve the deployed signed-in name projection and shared Edward handoff.
  Unique React IDs avoid duplicate accessible labels in simultaneous previews.
- No API-client, contract, backend, authorization, student-state, deployment
  configuration, or preference-storage changes.
- Required production audit repairs: Sharp `0.35.4` → `0.35.5`, its matching
  native packages, and transitive `source-map-js` `1.2.1` → `1.2.2`.

## Pre-push verification

Typecheck, lint (24 existing warnings, zero errors), all 160 Node tests,
standard production build, and Next.js/Vercel webpack build passed.
`npm audit --omit=dev --workspaces` reports zero vulnerabilities.

The actual Next.js production build was exercised through the hosted demo API:

- Chrome and WebKit at 1440px and 390px: setup copy, forecast values,
  evidence disclosure, detail/focus restoration, Edward opening without model
  submissions, saved source choices, reload, and no horizontal overflow.
- Existing Task Board regression: sign-in, dynamic staff names, canonical
  cards/filtering, details, reload, navigation, iframe sender and error/retry.
- Student 360: canonical pagination beyond 200 records, search, stable totals,
  reset and mobile layout.
- Chrome document regression: protected PDFs, download parity, switching,
  expansion, interrupted reads, expiry/relogin, access denial, and explicitly
  marked PNG/JPEG response fixtures. No document screenshots saved.
- Chrome desktop/mobile financial navigation: nine routes and error/retry.

Browser checks made no student-record edits or model submissions. Local
screenshots contain only Morning Brew demo presentation and remain ignored.
Linux WebKit checks do not claim physical Safari/iOS execution.

Repeat the focused check with:

```sh
PORTAL_BASE=https://test.audentra.ai node tools/ui-refresh/morning-brew-copy-insights.mjs
```
