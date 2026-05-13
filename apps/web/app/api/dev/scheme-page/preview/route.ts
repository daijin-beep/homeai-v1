import { SchemePagePreviewRequestSchema } from "@homeai/contracts";
import { buildSchemePageDebugPayload } from "@homeai/scheme-page";

export async function POST(request: Request): Promise<Response> {
  if (isDevRouteDisabledInProduction()) {
    return new Response(null, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = SchemePagePreviewRequestSchema.parse(body);
    const debug = buildSchemePageDebugPayload(parsed);
    return Response.json({ ok: true, debug });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown scheme page preview error"
      },
      { status: 400 }
    );
  }
}

function isDevRouteDisabledInProduction(): boolean {
  return process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_ROUTES !== "true";
}
