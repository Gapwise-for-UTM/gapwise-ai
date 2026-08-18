import { describe, expect, it } from "vitest";
import { oauthClientIdFromAccessToken } from "@/src/auth/verify";

function unsignedTestToken(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

describe("OAuth client claim parsing", () => {
  it("extracts a non-empty OAuth client id", () => {
    expect(oauthClientIdFromAccessToken(unsignedTestToken({ client_id: "claude-client" }))).toBe(
      "claude-client",
    );
  });

  it("does not classify ordinary browser tokens as OAuth client tokens", () => {
    expect(oauthClientIdFromAccessToken(unsignedTestToken({ sub: "user" }))).toBeNull();
    expect(oauthClientIdFromAccessToken(unsignedTestToken({ client_id: "" }))).toBeNull();
    expect(oauthClientIdFromAccessToken("not-a-jwt")).toBeNull();
  });
});
