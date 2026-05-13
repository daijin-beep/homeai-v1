import { handleGetCanonical } from "../../_runtime.js";

type RouteContext = {
  params: Promise<{ canonicalRevisionId: string }> | { canonicalRevisionId: string };
};

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const params = await context.params;
  return handleGetCanonical(params.canonicalRevisionId);
}
