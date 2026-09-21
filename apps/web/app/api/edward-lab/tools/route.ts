import { proxyInternal } from "../upstream";

/** Both tool catalogues, exactly as the planners are prompted with them. */
export async function GET(): Promise<Response> {
  return proxyInternal("/internal/assistant/dev/tools");
}
