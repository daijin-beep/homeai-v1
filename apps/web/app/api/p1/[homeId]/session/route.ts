import { handlePostSession } from "../../_runtime.js";

type RouteContext = {
  params: Promise<{ homeId: string }> | { homeId: string };
};

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const params = await context.params;
  return handlePostSession(request, params.homeId);
}
