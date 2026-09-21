# Aster Atlas

The internal model-university explorer, deliberately separate from student and
staff product navigation. A small native browser application served by the
sibling platform's local evaluation server; it does not use live product APIs.

From `platform`, run:

```bash
apps/api/.venv/bin/python tools/university/build.py
apps/api/.venv/bin/python tools/university/server.py
```

Open http://127.0.0.1:4310. `index.html`, `app.js`, and `style.css` are served
without a build step. The page works offline after local dependencies exist.

Views: institutional observatory, student dossiers, academics and what-if
analysis, financial evidence and action laboratory, document revisions,
relationships and permissions, two-clock timeline, staff/office coverage,
workflow handoffs, policy history, institutional calendar, physical housing,
scenario studio, saved cohort and model provenance.

Run `node tools/university-explorer/smoke.mjs` against the running server for
browser verification. Requires the existing `@playwright/test` installation and
Chromium. Screenshots are generated under `artifacts/university-explorer`.

The operator can reveal rubrics; that route must never be exposed as an Edward
tool. Action requests require an independent sandbox. See
`platform/tools/university/README.md` for API boundaries and reset instructions.

## Portal/Edward runtime verification

The Atlas above remains an independent seed/sandbox explorer. The actual
student/staff portals and Edward now use the same imported PostgreSQL runtime.
From this repository, `node tools/university-explorer/runtime-smoke.mjs` checks
the dashboard, classrooms, financials, staff operations and Lab Architecture
against the API and UI running locally. It invokes no model. Screenshots and
logs stay in the ignored artifacts directory.

See the sibling [runtime implementation report](../../../platform/docs/synthetic-university-runtime-report.md)
and [local run instructions](../../../platform/tools/university/README.md).

For the full portal UI pass against that same local v3 API, run
`node tools/university-explorer/portal-ui-smoke.mjs`. It visits the student and
staff pages at desktop and phone widths, exercises all university record
sections and student selection, opens content editors without publishing, and
checks for page overflow and browser errors. Screenshots and a JSON report are
written to the ignored `artifacts/portal-ui/` directory. The API can run with
`--disable-openai`; this check does not invoke a model.
