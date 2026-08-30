/**
 * Same-origin bridge from the public portal to the IAM-private platform.
 *
 * Browsers keep the Audentra session cookie on the portal origin. The portal
 * forwards that application request and authenticates only the server-to-server
 * Cloud Run hop with a Google identity token. Provider credentials and Google
 * tokens never enter browser code.
 */

type ProxyEnvironment = Record<string, string | undefined>;

type ProxyDependencies = {
  environment?: ProxyEnvironment;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

type CachedIdentityToken = {
  audience: string;
  expiresAt: number;
  token: string;
};

type PendingIdentityToken = {
  audience: string;
  promise: Promise<string>;
};

const GOOGLE_METADATA_IDENTITY_ENDPOINT =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity";
const TOKEN_REFRESH_SKEW_MS = 60_000;
const METADATA_TIMEOUT_MS = 5_000;
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const REQUEST_HEADERS_TO_REBUILD = new Set([
  ...HOP_BY_HOP_HEADERS,
  "content-length",
  "host",
  "x-demo-tenant-id",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-serverless-authorization",
  "x-tenant-slug",
  "x-vv-worker-token",
]);
const RESPONSE_HEADERS_TO_REBUILD = new Set([
  ...HOP_BY_HOP_HEADERS,
  "content-encoding",
  "content-length",
  "set-cookie",
]);

let cachedIdentityToken: CachedIdentityToken | null = null;
let pendingIdentityToken: PendingIdentityToken | null = null;

function normalizedOrigin(value: string | undefined, name: string): string | null {
  const candidate = value?.trim().replace(/\/+$/, "");
  if (!candidate) return null;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) origin.`);
  }
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !localHttp) {
    throw new Error(`${name} must use HTTPS outside loopback development.`);
  }
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error(`${name} must contain only an origin, without credentials, path, query, or fragment.`);
  }
  return url.origin;
}

function normalizedAudience(value: string | undefined): string | null {
  const audience = value?.trim();
  if (!audience) return null;
  if (audience.length > 2_048 || /[\u0000-\u001f\u007f]/.test(audience)) {
    throw new Error("PLATFORM_API_AUDIENCE contains invalid characters or is too long.");
  }
  return audience;
}

function proxyConfiguration(environment: ProxyEnvironment) {
  const platformOrigin = normalizedOrigin(
    environment.PLATFORM_API_ORIGIN ?? environment.API_PROXY_ORIGIN,
    "PLATFORM_API_ORIGIN",
  );
  if (!platformOrigin) {
    throw new Error("PLATFORM_API_ORIGIN is not configured for the portal server.");
  }
  const audience = normalizedAudience(environment.PLATFORM_API_AUDIENCE);
  const authMode = environment.PLATFORM_API_AUTH_MODE?.trim().toLowerCase() ||
    (audience ? "google" : "none");
  if (authMode !== "google" && authMode !== "none") {
    throw new Error("PLATFORM_API_AUTH_MODE must be either google or none.");
  }
  if (authMode === "google" && !audience) {
    throw new Error("PLATFORM_API_AUDIENCE is required for Google-authenticated platform requests.");
  }
  if (
    authMode === "none" &&
    !["localhost", "127.0.0.1"].includes(new URL(platformOrigin).hostname) &&
    environment.PLATFORM_API_ALLOW_UNAUTHENTICATED?.trim().toLowerCase() !== "true"
  ) {
    throw new Error(
      "Unauthenticated hosted platform proxying requires PLATFORM_API_ALLOW_UNAUTHENTICATED=true.",
    );
  }
  return { audience, authMode, platformOrigin };
}

function decodedJwtExpiry(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const normalized = payload.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function googleIdentityToken(
  audience: string,
  fetchImpl: typeof fetch,
  now: () => number,
): Promise<string> {
  const currentTime = now();
  if (
    cachedIdentityToken?.audience === audience &&
    cachedIdentityToken.expiresAt - TOKEN_REFRESH_SKEW_MS > currentTime
  ) {
    return cachedIdentityToken.token;
  }

  if (pendingIdentityToken?.audience === audience) return pendingIdentityToken.promise;

  const promise = (async () => {
    const metadataUrl = new URL(GOOGLE_METADATA_IDENTITY_ENDPOINT);
    metadataUrl.searchParams.set("audience", audience);
    metadataUrl.searchParams.set("format", "full");
    const response = await fetchImpl(metadataUrl, {
      headers: { "Metadata-Flavor": "Google" },
      cache: "no-store",
      signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Cloud Run identity token request failed with status ${response.status}.`);
    }
    if (response.headers.get("metadata-flavor") !== "Google") {
      throw new Error("Cloud Run identity endpoint did not return the expected metadata marker.");
    }
    const token = (await response.text()).trim();
    if (!token) throw new Error("Cloud Run identity token response was empty.");

    const receivedAt = now();
    const expiresAt = decodedJwtExpiry(token);
    if (expiresAt === null || expiresAt - TOKEN_REFRESH_SKEW_MS <= receivedAt) {
      throw new Error("Cloud Run identity endpoint returned a token without a safe future expiry.");
    }

    cachedIdentityToken = {
      audience,
      expiresAt,
      token,
    };
    return token;
  })();
  pendingIdentityToken = { audience, promise };
  try {
    return await promise;
  } finally {
    if (pendingIdentityToken?.promise === promise) pendingIdentityToken = null;
  }
}

function platformPath(request: Request): string {
  const url = new URL(request.url);
  if (url.pathname !== "/v1" && !url.pathname.startsWith("/v1/")) {
    throw new Error("The platform proxy accepts only /v1 requests.");
  }
  return `${url.pathname}${url.search}`;
}

function canonicalPlatformPathname(request: Request): string {
  const pathname = new URL(request.url).pathname;
  try {
    return decodeURIComponent(pathname).replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  } catch {
    throw new Error("The platform request path contains invalid encoding.");
  }
}

function proxyRequestHeaders(request: Request): Headers {
  const headers = new Headers();
  const connectionNominated = new Set(
    (request.headers.get("connection") ?? "")
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );
  for (const [name, value] of request.headers) {
    const lowerName = name.toLowerCase();
    if (
      !REQUEST_HEADERS_TO_REBUILD.has(lowerName) &&
      !connectionNominated.has(lowerName) &&
      lowerName !== "forwarded" &&
      !lowerName.startsWith("x-forwarded-")
    ) {
      headers.append(name, value);
    }
  }
  const portalUrl = new URL(request.url);
  headers.set("x-forwarded-host", portalUrl.host);
  headers.set("x-forwarded-proto", portalUrl.protocol.slice(0, -1));
  return headers;
}

function appendSetCookies(source: Headers, destination: Headers): void {
  const getSetCookie = (source as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const getAll = (source as Headers & { getAll?: (name: string) => string[] }).getAll;
  const cookies =
    typeof getSetCookie === "function"
      ? getSetCookie.call(source)
      : typeof getAll === "function"
        ? getAll.call(source, "Set-Cookie")
        : [];
  if (cookies.length > 0) {
    for (const cookie of cookies) destination.append("set-cookie", cookie);
    return;
  }
  const combined = source.get("set-cookie");
  if (combined) {
    throw new Error("This runtime cannot safely preserve multiple Set-Cookie headers.");
  }
}

function proxyResponseHeaders(
  upstream: Response,
  platformOrigin: string,
  platformRequestUrl: string,
  portalOrigin: string,
): Headers {
  const headers = new Headers();
  const connectionNominated = new Set(
    (upstream.headers.get("connection") ?? "")
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );
  for (const [name, value] of upstream.headers) {
    const lowerName = name.toLowerCase();
    if (!RESPONSE_HEADERS_TO_REBUILD.has(lowerName) && !connectionNominated.has(lowerName)) {
      headers.append(name, value);
    }
  }
  appendSetCookies(upstream.headers, headers);

  const location = headers.get("location");
  if (location) {
    try {
      const target = new URL(location, platformRequestUrl);
      if (target.origin === platformOrigin) {
        headers.set("location", `${portalOrigin}${target.pathname}${target.search}${target.hash}`);
      }
    } catch {
      // Leave a malformed upstream Location untouched; the browser will reject it.
    }
  }
  const upstreamCacheDirectives = (headers.get("cache-control") ?? "")
    .split(",")
    .map((directive) => directive.trim().toLowerCase());
  headers.set(
    "cache-control",
    upstreamCacheDirectives.includes("no-transform") ? "no-store, no-transform" : "no-store",
  );
  return headers;
}

/** Forward one browser-generated application request to the configured platform. */
export async function proxyPlatformRequest(
  request: Request,
  dependencies: ProxyDependencies = {},
): Promise<Response> {
  const environment = dependencies.environment ?? process.env;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? Date.now;

  try {
    const { audience, authMode, platformOrigin } = proxyConfiguration(environment);
    const path = platformPath(request);
    const canonicalPathname = canonicalPlatformPathname(request);
    if (
      canonicalPathname === "/v1/student/internal" ||
      canonicalPathname.startsWith("/v1/student/internal/")
    ) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Not found" } },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
    }
    const headers = proxyRequestHeaders(request);
    if (authMode === "google" && audience) {
      const token = await googleIdentityToken(audience, fetchImpl, now);
      headers.set("x-serverless-authorization", `Bearer ${token}`);
    }

    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const upstreamInit: RequestInit & { duplex?: "half" } = {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: "manual",
      cache: "no-store",
      signal: request.signal,
    };
    if (hasBody && request.body) upstreamInit.duplex = "half";
    const platformRequestUrl = `${platformOrigin}${path}`;
    const upstream = await fetchImpl(platformRequestUrl, upstreamInit);
    const portalOrigin = new URL(request.url).origin;
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: proxyResponseHeaders(upstream, platformOrigin, platformRequestUrl, portalOrigin),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Platform proxy failed.";
    console.error("Platform proxy request failed:", message);
    return Response.json(
      {
        error: {
          code: "PLATFORM_PROXY_UNAVAILABLE",
          message: "The Audentra platform is temporarily unavailable.",
        },
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
