# Aster Student Portal

Responsive student-facing enrollment dashboard built with Next-compatible
React and vinext.

The app deliberately contains no mock-data fallback. It loads the dashboard
from the configured API, renders explicit loading and error states, accepts an
offer using an idempotency key, refreshes the server projection, and batches
allowlisted activity events without blocking student actions.

## Commands

This frontend has no mock-data fallback. Before using authentication or any
portal data, start the companion `Audentra-platform` Compose stack from its
repository root:

```bash
docker compose --env-file infra/.env.example -f infra/compose.yaml up --build
```

Wait for `http://localhost:4000/health/ready`, then run the frontend commands
below from the portals repository root.

```bash
npm ci
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

For Vercel, deploy from the monorepo root using the checked-in `vercel.json`.
The portal is hosted apart from the API there, so set `API_PROXY_ORIGIN` to the
public API origin and leave `NEXT_PUBLIC_API_BASE_URL` unset: `next.config.ts`
proxies `/v1/*` and `/health*`, which keeps the platform's host-only
`SameSite=lax` session cookie first-party. Setting `NEXT_PUBLIC_API_BASE_URL`
instead sends the browser cross-origin and breaks sign-in. Vercel preview
hostnames are inferred for metadata when `NEXT_PUBLIC_SITE_URL` is omitted.

Authentication is intentionally outside the UI layer, and every actor signs in
against the platform — there is no browser-only demo path. The current API uses
an isolated demo identity resolver; the production Keycloak/JWT resolver can
replace it without changing this app's domain contracts.
