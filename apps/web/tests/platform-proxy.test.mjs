import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadProxyModule() {
  const source = await readFile(
    new URL("../worker/platform-proxy.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  return import(`${moduleUrl}#${Date.now()}-${Math.random()}`);
}

function syntheticIdentityToken(expirySeconds = 4_102_444_800) {
  const payload = Buffer.from(JSON.stringify({ exp: expirySeconds })).toString("base64url");
  return `synthetic.${payload}.signature`;
}

test("Cloud Run proxy preserves the app session and adds only server identity", async () => {
  const { proxyPlatformRequest } = await loadProxyModule();
  const identityToken = syntheticIdentityToken();
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith("http://metadata.google.internal/")) {
      assert.equal(new Headers(init.headers).get("metadata-flavor"), "Google");
      assert.match(url, /audience=https%3A%2F%2Fapi-private\.example/);
      return new Response(identityToken, { headers: { "Metadata-Flavor": "Google" } });
    }

    assert.equal(url, "https://api-private.example/v1/student/documents?limit=1");
    const headers = new Headers(init.headers);
    assert.equal(headers.get("cookie"), "vv_student_session=synthetic-session");
    assert.equal(headers.get("authorization"), "Bearer application-token");
    assert.equal(headers.get("x-serverless-authorization"), `Bearer ${identityToken}`);
    assert.equal(headers.get("x-demo-tenant-id"), null);
    assert.equal(headers.get("x-tenant-slug"), null);
    assert.equal(headers.get("x-vv-worker-token"), null);
    assert.equal(headers.get("host"), null);
    assert.equal(headers.get("x-forwarded-host"), "portal.example");
    assert.equal(headers.get("x-forwarded-proto"), "https");
    assert.equal(init.redirect, "manual");
    return new Response(JSON.stringify({ documents: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const response = await proxyPlatformRequest(
    new Request("https://portal.example/v1/student/documents?limit=1", {
      headers: {
        authorization: "Bearer application-token",
        cookie: "vv_student_session=synthetic-session",
        "x-demo-tenant-id": "browser-selected-tenant",
        "x-serverless-authorization": "Bearer browser-controlled-value",
        "x-tenant-slug": "deprecated-browser-tenant",
        "x-vv-worker-token": "browser-controlled-worker-value",
      },
    }),
    {
      environment: {
        PLATFORM_API_ORIGIN: "https://api-private.example",
        PLATFORM_API_AUDIENCE: "https://api-private.example",
        PLATFORM_API_AUTH_MODE: "google",
      },
      fetchImpl,
      now: () => 1_700_000_000_000,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { documents: [] });
  assert.equal(calls.length, 2);
});

test("Cloud Run proxy forwards uploads, cookies, and same-origin redirects", async () => {
  const { proxyPlatformRequest } = await loadProxyModule();
  const requestBody = "synthetic multipart body";
  const fetchImpl = async (input, init = {}) => {
    assert.equal(String(input), "http://127.0.0.1:4000/v1/student/documents/upload");
    assert.equal(init.method, "POST");
    assert.equal(await new Response(init.body).text(), requestBody);
    assert.equal(new Headers(init.headers).get("content-type"), "multipart/form-data; boundary=test");
    const headers = new Headers();
    headers.append("set-cookie", "vv_student_session=renewed; Path=/; HttpOnly; SameSite=Lax");
    headers.append(
      "set-cookie",
      "vv_demo_session_expiry=1; Expires=Wed, 21 Oct 2037 07:28:00 GMT; Path=/; HttpOnly",
    );
    headers.append("set-cookie", "__Host-vv_oidc_binding=bound; Path=/; Secure; HttpOnly");
    headers.set("location", "../documents/doc-1");
    return new Response(null, { status: 303, headers });
  };

  const response = await proxyPlatformRequest(
    Object.assign(new Request("http://localhost:3000/v1/student/documents/upload", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=test" },
      body: requestBody,
    }), {
      arrayBuffer: async () => assert.fail("the proxy must not buffer an upload"),
    }),
    {
      environment: {
        PLATFORM_API_ORIGIN: "http://127.0.0.1:4000",
        PLATFORM_API_AUTH_MODE: "none",
      },
      fetchImpl,
    },
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "http://localhost:3000/v1/student/documents/doc-1");
  assert.deepEqual(response.headers.getSetCookie(), [
    "vv_student_session=renewed; Path=/; HttpOnly; SameSite=Lax",
    "vv_demo_session_expiry=1; Expires=Wed, 21 Oct 2037 07:28:00 GMT; Path=/; HttpOnly",
    "__Host-vv_oidc_binding=bound; Path=/; Secure; HttpOnly",
  ]);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("Cloud Run proxy accepts a configured custom identity-token audience", async () => {
  const { proxyPlatformRequest } = await loadProxyModule();
  const identityToken = syntheticIdentityToken();
  let metadataCalled = false;
  const response = await proxyPlatformRequest(
    new Request("https://portal.example/v1/tenant/bootstrap"),
    {
      environment: {
        PLATFORM_API_ORIGIN: "https://api-private.example",
        PLATFORM_API_AUDIENCE: "audentra-private-api",
        PLATFORM_API_AUTH_MODE: "google",
      },
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.startsWith("http://metadata.google.internal/")) {
          metadataCalled = true;
          assert.match(url, /audience=audentra-private-api/);
          return new Response(identityToken, { headers: { "Metadata-Flavor": "Google" } });
        }
        assert.equal(url, "https://api-private.example/v1/tenant/bootstrap");
        return Response.json({ tenant: "aster" });
      },
      now: () => 1_700_000_000_000,
    },
  );
  assert.equal(response.status, 200);
  assert.equal(metadataCalled, true);
});

test("Cloud Run proxy rejects malformed or expiring metadata identity tokens", async () => {
  for (const identityToken of ["not-a-jwt", syntheticIdentityToken(1_700_000_030)]) {
    const { proxyPlatformRequest } = await loadProxyModule();
    let platformCalled = false;
    const response = await proxyPlatformRequest(
      new Request("https://portal.example/v1/tenant/bootstrap"),
      {
        environment: {
          PLATFORM_API_ORIGIN: "https://api-private.example",
          PLATFORM_API_AUDIENCE: "https://api-private.example",
          PLATFORM_API_AUTH_MODE: "google",
        },
        fetchImpl: async (input) => {
          if (String(input).startsWith("http://metadata.google.internal/")) {
            return new Response(identityToken, { headers: { "Metadata-Flavor": "Google" } });
          }
          platformCalled = true;
          return Response.json({ unsafe: true });
        },
        now: () => 1_700_000_000_000,
      },
    );
    assert.equal(response.status, 503);
    assert.equal(platformCalled, false);
  }
});

test("Cloud Run proxy fails closed for missing or unsafe upstream configuration", async () => {
  const { proxyPlatformRequest } = await loadProxyModule();
  for (const environment of [
    {},
    { PLATFORM_API_ORIGIN: "http://api-private.example" },
    {
      PLATFORM_API_ORIGIN: "https://api-private.example/path",
      PLATFORM_API_AUTH_MODE: "none",
    },
    {
      PLATFORM_API_ORIGIN: "https://api-private.example",
      PLATFORM_API_AUTH_MODE: "google",
    },
  ]) {
    const response = await proxyPlatformRequest(
      new Request("https://portal.example/v1/tenant/bootstrap"),
      { environment, fetchImpl: async () => assert.fail("upstream should not be called") },
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: {
        code: "PLATFORM_PROXY_UNAVAILABLE",
        message: "The Audentra platform is temporarily unavailable.",
      },
    });
  }
});

test("only platform API paths can cross the portal proxy", async () => {
  const { proxyPlatformRequest } = await loadProxyModule();
  const response = await proxyPlatformRequest(
    new Request("https://portal.example/internal/admin"),
    {
      environment: {
        PLATFORM_API_ORIGIN: "https://api-private.example",
        PLATFORM_API_ALLOW_UNAUTHENTICATED: "true",
        PLATFORM_API_AUTH_MODE: "none",
      },
      fetchImpl: async () => assert.fail("upstream should not be called"),
    },
  );
  assert.equal(response.status, 503);
});

test("internal worker routes and worker credentials never cross the browser proxy", async () => {
  const { proxyPlatformRequest } = await loadProxyModule();
  const response = await proxyPlatformRequest(
    new Request("https://portal.example/v1/student/internal/document-extractions/doc-1", {
      method: "POST",
      headers: { "x-vv-worker-token": "browser-controlled" },
    }),
    {
      environment: {
        PLATFORM_API_ORIGIN: "https://api-private.example",
        PLATFORM_API_ALLOW_UNAUTHENTICATED: "true",
        PLATFORM_API_AUTH_MODE: "none",
      },
      fetchImpl: async () => assert.fail("upstream should not be called"),
    },
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: "NOT_FOUND", message: "Not found" },
  });

  const encodedResponse = await proxyPlatformRequest(
    new Request("https://portal.example/v1/student/%69nternal/document-extractions/doc-1", {
      method: "POST",
    }),
    {
      environment: {
        PLATFORM_API_ORIGIN: "https://api-private.example",
        PLATFORM_API_ALLOW_UNAUTHENTICATED: "true",
        PLATFORM_API_AUTH_MODE: "none",
      },
      fetchImpl: async () => assert.fail("encoded internal route should not reach upstream"),
    },
  );
  assert.equal(encodedResponse.status, 404);
});

test("the first upstream SSE chunk is observable without waiting for stream completion", async () => {
  const { proxyPlatformRequest } = await loadProxyModule();
  let releaseSecondChunk;
  const secondChunk = new Promise((resolve) => {
    releaseSecondChunk = resolve;
  });
  const fetchImpl = async () => {
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("event: ready\ndata: first\n\n"));
          void secondChunk.then(() => {
            controller.enqueue(encoder.encode("event: update\ndata: second\n\n"));
            controller.close();
          });
        },
      }),
      {
        headers: {
          "cache-control": "no-cache, no-transform",
          "content-type": "text/event-stream",
        },
      },
    );
  };

  const response = await proxyPlatformRequest(
    new Request("http://localhost:3000/v1/student/events"),
    {
      environment: {
        PLATFORM_API_ORIGIN: "http://127.0.0.1:4000",
        PLATFORM_API_AUTH_MODE: "none",
      },
      fetchImpl,
    },
  );
  const reader = response.body.getReader();
  assert.equal(response.headers.get("cache-control"), "no-store, no-transform");
  const first = await Promise.race([
    reader.read(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("first chunk was buffered")), 100)),
  ]);
  assert.equal(new TextDecoder().decode(first.value), "event: ready\ndata: first\n\n");
  releaseSecondChunk();
  const second = await reader.read();
  assert.equal(new TextDecoder().decode(second.value), "event: update\ndata: second\n\n");
  assert.equal((await reader.read()).done, true);
});
