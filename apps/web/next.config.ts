import type { NextConfig } from "next";

type AudentraNextConfig = NextConfig & {
  experimental?: NonNullable<NextConfig["experimental"]> & {
    useTypeScriptCli?: boolean;
  };
};

const nextConfig: AudentraNextConfig = {
  // Use the installed TypeScript compiler API. Next 16.3's CLI config parser
  // can receive non-JSON process output in workspace builds on Vercel.
  experimental: {
    useTypeScriptCli: false,
    // Keep the framework ceiling above the platform's 10 MiB per-document
    // contract. Hosted /v1 uploads are intercepted and streamed by the worker
    // before App Router, while ordinary application actions retain this guard.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
