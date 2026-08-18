import { apiError, browserCaller, jsonResponse, optionsResponse } from "@/src/http/api";
import { pendingActions } from "@/src/delegation/service";

export function OPTIONS(request: Request) {
  return optionsResponse(request, ["GET"]);
}

export async function GET(request: Request) {
  try {
    const auth = await browserCaller(request);
    if ("response" in auth) return auth.response;
    return jsonResponse(request, { actions: await pendingActions(auth.caller) });
  } catch (error) {
    return apiError(request, error);
  }
}
