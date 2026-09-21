# Staff sign-out and explicit account selection

The browser API client sent `X-Demo-Actor-Type: staff` with every staff request.
With the regular local runtime's `BROWSER_AUTH_REQUIRED=false`, removing the
staff cookie on sign-out exposed the development header fallback. The next
workspace request therefore reopened the configured default staff member,
Camila Abernathy. A fresh browser could also open that account without choosing it.

Staff browser requests now rely on the existing credentialed session cookie.
Development actor headers have been removed from staff reads, writes and
document downloads. The tenant header, explicit demo selector, session
revocation and backend authorization remain intact. No API, schema or seed
changes are required; command-line development clients retain their existing
explicit identity-header mechanism.

Validation:

- Reproduced the implicit Camila workspace before the fix against an isolated
  synthetic university API with browser session enforcement disabled.
- `tools/university-explorer/staff-session-regression.mjs` passes against both
  the unrestricted local API and the restricted demo API with enforcement on.
  It checks fresh entry, explicit sign-in, account-menu and profile sign-out,
  reload, a new tab, server rejection of the revoked session, explicit selection
  of a different staff member when available, and absence of browser actor headers.
- `npm test`: build and all 136 existing tests pass; the added transport
  regression test also passes independently (137 tests total).
- `npm run typecheck` passes. `npm run lint` passes with the 14 existing warnings.

Run the browser regression against an isolated imported university database:

```bash
E2E_BASE_URL=http://127.0.0.1:3009 \
E2E_API_BASE_URL=http://127.0.0.1:45659 \
node tools/university-explorer/staff-session-regression.mjs
```

The test changes only authentication sessions, saves no credentials, and does
not call Edward or mutate student/work records. Repeat with the API configured
with `BROWSER_AUTH_REQUIRED=true` and `false`.
