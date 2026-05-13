import { handlePostLayoutIntentValidate } from "../../../_runtime.js";

type RouteContext = {
  params: Promise<{ layoutIntentRevisionId: string }> | { layoutIntentRevisionId: string };
};

export async function POST(_request: Request, context: RouteContext): Promise<Response> {
  const params = await context.params;
  return handlePostLayoutIntentValidate(params.layoutIntentRevisionId);
}
