import { proxyInternal } from "../../upstream";

const SAFE_TRACE_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ traceId: string }> },
): Promise<Response> {
  const { traceId } = await params;
  if (!SAFE_TRACE_ID.test(traceId)) {
    return Response.json(
      { error: { code: "INVALID_TRACE_ID", message: "Malformed trace id" } },
      { status: 400 },
    );
  }
  return proxyInternal(`/internal/assistant/traces/${encodeURIComponent(traceId)}`);
}
