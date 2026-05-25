import { buildUserBetaBootstrap } from "../../_user_beta_runtime.js";

type RouteContext = {
  params: Promise<{ homeId: string }> | { homeId: string };
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const params = await context.params;
  return Response.json(buildUserBetaBootstrap(params.homeId));
}
