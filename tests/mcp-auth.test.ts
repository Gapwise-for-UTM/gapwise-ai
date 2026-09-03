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
  it("advertises the minimal supported identity scope for private tools", () => {
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

  it("projects OAuth metadata only onto protected tools and preserves exact safety annotations", () => {
    let toolsList: (() => unknown) | undefined;
    const setRequestHandler = vi.fn((method: string, handler: () => unknown) => {
      if (method === "tools/list") toolsList = handler;
    });
    const fakeServer = {
      _registeredTools: {
        list_utm_buildings: {
          enabled: true,
          title: "List UTM buildings known to Gapwise",
          description: "Public campus data",
          inputSchema: z.object({}).strict(),
          annotations: { readOnlyHint: true, openWorldHint: false },
        },
        get_my_day: {
          enabled: true,
          title: "Get my Gapwise day",
          description: "Private schedule data",
          inputSchema: z.object({ date: z.string() }).strict(),
          annotations: { readOnlyHint: true, openWorldHint: false },
          _meta: OPENAI_TOOL_META,
        },
        create_personal_item: {
          enabled: true,
          title: "Create a personal Gapwise timetable item",
          description: "Queue a personal item",
          inputSchema: z.object({ expectedRevision: z.number() }).strict(),
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
          _meta: OPENAI_TOOL_META,
        },
        delete_personal_item: {
          enabled: true,
          title: "Delete a personal Gapwise timetable item",
          description: "Queue deletion of a personal item",
          inputSchema: z.object({ expectedRevision: z.number(), itemId: z.string() }).strict(),
          annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: false,
          },
          _meta: OPENAI_TOOL_META,
        },
      },
      server: { setRequestHandler },
    };

    installToolSecuritySchemeProjection(fakeServer);
    expect(setRequestHandler).toHaveBeenCalledWith("tools/list", expect.any(Function));
    expect(toolsList).toBeTypeOf("function");

    const result = toolsList!() as { tools: Array<Record<string, unknown>> };
    expect(result.tools).toHaveLength(4);

    const byName = (name: string) => result.tools.find((tool) => tool["name"] === name);
    const publicTool = byName("list_utm_buildings");
    const privateTool = byName("get_my_day");
    const createTool = byName("create_personal_item");
    const deleteTool = byName("delete_personal_item");

    expect(publicTool?.["securitySchemes"]).toBeUndefined();
    expect(publicTool?.["_meta"]).toBeUndefined();
    expect(publicTool?.["annotations"]).toEqual({
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    });

    expect(privateTool?.["securitySchemes"]).toEqual([
      { type: "oauth2", scopes: ["email"] },
    ]);
    expect((privateTool?.["_meta"] as Record<string, unknown>)["securitySchemes"]).toEqual([
      { type: "oauth2", scopes: ["email"] },
    ]);
    expect(privateTool?.["annotations"]).toEqual({
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    });
    expect(createTool?.["annotations"]).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    });
    expect(deleteTool?.["annotations"]).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    });
  });
});
