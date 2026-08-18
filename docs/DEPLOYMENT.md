# Deployment

Gapwise AI runs as a separate Vercel project connected to `andrewmuratov/gapwise-ai`. Keeping the integration service separate from the Gapwise web app preserves a clear deployment and secret boundary.

## Production origins

Bootstrap Vercel origin:

```text
https://gapwise-ai.vercel.app
```

Preferred public first-party origin:

```text
https://ai.gapwise.ca
```

The custom origin should become canonical only after DNS, TLS, runtime health, OAuth metadata, and the Gapwise browser CSP have all been verified against it.

The repository includes `vercel.json` with `"framework": "nextjs"` so imports cannot silently fall back to a generic static-output preset.

## Required Vercel environment

- `GAPWISE_SUPABASE_URL=https://olrtvbblxbgcxbhvujaw.supabase.co`
- `GAPWISE_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>`
- `GAPWISE_AI_DATA_KEY=<Base64/Base64url encoding of exactly 32 random bytes>`
- `GAPWISE_APP_ORIGIN=https://gapwise.ca`

After the custom hostname is attached and verified:

- `GAPWISE_AI_ORIGIN=https://ai.gapwise.ca`

Generate `GAPWISE_AI_DATA_KEY` from a cryptographically secure random source; never reuse a password or paste the value into an issue, chat, log, or source file.

Never place these values in `NEXT_PUBLIC_*` variables. The Supabase publishable key is intentionally non-privileged, but all Gapwise AI integration configuration remains server-side.

After changing production environment variables, redeploy the current `main` commit and require `/api/health` to return HTTP 200 before enabling or revalidating OAuth.

## Attaching `ai.gapwise.ca`

The `gapwise.ca` DNS zone is managed in Cloudflare while the application is served by Vercel.

1. In the Vercel `gapwise-ai` project, open **Domains** and add `ai.gapwise.ca` as an existing domain.
2. Vercel will show the exact DNS record it expects. Copy that record into the `gapwise.ca` zone in Cloudflare rather than guessing the target.
3. Keep the new `ai` record **DNS only** while Vercel verifies ownership and provisions TLS. A second proxy layer is unnecessary for the initial setup and can complicate verification/debugging.
4. Wait until Vercel reports **Valid Configuration** and HTTPS succeeds for `https://ai.gapwise.ca`.
5. Set `GAPWISE_AI_ORIGIN=https://ai.gapwise.ca` in the production Vercel environment and redeploy.
6. Verify:
   - `https://ai.gapwise.ca/api/health` returns 200;
   - `https://ai.gapwise.ca/.well-known/oauth-protected-resource` publishes the `ai.gapwise.ca` MCP resource;
   - unauthenticated `https://ai.gapwise.ca/api/mcp` returns 401 with the correct `WWW-Authenticate` metadata URL.
7. Update the Gapwise web app's trusted AI origin/CSP from the temporary Vercel hostname to `https://ai.gapwise.ca`, deploy, and verify browser delegation calls.

Do not remove the Vercel alias merely for cosmetic reasons; it is useful as an infrastructure-level fallback. Public documentation and clients should use the first-party hostname once migration is complete.

## Supabase OAuth 2.1

Gapwise's existing Supabase project supplies OAuth 2.1 authorization for remote MCP clients.

Dashboard configuration:

1. Authentication → OAuth Server.
2. Enable OAuth 2.1 server capabilities.
3. Set **Authorization Path** to `/oauth/consent` (combined with the Gapwise Site URL, `https://gapwise.ca`).
4. Enable Dynamic Client Registration for MCP clients that require it.
5. Keep explicit user approval enabled; Gapwise's consent page binds the exact OAuth `client_id` to the user before the token can reach delegated AI rows.

Supabase OAuth access tokens include the OAuth-specific `client_id` claim. Gapwise RLS uses that claim to distinguish third-party MCP clients from ordinary first-party browser sessions. OAuth/OIDC identity scopes do not replace Gapwise permissions; fine-grained access remains in the delegation record and RLS policies.

Some clients may have additional discovery or refresh-token expectations. Verify each provider during its real connector test rather than weakening authorization or fabricating unsupported scopes.

## MCP URLs

When `ai.gapwise.ca` is canonical:

Streamable HTTP endpoint:

```text
https://ai.gapwise.ca/api/mcp
```

Protected-resource metadata:

```text
https://ai.gapwise.ca/.well-known/oauth-protected-resource
```

The metadata must identify the protected resource exactly as:

```text
https://ai.gapwise.ca/api/mcp
```

and the authorization server as:

```text
https://olrtvbblxbgcxbhvujaw.supabase.co/auth/v1
```

An unauthenticated MCP request must return HTTP 401 with a `WWW-Authenticate` challenge pointing to the protected-resource metadata URL.

## Release verification

Before treating any deployment as production-ready, confirm:

- the deployed commit is known and CI-clean;
- `/api/health` is 200;
- protected-resource metadata is canonical;
- unauthenticated MCP requests fail closed;
- browser CORS accepts only the intended Gapwise origin;
- production logs contain no private payloads/tokens;
- real OAuth read/write/revoke tests pass for each supported client.

See [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) for the complete gate.
