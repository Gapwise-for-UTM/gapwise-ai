import type { VerifiedCaller } from "@/src/auth/verify";
import { getRuntimeConfig } from "@/src/config";
import { withUpstreamDeadline } from "@/src/http/upstream";

export async function deleteApprovedOAuthClient(
  caller: VerifiedCaller,
  clientId: string,
): Promise<void> {
  const config = getRuntimeConfig();
  const userFilter = `user_id=eq.${encodeURIComponent(caller.userId)}`;
  const clientFilter = `client_id=eq.${encodeURIComponent(clientId)}`;

  await withUpstreamDeadline(async (signal) => {
    const response = await fetch(
      `${config.supabaseUrl}/rest/v1/ai_oauth_clients?${userFilter}&${clientFilter}`,
      {
        method: "DELETE",
        cache: "no-store",
        signal,
        headers: {
          apikey: config.supabasePublishableKey,
          Authorization: `Bearer ${caller.accessToken}`,
          Accept: "application/json",
          Prefer: "return=minimal",
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Targeted OAuth client rollback failed with status ${response.status}.`);
    }
  });
}
