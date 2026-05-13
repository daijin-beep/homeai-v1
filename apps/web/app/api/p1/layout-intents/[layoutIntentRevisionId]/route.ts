import { handleGetLayoutIntent } from "../../_runtime.js";

type RouteContext = {
  params: Promise<{ layoutIntentRevisionId: string }> | { layoutIntentRevisionId: string };
};

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const params = await context.params;
  return handleGetLayoutIntent(params.layoutIntentRevisionId);
}
