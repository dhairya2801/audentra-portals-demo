# Aster Student Portal

Responsive student-facing enrollment dashboard built with Next-compatible
React and vinext.

The app deliberately contains no mock-data fallback. It loads the dashboard
from the configured API, renders explicit loading and error states, accepts an
offer using an idempotency key, refreshes the server projection, and batches
allowlisted activity events without blocking student actions.

## Commands

```bash
npm ci --workspaces=false
npm run dev
npm run typecheck
npm run lint
npm test
```

`npm test` creates a production build and verifies rendered HTML, accessibility
landmarks, API wiring, tracking wiring, branded assets, and request behavior.

## Configuration

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

The local Compose stack provides both values. In a hosted environment, set
`NEXT_PUBLIC_SITE_URL` to the public portal origin before building so social
metadata resolves to absolute URLs.

Authentication is intentionally outside the UI layer. The current API uses an
isolated demo identity resolver; the production Keycloak/JWT resolver can
replace it without changing this app's domain contracts.
