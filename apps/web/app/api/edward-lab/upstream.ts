/**
 * Server-side proxy plumbing for the Edward Lab.
 *
 * The platform's trace and persona endpoints are protected by the internal
 * worker token, which must never reach the browser. These helpers run only
 * inside route handlers: they resolve the API origin and credential from
 * server-side environment variables and forward the request.
 *
 * Every handler is double-gated: the Lab flag must be on (404 otherwise),
 * and the upstream still enforces its own ASSISTANT_TRACE_DEBUG_ENABLED
 * gate + worker token, so a misconfigured portal cannot open traces up.
 */

import { edwardLabEnabled } from "../../lib/edward-lab";

const LOCAL_DEV_WORKER_TOKEN = "local-development-document-worker-token";

export function labEnabled(): boolean {
  return edwardLabEnabled({
    NEXT_PUBLIC_EDWARD_DEBUG_ENABLED: process.env.NEXT_PUBLIC_EDWARD_DEBUG_ENABLED,
    NODE_ENV: process.env.NODE_ENV,
  });
}

function apiOrigin(): string {
  const configured =
    process.env.EDWARD_LAB_API_ORIGIN?.trim() ||
    process.env.API_PROXY_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return (configured || "http://localhost:4000").replace(/\/+$/, "");
}

function workerToken(): string {
  const configured =
    process.env.EDWARD_LAB_WORKER_TOKEN?.trim() || process.env.DOCUMENT_WORKER_TOKEN?.trim();
  if (configured) return configured;
  // The platform's documented local-development default; only ever used from
  // this server-side module, and only useful against a dev-configured API.
  return process.env.NODE_ENV === "development" ? LOCAL_DEV_WORKER_TOKEN : "";
}

/** Forward one internal request; mirror upstream status and JSON body. */
export async function proxyInternal(path: string, init?: { method?: string }): Promise<Response> {
  if (!labEnabled()) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: "Not found" } },
      { status: 404 },
    );
  }
  const token = workerToken();
  if (!token) {
    return Response.json(
      {
        error: {
          code: "EDWARD_LAB_NOT_CONFIGURED",
          message:
            "Set EDWARD_LAB_WORKER_TOKEN (or DOCUMENT_WORKER_TOKEN) for the portal server " +
            "so the Lab can reach the platform's internal trace endpoints.",
        },
      },
      { status: 503 },
    );
  }
  try {
    const upstream = await fetch(`${apiOrigin()}${path}`, {
      method: init?.method ?? "GET",
      headers: { "x-vv-worker-token": token, accept: "application/json" },
      cache: "no-store",
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return Response.json(
      {
        error: {
          code: "EDWARD_LAB_UPSTREAM_UNREACHABLE",
          message: `The platform API was not reachable at ${apiOrigin()}. Is it running?`,
        },
      },
      { status: 502 },
    );
  }
}
