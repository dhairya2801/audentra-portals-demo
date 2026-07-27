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
