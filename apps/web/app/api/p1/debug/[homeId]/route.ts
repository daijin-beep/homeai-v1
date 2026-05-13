import { handleGetDebug } from "../../_runtime.js";

type RouteContext = {
  params: Promise<{ homeId: string }> | { homeId: string };
};

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const params = await context.params;
  return handleGetDebug(params.homeId);
}
