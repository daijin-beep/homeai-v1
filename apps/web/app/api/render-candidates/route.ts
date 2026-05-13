import { handleListCandidatesRequest } from "../render/_runtime.js";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  return handleListCandidatesRequest(url);
}
