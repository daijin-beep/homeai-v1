import { handleGetRenderJobRequest } from "../../render/_runtime.js";

interface RouteContext {
  params: Promise<{ renderJobId: string }>;
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { renderJobId } = await context.params;
  return handleGetRenderJobRequest(renderJobId);
}
