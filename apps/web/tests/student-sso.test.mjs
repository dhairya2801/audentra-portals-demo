import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiClientUrl = new URL("../app/lib/api-client.ts", import.meta.url);
const contractsUrl = new URL(
  "../../../packages/contracts/src/index.ts",
  import.meta.url,
);
const signInUrl = new URL(
  "../app/sign-in/sign-in-client.tsx",
  import.meta.url,
);

test("student SSO uses provider discovery and a fixed portal return path", async () => {
  const [apiClient, contracts] = await Promise.all([
    readFile(apiClientUrl, "utf8"),
    readFile(contractsUrl, "utf8"),
  ]);

  assert.match(apiClient, /StudentSsoConfiguration/);
  assert.match(apiClient, /StudentSsoProviderId/);
  assert.doesNotMatch(apiClient, /interface StudentSsoConfiguration/);
  assert.match(
    contracts,
    /type StudentSsoProviderId = "google" \| "microsoft"/,
  );
  assert.match(contracts, /interface StudentSsoConfiguration/);
  assert.match(apiClient, /\/v1\/auth\/sso\/providers/);
  assert.match(apiClient, /const STUDENT_SSO_RETURN_TO = "\/dashboard"/);
  assert.match(
    apiClient,
    /\/v1\/auth\/sso\/\$\{encodeURIComponent\(provider\)\}\/start\?\$\{query\.toString\(\)\}/,
  );
  assert.match(apiClient, /credentials: "include"/);
  assert.doesNotMatch(apiClient, /redirectUri|callbackUri|window\.open|localStorage/);
});

test("student sign-in renders discovered providers without exposing tokens", async () => {
  const signIn = await readFile(signInUrl, "utf8");

  assert.match(signIn, /getStudentSsoConfiguration\(controller\.signal\)/);
  assert.match(signIn, /ssoConfiguration\.providers\.map/);
  assert.match(signIn, /Continue with \{provider\.label\}/);
  assert.match(signIn, /href=\{studentSsoStartUrl\(provider\.id\)\}/);
  assert.match(signIn, /ssoConfiguration\?\.passwordEnabled !== false/);
  assert.match(signIn, /ssoConfiguration\.providers\.length === 0/);
  assert.match(signIn, /Single sign-on is not available for this institution/);
  assert.doesNotMatch(signIn, /access_token|id_token|refresh_token|localStorage/);
});

test("student SSO callback errors stay bounded and are removed from the URL", async () => {
  const signIn = await readFile(signInUrl, "utf8");

  for (const code of [
    "access_denied",
    "invalid_request",
    "account_not_linked",
    "provider_error",
  ]) {
    assert.match(signIn, new RegExp(`\\b${code}\\b`));
  }
  assert.match(signIn, /parameters\.get\("sso_error"\)/);
  assert.match(signIn, /parameters\.delete\("sso_error"\)/);
  assert.match(signIn, /Object\.prototype\.hasOwnProperty\.call/);
  assert.match(
    signIn,
    /window\.history\.replaceState\(\s*window\.history\.state,/,
  );
  assert.match(signIn, /role="alert"/);
  assert.doesNotMatch(signIn, /error_description|providerError|rawError/);
});
