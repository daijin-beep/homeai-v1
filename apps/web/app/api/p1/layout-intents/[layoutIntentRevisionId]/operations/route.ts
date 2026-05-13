import { handlePatchLayoutIntentOperations } from "../../../_runtime.js";

type RouteContext = {
  params: Promise<{ layoutIntentRevisionId: string }> | { layoutIntentRevisionId: string };
};

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const params = await context.params;
  return handlePatchLayoutIntentOperations(request, params.layoutIntentRevisionId);
}
