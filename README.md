# Audentra Portals

Next.js/React portals for Audentra students and staff. The web application is
built with Next.js 16, React 19, TypeScript, Tailwind CSS, Vite/Vinext, and the
Cloudflare runtime tooling already used by the project.

The FastAPI application and Python worker are maintained separately in
[`Audentra-ai/Audentra-platform`](https://github.com/Audentra-ai/Audentra-platform).

## Repository layout

```text
apps/web/                 Student and staff portal routes, UI, and assets
packages/contracts/       Temporary snapshot of the platform API contracts
tools/browser-e2e/        Browser journeys run against a platform environment
infra/docker/             Frontend-only container build
docs/                     Portal behavior, acceptance, and operations notes
```

## Local development

Requirements: Node.js 22, Docker, and a checkout of the companion
[`Audentra-platform`](https://github.com/Audentra-ai/Audentra-platform)
repository. The portal does not include a mock API: sign-in, account creation,
and all authenticated screens require the platform API to be running.

Start the platform first (in a separate terminal):

```bash
cd ../Audentra-platform
docker compose --env-file infra/.env.example -f infra/compose.yaml up --build
```

Wait until `http://localhost:4000/health/ready` reports healthy. Then start this
repository:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The portal defaults to `http://localhost:3000` and the API defaults to
`http://localhost:4000`. On Windows Command Prompt, use
`copy .env.example .env.local` instead of `cp`.

If the UI says it could not load information, verify the API independently:

```bash
curl http://localhost:4000/health/ready
```

A connection refusal means the platform stack is not running. If the portal is
served from a port other than 3000, set `WEB_PORT` to that port when starting
the platform so credentialed CORS allows the portal origin. If a local
PostgreSQL instance already uses port 5432, expose the Compose database on a
different host port (the portal still uses API port 4000):

```bash
POSTGRES_PORT=55432 docker compose --env-file infra/.env.example -f infra/compose.yaml up --build
```

Useful commands:

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run start
```

## API boundary

All production browser traffic uses `NEXT_PUBLIC_API_BASE_URL` and sends
credentials. Separate frontend and backend origins therefore require the
platform to allow the exact portal origin, credentialed CORS, and the
`X-Tenant-Slug` header. Authentication cookies must use secure cross-site
settings when the two deployments are on different sites.

`packages/contracts` is deliberately marked as a temporary vendored snapshot.
The platform copy is canonical. Before teams change the two repositories
independently, replace this folder with a compiled, versioned
`@audentra/api-client` generated from the platform's OpenAPI schema.

The first history split retains the existing `@vv/*` package names to minimize
risk. Rename them to `@audentra/*` in a dedicated follow-up change after both
repositories are green.

## Browser journeys

Browser E2E no longer boots a hidden backend from this repository. Start or
deploy a compatible platform environment, then run:

```bash
E2E_API_BASE_URL=http://localhost:4000 npm run test:e2e
```

PowerShell:

```powershell
$env:E2E_API_BASE_URL = "http://localhost:4000"
npm run test:e2e
```

The platform exposes development-only fixture reset and credential adapters for
these deterministic journeys. They fail closed in production; see
[`docs/integration-testing.md`](docs/integration-testing.md).

## Container build

Build from the repository root so the workspace contract package is available:

```bash
docker build -f infra/docker/web.Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_SITE_URL=https://portal.example.com \
  .
```

Public PDFs and images are intentionally included in the image context.

## Vercel deployment

The repository includes a Vercel-native Next.js build alongside the existing
Vinext/Cloudflare build. From the repository root:

```bash
npm ci
npm run vercel-build
npx vercel
npx vercel --prod
```

`vercel.json` selects the Next.js framework, builds `apps/web`, and publishes
`apps/web/.next`. For the self-contained staff demo, configure:

```text
NEXT_PUBLIC_STAFF_DEMO_MODE=true
NEXT_PUBLIC_SITE_URL=https://portal.your-domain.example
```

Do not set `NEXT_PUBLIC_API_BASE_URL` for that deployment. Demo Login creates a
browser-only staff session and serves the complete staff workspace from an
isolated synthetic adapter; it makes no `/v1/staff/*` network requests and
needs no database.

For a real integrated deployment, set `NEXT_PUBLIC_STAFF_DEMO_MODE=false` and
`NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.example`. The API must allow
the exact portal origin with credentialed CORS and production cookies must be
`Secure` with an appropriate `SameSite` policy. `NEXT_PUBLIC_SITE_URL` can be
omitted for previews because Vercel supplies its generated hostname. Next App
Router owns client/server routing, so no SPA rewrite is needed.
