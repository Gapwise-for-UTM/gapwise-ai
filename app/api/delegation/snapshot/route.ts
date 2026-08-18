import { apiError, browserCaller, jsonResponse, optionsResponse, readJson } from "@/src/http/api";
import { publishSnapshot } from "@/src/delegation/service";

export function OPTIONS(request: Request) {
  return optionsResponse(request, ["PUT"]);
}

export async function PUT(request: Request) {
  try {
    const auth = await browserCaller(request);
    if ("response" in auth) return auth.response;
    const value = await readJson(request);
    return jsonResponse(request, await publishSnapshot(auth.caller, value));
  } catch (error) {
    return apiError(request, error);
  }
}
