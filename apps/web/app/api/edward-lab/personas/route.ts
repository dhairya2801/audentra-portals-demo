import { proxyInternal } from "../upstream";

export async function GET(): Promise<Response> {
  return proxyInternal("/internal/assistant/dev/personas");
}
