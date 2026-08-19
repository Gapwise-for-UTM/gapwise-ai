import { z } from "zod";
import { registerPublicCampusTools } from "@/src/mcp/public-campus-tools";

export const MCP_RESOURCE_URL = "https://ai.gapwise.ca/api/mcp";
export const MCP_RESOURCE_METADATA_URL =
  "https://ai.gapwise.ca/.well-known/oauth-protected-resource";
export const MCP_REQUIRED_SCOPES = ["email"] as const;

export const OPENAI_TOOL_SECURITY_SCHEMES = [
  { type: "oauth2" as const, scopes: [...MCP_REQUIRED_SCOPES] },
];

export const OPENAI_TOOL_META = {
  // Current MCP SDK v2 carries extension metadata through `_meta`. The
  // tools/list compatibility projection below mirrors this validated value to
  // the root `securitySchemes` field required by ChatGPT's tool-linking UI.
  securitySchemes: OPENAI_TOOL_SECURITY_SCHEMES,
};

function quoteChallenge(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
}

export function mcpWwwAuthenticate(
  error: "invalid_token" | "insufficient_scope" = "invalid_token",
  description = "Connect your Gapwise account to continue.",
): string {
  return [
    "Bearer",
    `resource_metadata="${quoteChallenge(MCP_RESOURCE_METADATA_URL)}"`,
    `scope="${MCP_REQUIRED_SCOPES.join(" ")}"`,
    `error="${error}"`,
    `error_description="${quoteChallenge(description)}"`,
  ].join(" ");
}

export function mcpAuthenticationRequired(
  description = "Authentication required. Connect your Gapwise account to continue.",
) {
  return {
    content: [{ type: "text" as const, text: description }],
    structuredContent: { error: "authentication_required" },
    isError: true,
    _meta: {
      "mcp/www_authenticate": [mcpWwwAuthenticate("invalid_token", description)],
    },
  };
}

type RegisteredToolLike = {
  enabled: boolean;
  title?: string;
  description?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  annotations?: unknown;
  icons?: unknown;
  execution?: unknown;
  _meta?: Record<string, unknown>;
};

type McpServerPrivate = {
  _registeredTools: Record<string, RegisteredToolLike>;
  server: {
    setRequestHandler(method: "tools/list", handler: () => unknown): void;
  };
};

function schemaToJsonSchema(schema: unknown): Record<string, unknown> {
  if (!schema) {
    return { type: "object", properties: {}, additionalProperties: false };
  }
  return z.toJSONSchema(schema as z.ZodType) as Record<string, unknown>;
}

/**
 * Register provider-neutral public campus tools before projecting the SDK's
 * private tool registry. These tools intentionally carry no OAuth security
 * scheme because they expose only stateless public UTM data; private Gapwise
 * tools keep their existing OAuth metadata and per-tool caller checks.
 *
 * ChatGPT currently requires root-level `securitySchemes` in tools/list while
 * the pinned MCP SDK v2 only serializes custom auth declarations via `_meta`.
 * This small compatibility adapter mirrors only that field and keeps the SDK's
 * private registry usage isolated in one tested place. Remove it when the SDK
 * gains first-class root-level securitySchemes serialization.
 */
export function installToolSecuritySchemeProjection(server: unknown): void {
  const maybeRegistrar = server as { registerTool?: unknown };
  if (typeof maybeRegistrar.registerTool === "function") {
    registerPublicCampusTools(server as Parameters<typeof registerPublicCampusTools>[0]);
  }
  const privateServer = server as McpServerPrivate;
  privateServer.server.setRequestHandler("tools/list", () => ({
    tools: Object.entries(privateServer._registeredTools)
      .filter(([, tool]) => tool.enabled)
      .map(([name, tool]) => {
        const schemes = Array.isArray(tool._meta?.["securitySchemes"])
          ? tool._meta?.["securitySchemes"]
          : undefined;
        const definition: Record<string, unknown> = {
          name,
          title: tool.title,
          description: tool.description,
          inputSchema: schemaToJsonSchema(tool.inputSchema),
          annotations: tool.annotations,
          icons: tool.icons,
          execution: tool.execution,
          _meta: tool._meta,
        };
        if (tool.outputSchema) definition["outputSchema"] = schemaToJsonSchema(tool.outputSchema);
        if (schemes) definition["securitySchemes"] = schemes;
        return definition;
      }),
  }));
}
