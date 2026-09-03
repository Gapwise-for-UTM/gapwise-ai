import type { VerifiedCaller } from "@/src/auth/verify";
import { getRuntimeConfig } from "@/src/config";
import { withUpstreamDeadline } from "@/src/http/upstream";

export type AiAccessEventType =
  | "authorized"
  | "revoked"
  | "context_read"
  | "action_queued"
  | "action_applied"
  | "action_rejected";

/**
 * Records only minimal activity metadata through Gapwise's caller-bound RPC.
 * The database function derives the user from auth.uid(), and delegated sessions
 * derive the client name from the JWT client_id plus the user's approval row.
 */
export async function recordAiAccessEvent(
  caller: VerifiedCaller,
  eventType: AiAccessEventType,
  options: { clientName?: string; capability?: string } = {},
): Promise<void> {
  const config = getRuntimeConfig();
  await withUpstreamDeadline(async (signal) => {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/record_ai_access_event`, {
      method: "POST",
      cache: "no-store",
      signal,
      headers: {
        apikey: config.supabasePublishableKey,
        Authorization: `Bearer ${caller.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_event_type: eventType,
        p_client_name: options.clientName ?? null,
        p_capability: options.capability ?? null,
      }),
    });
    if (!response.ok) throw new Error(`AI access audit write failed with status ${response.status}.`);
  });
}
