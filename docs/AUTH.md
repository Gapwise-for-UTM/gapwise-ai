# Authentication

Gapwise AI has two authentication paths with different purposes.

## MCP OAuth

`/api/mcp` is an OAuth protected resource backed by the existing Gapwise Supabase Auth project. The server verifies each bearer token by calling Supabase Auth's `/auth/v1/user` endpoint with the project's non-privileged publishable key, then checks the accepted JWT claims for expiration and subject consistency.

MCP access has two additional requirements:

1. the accepted access token must contain a non-empty Supabase OAuth `client_id` claim, so an ordinary Gapwise browser session cannot be replayed as an MCP credential; and
2. the token must target the exact MCP resource `https://ai.gapwise.ca/api/mcp` through either its `resource` claim or audience.

Production requests through either `ai.gapwise.ca` or `gapwise-ai.vercel.app` resolve to that same canonical protected-resource identifier.

The MCP transport itself permits unauthenticated discovery and `tools/list` so clients such as ChatGPT and Claude can scan the server and learn how to authenticate. Tool execution remains fail-closed: every tool returns an MCP `mcp/www_authenticate` challenge until the wrapper has attached a valid resource-bound OAuth caller.

Supabase currently exposes standard identity scopes rather than Gapwise-specific OAuth scopes. Fine-grained authorization therefore remains inside the encrypted Gapwise AI delegation snapshot and the database's OAuth-client isolation policies instead of inventing unsupported scopes.

## Browser delegation API

The browser delegation API accepts the user's normal Gapwise Supabase bearer token under the base verification rules above, but it does not require an OAuth `client_id` or MCP resource binding. Caller identity is always derived from the verified token; request arguments never select an account.

Bearer tokens are not stored by Gapwise AI.
