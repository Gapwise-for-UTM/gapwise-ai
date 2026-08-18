import { canonicalMcpResourceUrl, getRuntimeConfig, supabaseIssuer } from "@/src/config";
import { MCP_REQUIRED_SCOPES } from "@/src/auth/mcp";

export const dynamic = "force-dynamic";

const METADATA_HEADERS = {
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300",
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request) {
  const config = getRuntimeConfig();
  return new Response(
    JSON.stringify({
      resource: canonicalMcpResourceUrl(request.url, config.aiOrigin),
      authorization_servers: [supabaseIssuer(config)],
      scopes_supported: [...MCP_REQUIRED_SCOPES],
    }),
    { status: 200, headers: METADATA_HEADERS },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: METADATA_HEADERS });
}
