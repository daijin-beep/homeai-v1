import { handleGetVerificationRequest } from "../../render/_runtime.js";

interface RouteContext {
  params: Promise<{ candidateId: string }>;
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { candidateId } = await context.params;
  return handleGetVerificationRequest(candidateId);
}
