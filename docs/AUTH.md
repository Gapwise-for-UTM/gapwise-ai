# Authentication

Gapwise AI has two authentication paths with deliberately different authority.

## MCP OAuth

`/api/mcp` is an OAuth-protected resource backed by Gapwise's existing Supabase Auth project. The service first asks Supabase Auth's `/auth/v1/user` endpoint to validate the bearer token, then independently checks the resource-server claims that matter to Gapwise AI.

An MCP bearer token is accepted only when all of the following hold:

1. its issuer is the Gapwise Supabase Auth issuer;
2. its subject matches the Supabase user returned by `/auth/v1/user`;
3. it is currently valid (`exp`, and `nbf` when present);
4. it contains a non-empty OAuth `client_id`, which distinguishes a third-party OAuth credential from an ordinary Gapwise browser session;
5. its `aud` contains exactly the canonical protected resource `https://ai.gapwise.ca/api/mcp`; and
6. its granted OAuth scope contains the minimal advertised `email` identity scope.

The audience is not granted merely because a client registered with Supabase. Gapwise's custom access-token hook checks the exact `(user_id, client_id)` against `ai_oauth_clients`; only a client the user approved through the Gapwise consent flow receives the MCP audience at token issuance. Unapproved OAuth clients and normal Gapwise browser sessions keep Supabase's normal audience and fail the MCP audience check.

The `email` OAuth scope is an identity/discovery scope supported by Supabase, not a Gapwise timetable permission. Fine-grained schedule, personal-item, gap-plan, routing, and write permissions remain in the explicitly delegated Gapwise AI snapshot and database policies. Gapwise does not invent unsupported custom OAuth scopes.

Production requests through either `ai.gapwise.ca` or the Vercel infrastructure alias resolve to the same canonical protected-resource identifier.

### Discovery and linking

The MCP transport permits unauthenticated initialization and `tools/list` so clients such as ChatGPT and Claude can discover the server and its authentication requirements. Every protected tool advertises the OAuth scheme, and ChatGPT compatibility mirrors that declaration at both the MCP tool root and `_meta` while the pinned SDK lacks first-class root-level serialization.

Tool execution remains fail-closed. A call without a verified caller returns an in-band `_meta["mcp/www_authenticate"]` Bearer challenge containing:

- the protected-resource metadata URL;
- the required `email` scope;
- a machine-readable OAuth error; and
- a short human-readable linking description.

Protected-resource metadata publishes the canonical resource, Supabase authorization server, and supported scope. No timetable content is needed for discovery.

## Browser delegation API

The browser delegation API accepts the user's normal Gapwise Supabase bearer token after the base Supabase/issuer/subject/time validation above. It deliberately does **not** require an OAuth `client_id`, the MCP audience, or the MCP scope because it is the first-party browser path that creates/reconciles the encrypted delegated snapshot and applies queued actions.

Conversely, OAuth-client tokens are rejected from browser-authoritative mutation endpoints. This prevents an MCP client from bypassing the queued-action/revision flow by replaying its OAuth credential against the first-party bridge.

Bearer tokens are not persisted by Gapwise AI.
