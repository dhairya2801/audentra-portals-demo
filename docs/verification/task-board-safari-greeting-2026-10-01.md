# Task Board Safari loading and Morning Brew greeting

## Live reproduction

On the deployed frontend `5ad443aec9d774cf0912ea1d4ea307303a847a99`, a fresh
Camila session in WebKit 26.5 received HTTP 200 from
`/v1/staff/demo-task-board`, but rendered zero cards and then “Task board
unavailable.” Instrumentation inside the iframe confirmed the response had the
correct origin, but `event.source === window` and `event.source !== parent`.
The receiver therefore rejected it and its request timer expired. Real Chrome
loaded the same board. Both browsers displayed “Vivian, start your morning with
what matters.” on the first Morning Brew setup page.

The earlier deployed Safari fix affected the Financials bridge only. The Task
Board's separate bridge still sent responses directly from its promise callback.

## Fix

Send Task Board replies from a parent-window timer task. Capture the requesting
window, confirm it is still the current board, and discard replies after unmount.
Keep the bridge listener stable across parent callback changes. Preserve the
receiver's strict origin, parent-source and request-ID checks, and the existing
credentialed, tenant-aware API client.

Use `preview.greetingName` for the onboarding heading. That value already comes
from the signed-in staff profile; `preview.reader.firstName` belongs to the demo
briefing corpus. This fixes Camila and other staff without changing the corpus.

## Verification

The release checkout contains only these two application changes and the
repeatable browser regression `tools/ui-refresh/task-board-safari.mjs`.
Existing document-preview work in the review checkout is not included.

Required gates pass: typecheck, lint (24 existing warnings, no errors), tests,
normal build, and the Vercel webpack production build. Browser verification uses
the production build with the live API through a local HTTPS proxy so secure
staff cookies retain their production behavior.

The browser regression covers real Chrome and WebKit at desktop and mobile
sizes: fresh UI sign-in, Camila's first-use greeting, canonical board card and
filter counts, task detail, reload, in-app navigation away/back, verified reply
sender, service-error/retry, and a client-side second-name fixture proving the
greeting is dynamic. No task/profile writes or model calls are made. No session
files, document content, or student screenshots are saved.

Run against the deployed site:

```sh
PORTAL_BASE=https://test.audentra.ai node tools/ui-refresh/task-board-safari.mjs
```

WebKit is Safari's engine; these Linux checks do not claim execution of the
Safari application on macOS or physical iOS hardware.
