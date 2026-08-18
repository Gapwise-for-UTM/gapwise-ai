# AI provider integration

Gapwise AI intentionally exposes one standards-based remote MCP endpoint rather than provider-specific backends:

```text
https://gapwise-ai.vercel.app/api/mcp
```

Protected-resource metadata:

```text
https://gapwise-ai.vercel.app/.well-known/oauth-protected-resource
```

The MCP surface is the product contract. Provider packaging must not duplicate timetable, routing, gap-planning, permission, or write-validation logic.

## Claude

Claude custom connectors support remote Streamable HTTP MCP servers with OAuth and Dynamic Client Registration (DCR). Use the canonical MCP URL above.

Release test:

1. Add the remote connector from Claude's connector settings.
2. Complete Gapwise/Supabase OAuth and approve the exact client on the Gapwise consent screen.
3. In Gapwise, explicitly enable AI delegation and only the permissions needed for the test.
4. Verify `get_ai_delegation_status` succeeds.
5. Verify `get_my_day` returns exact source-backed meetings and no undelegated personal data.
6. If gap-plan sharing is enabled, verify `get_my_gap_plan` preserves Gapwise's deterministic route status/confidence and timing fields exactly.
7. With write permissions still off, verify write tools fail closed.
8. Enable personal-item write permission, create a test personal item, then open Gapwise and verify the queued action is validated/applied and the subsequent read reflects a newer snapshot revision.
9. Verify imported academic meetings cannot be edited through any exposed tool.
10. Revoke AI access in Gapwise and verify the connector can no longer retrieve delegated data.

Claude's current documented OAuth callback for custom connectors is `https://claude.ai/api/mcp/auth_callback`. DCR is preferred so the client registration can be created automatically by Supabase OAuth rather than hard-coding a Claude credential into this repository.

## ChatGPT

OpenAI's Apps SDK is MCP-based. The same canonical MCP endpoint is the underlying Gapwise app backend; do not create a separate ChatGPT data API.

For private development on a ChatGPT plan/workspace that currently supports custom MCP apps:

1. Enable Developer Mode for the eligible workspace/account.
2. Create a custom app and supply `https://gapwise-ai.vercel.app/api/mcp`.
3. Let ChatGPT scan the MCP tools and complete OAuth when prompted.
4. Exercise the same read/write/revocation matrix used for Claude.
5. Pay particular attention to confirmation UX for destructive/write actions and to refresh-token longevity.

OpenAI currently recommends Apps SDK for packaging/publishing ChatGPT app experiences. Public distribution should therefore wrap this MCP app in the current ChatGPT app/plugin submission flow instead of introducing a second server implementation.

Before submission, require:

- a stable HTTPS production endpoint;
- successful OAuth discovery and refresh behavior;
- a public, accurate Gapwise privacy policy covering AI delegation;
- clear tool names/descriptions and correct MCP safety annotations;
- no undeclared data collection or logging of timetable/tool payloads;
- deterministic source-of-truth behavior for schedule/routing/gap facts;
- explicit permission and revocation UX;
- end-to-end tests for reads, queued writes, stale-revision rejection, and academic immutability.

## Other MCP clients

Any client supporting remote Streamable HTTP MCP plus the OAuth authorization flow may target the same endpoint. Treat each new provider as a compatibility/security validation exercise, not a reason to fork the backend.

For every provider, validate at minimum:

- protected-resource and OAuth discovery;
- PKCE/DCR behavior or explicit client registration when DCR is unavailable;
- access-token refresh/expiry behavior;
- `client_id` preservation in Supabase OAuth access tokens;
- RLS isolation from primary Gapwise private/cloud/friend data;
- tool-schema compatibility;
- write confirmation UX where the client provides it;
- disconnect/revocation behavior.

## Release rule

A provider is not considered supported merely because it can list the tools. It is supported only after a real OAuth session has passed the read, permission-denial, write, stale-revision, academic-immutability, and revocation tests against production-equivalent Gapwise data.
