import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

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
  assert.match(signIn, /onClick=\{selectStudentPortalSession\}/);
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
  assert.match(signIn, /ssoCallbackMessageRef\.current === undefined/);
  assert.match(signIn, /ssoCallbackMessageRef\.current = callbackErrorMessage\(callbackError\)/);
  assert.match(signIn, /Object\.prototype\.hasOwnProperty\.call/);
  assert.match(
    signIn,
    /window\.history\.replaceState\(\s*window\.history\.state,/,
  );
  assert.match(signIn, /role="alert"/);
  assert.doesNotMatch(signIn, /error_description|providerError|rawError/);
});

test("student SSO clears a delegate tab selector before the return path loads", async () => {
  const [source, parentPortalRoutesSource] = await Promise.all([
    readFile(apiClientUrl, "utf8"),
    readFile(
      new URL("../app/lib/parent-portal-routes.ts", import.meta.url),
      "utf8",
    ),
  ]);
  const compiledParentPortalRoutes = ts.transpileModule(parentPortalRoutesSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const parentPortalRoutesUrl = `data:text/javascript;base64,${Buffer.from(
    compiledParentPortalRoutes,
  ).toString("base64")}`;
  const executableSource = source.replace(
    'from "./parent-portal-routes";',
    `from ${JSON.stringify(parentPortalRoutesUrl)};`,
  );
  const compiled = ts.transpileModule(executableSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  const client = await import(moduleUrl);
  const storage = new Map([["vv:delegate-session-mode", "delegate"]]);
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;

  globalThis.window = {
    location: { pathname: "/sign-in" },
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    dispatchEvent: () => true,
  };
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    return Response.json({});
  };

  try {
    client.selectStudentPortalSession();

    assert.equal(storage.get("vv:delegate-session-mode"), undefined);
    await client.getStudentBootstrap();
    assert.equal(
      requests[0].init.headers["X-Audentra-Session-Mode"],
      undefined,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});
