import { DesignKernelPreviewRequestSchema } from "@homeai/contracts";
import { buildDesignKernelDebugPayload } from "@homeai/design-kernel";

export async function POST(request: Request): Promise<Response> {
  if (isDevRouteDisabledInProduction()) {
    return new Response(null, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = DesignKernelPreviewRequestSchema.parse(body);
    const debug = buildDesignKernelDebugPayload(parsed.input);
    return Response.json({ ok: true, debug });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown design kernel preview error"
      },
      { status: 400 }
    );
  }
}

function isDevRouteDisabledInProduction(): boolean {
  return process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_ROUTES !== "true";
}
