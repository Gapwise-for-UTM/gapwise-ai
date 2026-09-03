import { z } from "zod";
import { apiError, browserCaller, jsonResponse, optionsResponse, readJson } from "@/src/http/api";
import { recordAiAccessEvent } from "@/src/db/ai-access-events";
import { sendAiLifecycleNotice } from "@/src/email/lifecycle";
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

function reportAuditFailure(error: unknown) {
  console.error("ai_access_audit_failed", error instanceof Error ? error.message : "unknown");
}

function reportNoticeFailure(error: unknown) {
  console.error("ai_access_notice_failed", error instanceof Error ? error.message : "unknown");
}

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
    let inserted = false;
    try {
      await insertApprovedOAuthClient(auth.caller, parsed.data.clientId, parsed.data.clientName);
      inserted = true;
    } catch (error) {
      // Re-approving the same client is idempotent. The browser cannot update an
      // approval row, and an OAuth token cannot create one under RLS.
      if (!(error instanceof RestRequestError) || error.status !== 409) throw error;
    }
    if (inserted) {
      await Promise.all([
        recordAiAccessEvent(auth.caller, "authorized", { clientName: parsed.data.clientName }).catch(
          reportAuditFailure,
        ),
        sendAiLifecycleNotice(auth.caller, "ai_authorized", parsed.data.clientName).catch(
          reportNoticeFailure,
        ),
      ]);
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
    await Promise.all(
      clients.flatMap((client) => [
        recordAiAccessEvent(auth.caller, "revoked", { clientName: client.client_name }).catch(
          reportAuditFailure,
        ),
        sendAiLifecycleNotice(auth.caller, "ai_revoked", client.client_name).catch(
          reportNoticeFailure,
        ),
      ]),
    );
    return jsonResponse(request, {
      revoked: true,
      clientIds: clients.map((client) => client.client_id),
    });
  } catch (error) {
    return apiError(request, error);
  }
}
