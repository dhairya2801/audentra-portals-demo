# Platform integration testing

The portals repository owns browser journeys, but it does not own or silently
start a backend. `E2E_API_BASE_URL` selects the compatible Audentra Platform
environment used by the tests; the local web server is started automatically.

The suite relies on development-only deterministic reset and session endpoints.
It exercises the real FastAPI HTTP boundary and PostgreSQL-backed student
workflows; preview-only staff content remains explicitly unavailable in
production. A green run is an integration signal for the portal contract, while
production identity-provider and external-delivery adapters need their own
environment tests.

Before independent production release, add a platform compatibility job that:

1. deploys or starts the FastAPI platform at a pinned revision;
2. seeds an isolated tenant and test student;
3. exposes a test-only authentication bootstrap outside production;
4. runs these Playwright journeys against that API;
5. fails on any route or contract mismatch.
