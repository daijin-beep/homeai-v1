import { handleUserBetaUpload } from "../../../_user_beta_runtime.js";

type RouteContext = {
  params: Promise<{ homeId: string }> | { homeId: string };
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const params = await context.params;
  return handleUserBetaUpload(request, params.homeId);
}
