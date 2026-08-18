import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson, parseDataKey } from "@/src/crypto/envelope";

const key = Buffer.alloc(32, 7).toString("base64url");

describe("AI data envelopes", () => {
  it("round-trips authenticated JSON", () => {
    const value = { schedule: [{ id: "CSC110" }], revision: 4 };
    const encrypted = encryptJson(key, "snapshot", "00000000-0000-4000-8000-000000000001", 4, value);
    expect(encrypted.ciphertext).not.toContain("CSC110");
    expect(
      decryptJson(key, "snapshot", "00000000-0000-4000-8000-000000000001", 4, encrypted),
    ).toEqual(value);
  });

  it("fails authentication when revision/AAD changes", () => {
    const encrypted = encryptJson(key, "snapshot", "00000000-0000-4000-8000-000000000001", 4, { ok: true });
    expect(() =>
      decryptJson(key, "snapshot", "00000000-0000-4000-8000-000000000001", 5, encrypted),
    ).toThrow();
  });

  it("fails authentication on tampering", () => {
    const encrypted = encryptJson(key, "action", "00000000-0000-4000-8000-000000000001", 2, { ok: true });
    const bytes = Buffer.from(encrypted.ciphertext, "base64url");
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    expect(() =>
      decryptJson(key, "action", "00000000-0000-4000-8000-000000000001", 2, {
        ...encrypted,
        ciphertext: bytes.toString("base64url"),
      }),
    ).toThrow();
  });

  it("requires exactly 32 key bytes", () => {
    expect(parseDataKey(key)).toHaveLength(32);
    expect(() => parseDataKey(Buffer.alloc(31).toString("base64url"))).toThrow();
  });
});
