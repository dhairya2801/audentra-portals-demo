# Browser misuse exploration harness

Use this prompt when delegating a bounded exploratory pass to a smaller Codex
agent:

> Explore one student journey only through the rendered frontend. Treat the
> browser as the user boundary: do not call internal APIs to perform the action.
> Try malformed, missing, duplicate, out-of-order, repeated, refreshed, and
> mismatched inputs. Use synthetic data only. For documents, upload a clearly
> labeled synthetic file (for example, a restaurant menu into the FAFSA task)
> and verify both the visible result and whether enrollment progress advanced.
> Record the route, exact inputs, visible outcome, expected outcome, severity,
> and reproduction steps. Do not mutate production unless the run is explicitly
> authorized as a live synthetic test.

The repeatable Playwright suite is the acceptance layer. An exploratory agent
may discover cases, but every confirmed regression should become a deterministic
Playwright scenario before it is considered fixed.

## Deterministic local execution

`npm run test:e2e` starts an isolated portal on ports `31817` and `41817`.
The web build wrapper must forward the `--host` and `--port` arguments supplied
by `start-test-portal.mjs`; otherwise it falls back to port `3000`, collides with
the developer portal, and Playwright waits for a server that can never appear.
Keep new test commands bounded and use the isolated fixture rather than
restarting the developer's portal.

The Playwright project uses the installed stable Chrome channel. This is
intentional: clearing npm or Playwright caches must not turn every scenario
into a delayed missing-browser failure or require another browser download.
On Windows the harness terminates the exact isolated portal process tree so
Playwright can exit promptly after the last assertion.

Staff journeys require an environment-only synthetic credential. Set the same
random value as `VV_STAFF_BOOTSTRAP_PASSWORD` for the isolated demo API and as
`E2E_STAFF_PASSWORD` for Playwright. Never commit the value or place it in a
tracked environment file.
