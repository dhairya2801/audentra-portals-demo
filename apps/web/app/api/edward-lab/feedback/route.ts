import { proxyInternal } from "../upstream";

const ASSISTANT_KINDS = new Set(["student", "staff"]);
const RATINGS = new Set(["positive", "negative", "unrated"]);

export async function GET(request: Request): Promise<Response> {
  const source = new URL(request.url).searchParams;
  const target = new URLSearchParams();
  const assistantKind = source.get("assistantKind");
  const rating = source.get("rating");
  const hasWritten = source.get("hasWritten");
  if (assistantKind && ASSISTANT_KINDS.has(assistantKind)) {
    target.set("assistantKind", assistantKind);
  }
  if (rating && RATINGS.has(rating)) target.set("rating", rating);
  if (hasWritten === "true" || hasWritten === "false") {
    target.set("hasWritten", hasWritten);
  }
  for (const key of ["from", "to"] as const) {
    const value = source.get(key);
    if (value && !Number.isNaN(Date.parse(value))) target.set(key, value);
  }
  const search = source.get("search")?.trim();
  if (search) target.set("search", search.slice(0, 200));
  const limit = Math.max(1, Math.min(Number(source.get("limit")) || 50, 200));
  const offset = Math.max(0, Number(source.get("offset")) || 0);
  target.set("limit", String(limit));
  target.set("offset", String(offset));
  return proxyInternal(`/internal/assistant/feedback?${target.toString()}`);
}
