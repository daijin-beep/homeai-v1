import { handleCreateRenderJobRequest } from "../render/_runtime.js";

export async function POST(request: Request): Promise<Response> {
  return handleCreateRenderJobRequest(request);
}
