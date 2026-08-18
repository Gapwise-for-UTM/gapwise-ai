import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  MCP_REQUIRED_SCOPES,
  MCP_RESOURCE_METADATA_URL,
  OPENAI_TOOL_META,
  installToolSecuritySchemeProjection,
  mcpAuthenticationRequired,
} from "@/src/auth/mcp";

describe("OpenAI MCP tool authentication metadata", () => {
  it("advertises the minimal supported identity scope", () => {
    expect(OPENAI_TOOL_META).toEqual({
      securitySchemes: [{ type: "oauth2", scopes: ["email"] }],
    });
    expect(MCP_REQUIRED_SCOPES).toEqual(["email"]);
  });

  it("returns an in-band MCP authentication challenge with discovery and scope", () => {
    const result = mcpAuthenticationRequired();
    expect(result.isError).toBe(true);
    expect(result._meta["mcp/www_authenticate"][0]).toContain(
      `resource_metadata="${MCP_RESOURCE_METADATA_URL}"`,
    );
    expect(result._meta["mcp/www_authenticate"][0]).toContain('scope="email"');
    expect(result._meta["mcp/www_authenticate"][0]).toContain('error="invalid_token"');
    expect(result._meta["mcp/www_authenticate"][0]).toContain("error_description=");
  });

  it("projects SDK _meta security schemes to the root tools/list definition", () => {
    let toolsList: (() => unknown) | undefined;
    const setRequestHandler = vi.fn((method: string, handler: () => unknown) => {
      if (method === "tools/list") toolsList = handler;
    });
    const fakeServer = {
      _registeredTools: {
        get_my_day: {
          enabled: true,
          title: "Get my Gapwise day",
          description: "Test",
          inputSchema: z.object({ date: z.string() }).strict(),
          annotations: { readOnlyHint: true },
          _meta: OPENAI_TOOL_META,
        },
      },
      server: { setRequestHandler },
    };

    installToolSecuritySchemeProjection(fakeServer);
    expect(setRequestHandler).toHaveBeenCalledWith("tools/list", expect.any(Function));
    expect(toolsList).toBeTypeOf("function");

    const result = toolsList!() as {
      tools: Array<Record<string, unknown>>;
    };
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0]?.["securitySchemes"]).toEqual([
      { type: "oauth2", scopes: ["email"] },
    ]);
    expect((result.tools[0]?.["_meta"] as Record<string, unknown>)["securitySchemes"]).toEqual([
      { type: "oauth2", scopes: ["email"] },
    ]);
  });
});
