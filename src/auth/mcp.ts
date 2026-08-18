export const MCP_RESOURCE_METADATA_URL =
  "https://ai.gapwise.ca/.well-known/oauth-protected-resource";

export const OPENAI_TOOL_SECURITY_SCHEMES = [{ type: "oauth2", scopes: [] }] as const;

export const OPENAI_TOOL_META = {
  // OpenAI's MCP/App clients consume this back-compat mirror from tool metadata.
  // Supabase currently exposes only standard identity scopes; Gapwise's actual
  // timetable permissions are enforced by the encrypted delegation snapshot.
  securitySchemes: OPENAI_TOOL_SECURITY_SCHEMES,
};

export function mcpAuthenticationRequired(
  resourceMetadataUrl = MCP_RESOURCE_METADATA_URL,
) {
  const challenge =
    `Bearer resource_metadata="${resourceMetadataUrl}", ` +
    'error="invalid_token", error_description="Connect your Gapwise account to continue"';

  return {
    content: [
      {
        type: "text" as const,
        text: "Authentication required. Connect your Gapwise account to continue.",
      },
    ],
    isError: true,
    _meta: {
      "mcp/www_authenticate": [challenge],
    },
  };
}
