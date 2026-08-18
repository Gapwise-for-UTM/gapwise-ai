import { apiError, browserCaller, jsonResponse, optionsResponse } from "@/src/http/api";
import { delegationStatus, revokeDelegation } from "@/src/delegation/service";

export function OPTIONS(request: Request) {
  return optionsResponse(request, ["GET", "DELETE"]);
}

export async function GET(request: Request) {
  try {
    const auth = await browserCaller(request);
    if ("response" in auth) return auth.response;
    return jsonResponse(request, await delegationStatus(auth.caller));
  } catch (error) {
    return apiError(request, error);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await browserCaller(request);
    if ("response" in auth) return auth.response;
    return jsonResponse(request, await revokeDelegation(auth.caller));
  } catch (error) {
    return apiError(request, error);
  }
}
