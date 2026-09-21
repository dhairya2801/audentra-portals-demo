# Edward interaction experience

Ask Edward opens a 640px desktop workspace or a full mobile dialog. Answers use
an additive typed semantic contract: primary answer, next action, supporting
details, record facts, checklists, contacts, timeline, source passages and snapshot
context. The backend projects record values from authorized successful reads;
React controls rendering. Existing action previews, confirmations and receipts
remain server-owned. There is no model-authored HTML or executable UI instruction.

Implementation:

- `app/components/edward-response.tsx`: semantic rendering and source disclosure.
- `app/components/edward-experience.module.css`: shared responsive surface.
- `app/hooks/use-edward-suggestions.ts`: suggestions from existing requirements.
- `app/components/edward-action-card.tsx`: review and receipt, including saved values.
- `app/components/edward-trace-inspector.tsx`: inspect backend semantic construction.

These paths are under `apps/web/`. The canonical contract lives in the paired
platform repository and is mirrored in `packages/contracts/src/index.ts`.
Plain-text fallback remains available during rolling deployment.

The full evaluation, before/after judgments, spend, screenshots and limitations
are in the paired platform repository at `docs/edward-experience/REPORT.md`.
The work does not claim every answer is correct: false causal explanations and
missing multi-student comparison remain documented limitations.

With the university backend running and the local portal API origin configured:

```bash
npm run dev
node tools/university-explorer/edward-experience.mjs
node tools/university-explorer/edward-states.mjs
node tools/university-explorer/edward-staff-draft.mjs
node tools/university-explorer/edward-receipt-trace.mjs
```

The last script confirms a reversible synthetic profile change and restores its
original value. The draft script expects the seed account's unavailable-mailbox
boundary. No email is sent. Use the isolated evaluation database.

Optional reproducible axe checks, without changing repository dependencies:

```bash
npm install --prefix /tmp/edward-a11y @axe-core/playwright@4.13.0
EDWARD_AXE_MODULE=/tmp/edward-a11y/node_modules/@axe-core/playwright/dist/index.mjs node tools/university-explorer/edward-experience.mjs
```

Artifacts are ignored under `artifacts/edward-experience/`. Browser tests use real
API state, assert focus/reopening/primary-answer visibility, and exercise desktop
and mobile. They do not replace a human or physical-device usability study.
