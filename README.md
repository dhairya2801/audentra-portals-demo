# Audentra Portals — October 2 handoff

Branches: [Portals `test.audentra-2oct`](https://github.com/dhairya2801/audentra-portals-demo/tree/test.audentra-2oct) · [Platform `test.audentra-2oct`](https://github.com/dhairya2801/audentra-platform-demo/tree/test.audentra-2oct).

Requires Node 22, Python 3.12+, `uv`, Docker Compose and GitHub repository access.

```bash
git clone --branch test.audentra-2oct git@github.com:dhairya2801/audentra-platform-demo.git Audentra-platform
git clone --branch test.audentra-2oct git@github.com:dhairya2801/audentra-portals-demo.git Audentra-portals
cd Audentra-platform
tools/handoff/setup-local.sh
tools/handoff/start-local.sh
```

Setup creates a private `.env.handoff`, isolated PostgreSQL/MinIO services, applies
all migrations through `0080`, and imports synthetic Ada/Camila records and files.
It preserves subsequent edits. No worker, production data, or live credentials are
copied. For Edward, set your own `OPENAI_API_KEY` in `.env.handoff` and restart;
otherwise AI is explicitly offline. The model is `gpt-6-luna`.

In another terminal:

```bash
cd Audentra-portals
npm ci
cp apps/web/.env.example apps/web/.env.local
npm run dev
```

Open <http://localhost:3000>; use the Ada/Camila demo sign-in buttons.
The example sets `API_PROXY_ORIGIN=http://127.0.0.1:4000`,
`NEXT_PUBLIC_SITE_URL=http://localhost:3000`,
`NEXT_PUBLIC_DEMO_STUDENT_LOGIN_ENABLED=true`, and
`NEXT_PUBLIC_DEMO_STAFF_LOGIN_ENABLED=true`. Keep `NEXT_PUBLIC_API_BASE_URL`
unset when proxying. Secrets belong only in ignored backend environment files.

```bash
# Portals checks and local production startup
npm run typecheck && npm run lint && npm test && npm run build
npm run start
# Vercel uses: npm run vercel-build
```

Live: <https://test.audentra.ai> uses Vercel → HTTPS proxy → GCP VM/Caddy → API,
PostgreSQL and MinIO; its frozen demo runs without a worker. New branches do not
replace production. See the backend [handoff notes](https://github.com/dhairya2801/audentra-platform-demo/blob/test.audentra-2oct/docs/handoff-2oct.md)
for environment names, deployment/rollback, verified checks and limitations.
