import { afterEach, describe, expect, it, vi } from "vitest";
import type { VerifiedCaller } from "@/src/auth/verify";
import { deleteApprovedOAuthClient } from "@/src/db/oauth-client-rollback";

vi.mock("@/src/config", () => ({
  getRuntimeConfig: () => ({
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "sb_publishable_test_key_1234567890",
  }),
}));

const caller: VerifiedCaller = {
  userId: "11111111-1111-4111-8111-111111111111",
  accessToken: "browser-access-token",
  expiresAt: 4_000_000_000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("targeted OAuth client rollback", () => {
  it("deletes only the exact user/client approval row", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await deleteApprovedOAuthClient(caller, "client/with spaces");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://example.supabase.co/rest/v1/ai_oauth_clients?user_id=eq.11111111-1111-4111-8111-111111111111&client_id=eq.client%2Fwith%20spaces",
    );
    expect(init.method).toBe("DELETE");
    expect(init.headers).toMatchObject({
      apikey: "sb_publishable_test_key_1234567890",
      Authorization: "Bearer browser-access-token",
      Prefer: "return=minimal",
    });
  });

  it("fails closed when Supabase rejects the targeted delete", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));

    await expect(deleteApprovedOAuthClient(caller, "client-1")).rejects.toThrow(
      "Targeted OAuth client rollback failed with status 403.",
    );
  });
});
