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

Requirements: Node.js 22 and a compatible Audentra Platform API.

```bash
npm ci
copy .env.example .env.local
npm run dev
```

The portal defaults to `http://localhost:3000` and the API defaults to
`http://localhost:4000`. On macOS or Linux, use `cp` instead of `copy`.

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
