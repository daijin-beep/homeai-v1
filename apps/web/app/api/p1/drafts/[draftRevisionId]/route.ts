import { handleGetDraft } from "../../_runtime.js";

type RouteContext = {
  params: Promise<{ draftRevisionId: string }> | { draftRevisionId: string };
};

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const params = await context.params;
  return handleGetDraft(params.draftRevisionId);
}
