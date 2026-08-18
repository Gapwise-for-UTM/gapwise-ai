import { describe, expect, it } from "vitest";
import {
  accessTokenTargetsResource,
  oauthClientIdFromAccessToken,
} from "@/src/auth/verify";

function unsignedTestToken(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

const MCP_RESOURCE = "https://ai.gapwise.ca/api/mcp";

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

describe("MCP OAuth resource binding", () => {
  it("accepts the canonical resource claim", () => {
    expect(
      accessTokenTargetsResource(unsignedTestToken({ resource: MCP_RESOURCE }), MCP_RESOURCE),
    ).toBe(true);
  });

  it("accepts an audience containing the canonical resource", () => {
    expect(
      accessTokenTargetsResource(
        unsignedTestToken({ aud: ["authenticated", MCP_RESOURCE] }),
        MCP_RESOURCE,
      ),
    ).toBe(true);
  });

  it("rejects a generic Supabase audience with no MCP resource binding", () => {
    expect(
      accessTokenTargetsResource(unsignedTestToken({ aud: "authenticated" }), MCP_RESOURCE),
    ).toBe(false);
  });

  it("rejects tokens targeted at a different resource", () => {
    expect(
      accessTokenTargetsResource(
        unsignedTestToken({ resource: "https://example.com/api/mcp" }),
        MCP_RESOURCE,
      ),
    ).toBe(false);
    expect(accessTokenTargetsResource("not-a-jwt", MCP_RESOURCE)).toBe(false);
  });
});
