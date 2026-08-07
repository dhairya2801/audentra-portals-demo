import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use the installed TypeScript compiler API. Next 16.3's CLI config parser
  // can receive non-JSON process output in workspace builds on Vercel.
  experimental: {
    useTypeScriptCli: false,
  },
};

export default nextConfig;
