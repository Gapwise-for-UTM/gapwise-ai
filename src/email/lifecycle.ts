import type { VerifiedCaller } from "@/src/auth/verify";
import { getRuntimeConfig } from "@/src/config";
import { withUpstreamDeadline } from "@/src/http/upstream";

export async function sendAiLifecycleNotice(
  caller: VerifiedCaller,
  event: "ai_authorized" | "ai_revoked",
  clientName: string,
): Promise<void> {
  const config = getRuntimeConfig();
  await withUpstreamDeadline(async (signal) => {
    const response = await fetch(`${config.supabaseUrl}/functions/v1/lifecycle-email`, {
      method: "POST",
      cache: "no-store",
      signal,
      headers: {
        apikey: config.supabasePublishableKey,
        Authorization: `Bearer ${caller.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event, clientName }),
    });
    if (!response.ok) throw new Error(`Lifecycle notice failed with status ${response.status}.`);
  });
}
