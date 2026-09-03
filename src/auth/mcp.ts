import { z } from "zod";

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

const TOOL_DESCRIPTION_OVERRIDES: Readonly<Record<string, string>> = {
  get_my_gap_plan:
    "Returns Gapwise's precomputed deterministic assessment for one exact delegated gap, including boundaries, recommendation, route status/confidence, travel and buffer time, leave-by/arrival time, shared preferences, and warnings. Returns an error when no matching delegated plan exists.",
  get_my_decision_context:
    "Returns a compact planning summary for one term: hard schedule load, delegated fixed personal constraints, authoritative Gapwise gap opportunities, route uncertainty, freshness/revision, and any planning or routing preferences the user allowed AI to read.",
  find_my_available_windows:
    "Finds source-backed free windows for one date or term weekday using delegated academic meetings and permitted fixed personal items as hard constraints. Flexible personal items are returned as soft competing constraints. Without explicit search bounds, only windows between known hard events are returned.",
  find_my_weekly_opportunities:
    "Searches all seven weekdays for usable planning opportunities in one academic term. Raw free gaps are capped by delegated deterministic Gapwise activity budgets; gaps with unavailable surrounding routes contribute zero validated activity minutes; gaps without a delegated assessment are marked temporal-only.",
  check_my_plan_feasibility:
    "Read-only validation of a proposed personal time block against delegated hard timetable conflicts and, when the block lies inside a delegated Gapwise gap, its authoritative activity envelope and route availability. Proposed locations are echoed but are not route-validated by this tool.",
  list_utm_buildings:
    "Lists canonical UTM buildings with Gapwise routing/accessibility coverage and provenance. Uses only public stateless campus data and does not read timetable, account, friend, location, or private-sync state.",
  route_between_utm_buildings:
    "Returns a deterministic Gapwise building-to-building route with routed/approximate/unavailable status, verification, time and distance, accessibility state, and warnings. Step-free mode returns unavailable when an accessible route cannot be justified. Optional routing preferences can be supplied explicitly.",
  plan_utm_gap_window:
    "Runs Gapwise's deterministic gap-assessment engine for an explicit free window between two UTM buildings using supplied route and gap preferences. Returns activity budget, recommendation, alternatives, leave-by/arrival time, confidence, route status, and warnings. This tool is stateless and does not discover the user's free time.",
};

export function projectedToolDescription(name: string, description?: string): string | undefined {
  return TOOL_DESCRIPTION_OVERRIDES[name] ?? description;
}

export function projectedToolAnnotations(annotations: unknown): unknown {
  if (!annotations || typeof annotations !== "object" || Array.isArray(annotations)) {
    return annotations;
  }

  const value = annotations as Record<string, unknown>;
  if (value["readOnlyHint"] === false) {
    // Directory clients use destructiveHint as the conservative user-approval
    // boundary for tools that modify private state. Gapwise write tools are
    // queued/revision-safe, but they still modify data and should always be
    // surfaced as such to the client.
    return { ...value, destructiveHint: true };
  }

  if (value["readOnlyHint"] === true && value["destructiveHint"] === undefined) {
    // Make the non-destructive property explicit rather than asking directory
    // scanners or clients to infer it from readOnlyHint.
    return { ...value, destructiveHint: false };
  }

  return value;
}

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
 * Project the pinned SDK's registered tool registry into a conservative
 * `tools/list` contract for directory clients. Tool registration happens
 * elsewhere: the shared handler wrapper registers the stateless public-campus
 * tools and `app/api/mcp/route.ts` registers the OAuth-protected private tools.
 *
 * Public tools intentionally have no OAuth `securitySchemes`; private tools
 * carry `OPENAI_TOOL_META`, which this adapter mirrors to the root field for
 * clients that need it. The projection also makes destructive/non-destructive
 * semantics explicit and narrows selected descriptions to factual capability
 * text rather than model-behavior instructions.
 *
 * ChatGPT currently requires root-level `securitySchemes` in tools/list while
 * the pinned MCP SDK v2 only serializes custom auth declarations via `_meta`.
 * Remove that compatibility mirror when the SDK gains first-class root-level
 * serialization, while preserving the public/private per-tool auth boundary.
 */
export function installToolSecuritySchemeProjection(server: unknown): void {
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
          description: projectedToolDescription(name, tool.description),
          inputSchema: schemaToJsonSchema(tool.inputSchema),
          annotations: projectedToolAnnotations(tool.annotations),
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
