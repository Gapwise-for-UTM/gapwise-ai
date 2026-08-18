# Protocol baseline

Gapwise AI uses stateless Streamable HTTP MCP. The implementation targets MCP SDK v2 / 2026-07-28 while retaining compatibility with 2025-era Streamable HTTP clients through Vercel's `mcp-handler` compatibility layer.

OAuth protected-resource metadata is served at `/.well-known/oauth-protected-resource`. The authorization server is Gapwise's Supabase Auth issuer.

SSE-only legacy transport is not a design requirement. No Redis/session store is required for the stateless MCP endpoint.
