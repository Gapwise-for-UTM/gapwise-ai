import { describe, expect, it } from "vitest";
import { normalizeOpenAiAppsChallengeToken } from "@/src/openai/challenge";

describe("OpenAI Apps domain challenge token", () => {
  it("returns a trimmed valid token", () => {
    expect(normalizeOpenAiAppsChallengeToken("  challenge-token_123  ")).toBe(
      "challenge-token_123",
    );
  });

  it("rejects missing and control-character values", () => {
    expect(normalizeOpenAiAppsChallengeToken(undefined)).toBeNull();
    expect(normalizeOpenAiAppsChallengeToken("   ")).toBeNull();
    expect(normalizeOpenAiAppsChallengeToken("token\nsecond-line")).toBeNull();
  });

  it("rejects unreasonably large values", () => {
    expect(normalizeOpenAiAppsChallengeToken("x".repeat(2049))).toBeNull();
  });
});
