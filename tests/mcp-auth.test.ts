import { describe, expect, it } from "vitest";
import {
  MCP_RESOURCE_METADATA_URL,
  OPENAI_TOOL_META,
  mcpAuthenticationRequired,
} from "@/src/auth/mcp";

describe("OpenAI MCP tool authentication metadata", () => {
  it("advertises OAuth without inventing unsupported Supabase custom scopes", () => {
    expect(OPENAI_TOOL_META).toEqual({
      securitySchemes: [{ type: "oauth2", scopes: [] }],
    });
  });

  it("returns an in-band MCP authentication challenge", () => {
    const result = mcpAuthenticationRequired();
    expect(result.isError).toBe(true);
    expect(result._meta["mcp/www_authenticate"]).toEqual([
      `Bearer resource_metadata="${MCP_RESOURCE_METADATA_URL}", error="invalid_token", error_description="Connect your Gapwise account to continue"`,
    ]);
  });
});
