import { handlePatchOperations } from "../../../_runtime.js";

type RouteContext = {
  params: Promise<{ draftRevisionId: string }> | { draftRevisionId: string };
};

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const params = await context.params;
  return handlePatchOperations(request, params.draftRevisionId);
}
