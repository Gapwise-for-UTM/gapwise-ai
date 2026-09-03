import { describe, expect, it } from "vitest";
import type { VerifiedCaller } from "@/src/auth/verify";
import { OwnershipBoundaryError, assertOwnedRows } from "@/src/db/supabase-rest";

const alice: VerifiedCaller = {
  userId: "11111111-1111-4111-8111-111111111111",
  accessToken: "alice-token",
  expiresAt: 4_000_000_000,
};

const bobId = "22222222-2222-4222-8222-222222222222";

describe("AI REST ownership boundary", () => {
  it("accepts only rows owned by the authenticated caller", () => {
    const rows = [
      { user_id: alice.userId, value: "one" },
      { user_id: alice.userId, value: "two" },
    ];

    expect(assertOwnedRows(alice, rows)).toBe(rows);
  });

  it("fails closed if an upstream/RLS regression returns another user's row", () => {
    expect(() =>
      assertOwnedRows(alice, [
        { user_id: alice.userId, value: "allowed" },
        { user_id: bobId, value: "must never cross the boundary" },
      ]),
    ).toThrow(OwnershipBoundaryError);
  });

  it("does not treat an empty result as an ownership failure", () => {
    expect(assertOwnedRows(alice, [])).toEqual([]);
  });
});
