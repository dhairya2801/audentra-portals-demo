import type { NextConfig } from "next";

type AudentraNextConfig = NextConfig & {
  experimental?: NonNullable<NextConfig["experimental"]> & { useTypeScriptCli?: boolean };
};

// Origin of the hosted Audentra API, proxied rather than called directly.
// The platform issues host-only `SameSite=lax` session cookies, so a browser
// only keeps a session when the portal and the API answer on one origin. On a
// deployment whose portal host is not also the API host, setting this makes
// the browser talk exclusively to the portal origin: the cookie is
// first-party, and CORS never enters the picture. Leave it unset wherever
// Caddy already fronts both on one hostname, and leave
// NEXT_PUBLIC_API_BASE_URL unset alongside it so `api-client.ts` falls back to
// same-origin relative paths.
const apiProxyOrigin = process.env.API_PROXY_ORIGIN?.trim().replace(/\/+$/, "");

const nextConfig: AudentraNextConfig = {
  experimental: {
    // Preserve the deployed Vercel workspace compiler configuration.
    useTypeScriptCli: false,
    // Vinext inspects multipart POSTs as possible progressive Server Actions
    // before applying external rewrites. Keep that transport ceiling above the
    // platform's 10 MiB per-document contract so the API, rather than the
    // portal proxy, remains authoritative for upload validation.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  async rewrites() {
    if (!apiProxyOrigin) return [];

    // Mirrors the route split in infra/preview-vm/Caddyfile so both edges
    // expose the same paths.
    return [
      { source: "/v1/:path*", destination: `${apiProxyOrigin}/v1/:path*` },
      { source: "/health", destination: `${apiProxyOrigin}/health` },
      { source: "/health/:path*", destination: `${apiProxyOrigin}/health/:path*` },
    ];
  },
};

export default nextConfig;
