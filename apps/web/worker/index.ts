/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { proxyPlatformRequest } from "./platform-proxy";

interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS?: AssetFetcher;
  API_PROXY_ORIGIN?: string;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  PLATFORM_API_ALLOW_UNAUTHENTICATED?: string;
  PLATFORM_API_AUDIENCE?: string;
  PLATFORM_API_AUTH_MODE?: string;
  PLATFORM_API_ORIGIN?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env?: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const assets = env?.ASSETS;
    const images = env?.IMAGES;

    if (url.pathname === "/_vinext/image" && assets && images) {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => assets.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await images.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    // Intercept the application API before Vinext/App Router inspects the
    // request. This preserves streaming uploads and SSE responses while the
    // portal keeps the browser session first-party.
    if (url.pathname === "/v1" || url.pathname.startsWith("/v1/")) {
      return proxyPlatformRequest(request, {
        environment: {
          API_PROXY_ORIGIN: env?.API_PROXY_ORIGIN ?? process.env.API_PROXY_ORIGIN,
          NODE_ENV: process.env.NODE_ENV,
          PLATFORM_API_ALLOW_UNAUTHENTICATED:
            env?.PLATFORM_API_ALLOW_UNAUTHENTICATED ??
            process.env.PLATFORM_API_ALLOW_UNAUTHENTICATED,
          PLATFORM_API_AUDIENCE:
            env?.PLATFORM_API_AUDIENCE ?? process.env.PLATFORM_API_AUDIENCE,
          PLATFORM_API_AUTH_MODE:
            env?.PLATFORM_API_AUTH_MODE ?? process.env.PLATFORM_API_AUTH_MODE,
          PLATFORM_API_ORIGIN:
            env?.PLATFORM_API_ORIGIN ?? process.env.PLATFORM_API_ORIGIN,
        },
      });
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
