import { proxyInternal } from "../upstream";

export async function GET(request: Request): Promise<Response> {
  const limit = new URL(request.url).searchParams.get("limit");
  const bounded = Math.max(1, Math.min(Number(limit) || 20, 50));
  return proxyInternal(`/internal/assistant/traces?limit=${bounded}`);
}
