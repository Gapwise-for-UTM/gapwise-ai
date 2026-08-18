import { z } from "zod";
import { apiError, browserCaller, jsonResponse, optionsResponse, readJson } from "@/src/http/api";
import {
  RestRequestError,
  deleteAllApprovedOAuthClients,
  insertApprovedOAuthClient,
  listApprovedOAuthClients,
} from "@/src/db/supabase-rest";

const ApprovalSchema = z
  .object({
    clientId: z.string().min(1).max(512),
    clientName: z.string().min(1).max(240),
  })
  .strict();

export function OPTIONS(request: Request) {
  return optionsResponse(request, ["GET", "POST", "DELETE"]);
}

export async function GET(request: Request) {
  try {
    const auth = await browserCaller(request);
    if ("response" in auth) return auth.response;
    const clients = await listApprovedOAuthClients(auth.caller);
    return jsonResponse(request, {
      clients: clients.map((client) => ({
        clientId: client.client_id,
        clientName: client.client_name,
        createdAt: client.created_at,
      })),
    });
  } catch (error) {
    return apiError(request, error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await browserCaller(request);
    if ("response" in auth) return auth.response;
    const parsed = ApprovalSchema.safeParse(await readJson(request));
    if (!parsed.success) return jsonResponse(request, { error: "invalid_data" }, 400);
    try {
      await insertApprovedOAuthClient(auth.caller, parsed.data.clientId, parsed.data.clientName);
    } catch (error) {
      // Re-approving the same client is idempotent. The browser cannot update an
      // approval row, and an OAuth token cannot create one under RLS.
      if (!(error instanceof RestRequestError) || error.status !== 409) throw error;
    }
    return jsonResponse(request, { approved: true, clientId: parsed.data.clientId });
  } catch (error) {
    return apiError(request, error);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await browserCaller(request);
    if ("response" in auth) return auth.response;
    const clients = await listApprovedOAuthClients(auth.caller);
    await deleteAllApprovedOAuthClients(auth.caller);
    return jsonResponse(request, {
      revoked: true,
      clientIds: clients.map((client) => client.client_id),
    });
  } catch (error) {
    return apiError(request, error);
  }
}
