import { handleStartRenderJobRequest } from "../../../render/_runtime.js";

interface RouteContext {
  params: Promise<{ renderJobId: string }>;
}

export async function POST(_request: Request, context: RouteContext): Promise<Response> {
  const { renderJobId } = await context.params;
  return handleStartRenderJobRequest(renderJobId);
}
