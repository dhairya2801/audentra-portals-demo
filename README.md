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
platform to allow the exact portal origin and credentialed CORS. The platform
resolves the deployment's configured tenant server-side; users do not enter or
send an institution portal identifier. Authentication cookies must use secure
cross-site settings when the two deployments are on different sites.

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
`apps/web/.next`. Every student and staff actor authenticates against the
platform; there is no browser-only demo mode and no way into either portal
without a real, revocable session.

Because the platform issues host-only session cookies, the browser must see a
single origin. Hosted split deployments leave the public API variable empty
and configure the portal's server-side worker instead:

```text
# Portal and API share one hostname (Caddy fronts both).
NEXT_PUBLIC_API_BASE_URL=https://portal.your-domain.example

# Portal is hosted apart from an IAM-private Cloud Run platform.
NEXT_PUBLIC_API_BASE_URL=
PLATFORM_API_ORIGIN=https://private-api.run.app
PLATFORM_API_AUDIENCE=https://private-api.run.app
PLATFORM_API_AUTH_MODE=google
```

`NEXT_PUBLIC_API_BASE_URL` makes `api-client.ts` build browser-visible absolute
URLs, so it must stay empty for the private-platform topology. The worker
intercepts only `/v1/*`; `/health` remains the student Health page.

`NEXT_PUBLIC_SITE_URL` can be omitted for previews because Vercel supplies its
generated hostname. Next App Router owns client/server routing, so no SPA
rewrite is needed.

## GCP Cloud Run delivery

`.github/workflows/deploy-ref.yml` is a manual-only workflow. Dispatch it from
trusted `main`, then select a source ref and either `development` or
`production`. Development accepts a same-repository branch, tag, or SHA;
production/current accepts only the exact trusted `main` SHA and the
`DEPLOY_CURRENT` confirmation. No push or merge triggers a portal deployment.

The one-time identities, repository, WIF provider, public portal/private API
boundary, and OAuth callback-log exclusion are provisioned with the reviewed
`infra/cloud-run/provision-portals.sh` operator script. It creates no key and
does not grant public access to the platform API. See
`docs/architecture/cloud-run-portals-cutover.md` before provisioning or
deploying.
