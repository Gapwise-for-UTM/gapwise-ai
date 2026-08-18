# Deployment

Production is the separate Vercel project connected to `andrewmuratov/gapwise-ai`:

```text
https://gapwise-ai.vercel.app
```

The repository includes `vercel.json` with `"framework": "nextjs"` so imports cannot silently fall back to Vercel's generic static-output preset.

## Required Vercel environment

- `GAPWISE_SUPABASE_URL=https://olrtvbblxbgcxbhvujaw.supabase.co`
- `GAPWISE_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>`
- `GAPWISE_AI_DATA_KEY=<base64url encoding of exactly 32 random bytes, with no padding>`
- `GAPWISE_APP_ORIGIN=https://gapwise.ca`

A correctly encoded 32-byte `GAPWISE_AI_DATA_KEY` is normally 43 URL-safe Base64 characters when padding is omitted. Generate it from a cryptographically secure source; never reuse a password or paste the value into an issue/chat/log.

Optional:

- `GAPWISE_AI_ORIGIN=https://mcp.gapwise.ca` if a custom domain is attached later.

Never put these values in `NEXT_PUBLIC_*` variables. The publishable key is not secret by itself, but keeping server integration configuration server-side avoids accidental coupling.

After changing production environment variables, redeploy the current `main` commit and require this endpoint to return HTTP 200 before enabling OAuth:

```text
https://gapwise-ai.vercel.app/api/health
```

## Supabase OAuth 2.1

Gapwise's existing Supabase project must use the OAuth 2.1 Server only after the MCP health check and Gapwise browser integration are production-ready.

Dashboard configuration:

1. Authentication → OAuth Server.
2. Enable OAuth 2.1 server capabilities.
3. Set **Authorization Path** to `/oauth/consent` (combined with the Gapwise Site URL, `https://gapwise.ca`).
4. Enable Dynamic Client Registration for MCP clients that require it.
5. Keep explicit user approval enabled; Gapwise's consent page binds the exact OAuth `client_id` to the user before the token can reach delegated AI rows.

Supabase OAuth access tokens include the OAuth-specific `client_id` claim. Gapwise RLS uses that claim to distinguish third-party MCP clients from ordinary first-party browser sessions. OAuth/OIDC scopes are identity scopes, not database permissions; fine-grained Gapwise access remains in the delegation record and RLS policies.

Supabase issues refresh tokens for its OAuth authorization-code flow. Some clients may have additional discovery expectations around `offline_access`; verify each provider during its real connector test rather than weakening RLS or fabricating unsupported scopes.

## MCP URLs

Streamable HTTP endpoint:

```text
https://gapwise-ai.vercel.app/api/mcp
```

Protected-resource metadata:

```text
https://gapwise-ai.vercel.app/.well-known/oauth-protected-resource
```

The metadata must identify the protected resource exactly as:

```text
https://gapwise-ai.vercel.app/api/mcp
```

and the authorization server as:

```text
https://olrtvbblxbgcxbhvujaw.supabase.co/auth/v1
```

An unauthenticated MCP request should return HTTP 401 with a `WWW-Authenticate` challenge pointing to the protected-resource metadata URL.
