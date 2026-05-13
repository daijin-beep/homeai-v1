import { handlePostRecomputeBoundaries } from "../../../_runtime.js";

type RouteContext = {
  params: Promise<{ draftRevisionId: string }> | { draftRevisionId: string };
};

export async function POST(_request: Request, context: RouteContext): Promise<Response> {
  const params = await context.params;
  return handlePostRecomputeBoundaries(params.draftRevisionId);
}
