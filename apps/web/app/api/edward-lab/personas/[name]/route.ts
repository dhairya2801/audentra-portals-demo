import { proxyInternal } from "../../upstream";

const SAFE_PERSONA = /^[a-z0-9_]{1,64}$/;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  const { name } = await params;
  if (!SAFE_PERSONA.test(name)) {
    return Response.json(
      { error: { code: "INVALID_PERSONA", message: "Malformed persona name" } },
      { status: 400 },
    );
  }
  return proxyInternal(`/internal/assistant/dev/personas/${encodeURIComponent(name)}`, {
    method: "POST",
  });
}
