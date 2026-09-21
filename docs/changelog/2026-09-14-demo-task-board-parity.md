# Demo staff task board parity

The single Camila Abernathy demo profile now opens the complete browser mock
from the `deploy` remote of `Audentra-portals` (`dhairya2801/audentra-portals-demo`,
`main` at `d4569a9924b60491618c2fdf6d6630caa870f339`). Its 18 UI assets match
`https://test.audentra.ai/action-center-approved/`, captured September 14,
2026. It includes all seven boards, original seeded cards, document review,
outreach, payment and request workspaces, activity, workflow diagrams, filters,
list view, and local demo actions/reset.

`apps/web/public/action-center-demo/source-manifest.json` records SHA-256 hashes
for every original asset, including the deployment's `portal-bridge.js`. All
19 files are copied without changes. The bridge publishes navigation counts
and dialog sizing, and copies task links into the staff portal. The parent
selects this bundle only for the existing demo profile.

The board uses all 64 reference cards, the reference mock's sample people, and browser-local storage.
Its actions do not call platform APIs or update student records. The original
Demo footer and simulated-action labels are retained. Other staff profiles keep
the existing API-backed board. Authentication and the staff profile are unchanged.
The Edward launcher is hidden on this demo board so it does not cover cards or
the reference footer.

For a repeatable comparison, start the local portal/API and run from `portals`:

```sh
node tools/university-explorer/demo-task-board-parity.mjs
```

The check signs into fresh local and reference browser contexts, compares all
seven boards and every card's detail tabs, captures desktop/mobile screenshots,
and exercises local comment persistence/reset. Reference actions are read-only.
Screenshots and comparison results are written to the ignored
`artifacts/demo-task-board-parity/` directory. The mock must make no API requests.

September 14 validation: 234 reference comparisons passed, including 43 desktop
and mobile screenshot pairs. All 64 card workspaces, activity and workflow tabs
matched. Local comment persistence/reset and the deployment adapter's navigation,
dialog sizing, copied links and portal deep links passed with no board API calls.
The production build and all 137 portal tests passed.
