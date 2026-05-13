import { handleGetSceneContract } from "../../_runtime.js";

type RouteContext = {
  params: Promise<{ sceneContractId: string }> | { sceneContractId: string };
};

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const params = await context.params;
  return handleGetSceneContract(params.sceneContractId);
}
