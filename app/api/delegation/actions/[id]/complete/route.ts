import { apiError, browserCaller, jsonResponse, optionsResponse, readJson } from "@/src/http/api";
import { completeAction } from "@/src/delegation/service";

export function OPTIONS(request: Request) {
  return optionsResponse(request, ["POST"]);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await browserCaller(request);
    if ("response" in auth) return auth.response;
    const { id } = await context.params;
    const value = await readJson(request);
    return jsonResponse(request, await completeAction(auth.caller, id, value));
  } catch (error) {
    return apiError(request, error);
  }
}
