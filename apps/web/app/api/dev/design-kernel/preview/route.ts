import { DesignKernelPreviewRequestSchema } from "@homeai/contracts";
import { buildDesignKernelDebugPayload } from "@homeai/design-kernel";

export async function POST(request: Request): Promise<Response> {
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
