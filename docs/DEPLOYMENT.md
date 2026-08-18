# Deployment

Gapwise AI runs as a separate Vercel project connected to `andrewmuratov/gapwise-ai`. Keeping the integration service separate from the Gapwise web app preserves a clear deployment and secret boundary.

## Production origins

Canonical first-party production origin:

```text
https://ai.gapwise.ca
```

Infrastructure fallback alias:

```text
https://gapwise-ai.vercel.app
```

Public documentation and OAuth/MCP clients must use `ai.gapwise.ca`. The Vercel alias remains available for infrastructure recovery, but OAuth protected-resource metadata from either production hostname converges on the same first-party resource identifier: `https://ai.gapwise.ca/api/mcp`.

The repository includes `vercel.json` with `"framework": "nextjs"` so imports cannot silently fall back to a generic static-output preset.

## Required Vercel environment

- `GAPWISE_SUPABASE_URL=https://olrtvbblxbgcxbhvujaw.supabase.co`
- `GAPWISE_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>`
- `GAPWISE_AI_DATA_KEY=<Base64/Base64url encoding of exactly 32 random bytes>`
- `GAPWISE_APP_ORIGIN=https://gapwise.ca`

Optional deployment override:

- `GAPWISE_AI_ORIGIN=https://ai.gapwise.ca`

The production service does not depend on the optional override: requests through the verified first-party hostname and the Vercel production alias are canonicalized to `https://ai.gapwise.ca`. The override remains useful for alternate/self-hosted deployments.

Generate `GAPWISE_AI_DATA_KEY` from a cryptographically secure random source; never reuse a password or paste the value into an issue, chat, log, or source file.

Never place these values in `NEXT_PUBLIC_*` variables. The Supabase publishable key is intentionally non-privileged, but all Gapwise AI integration configuration remains server-side.

After changing production environment variables, redeploy the current `main` commit and require `/api/health` to return HTTP 200 before enabling or revalidating OAuth.

## `ai.gapwise.ca`

The `gapwise.ca` DNS zone is managed in Cloudflare while the application is served by Vercel.

The first-party service hostname is now attached and verified:

- Vercel domain: `ai.gapwise.ca`
- DNS: Cloudflare CNAME, DNS-only during verification
- TLS: valid through Vercel
- health: `https://ai.gapwise.ca/api/health`

For any future domain migration, verify all of the following before changing clients:

1. `/api/health` returns 200 on the new hostname.
2. `/.well-known/oauth-protected-resource` publishes the intended MCP resource.
3. unauthenticated `/api/mcp` returns 401 with the correct `WWW-Authenticate` challenge.
4. the Gapwise web app CSP/browser configuration trusts only the intended AI origin.

Do not remove the Vercel alias merely for cosmetic reasons; it is useful as an infrastructure-level fallback. Public documentation and clients use the first-party hostname.

## Supabase OAuth 2.1

Gapwise's existing Supabase project supplies OAuth 2.1 authorization for remote MCP clients.

Dashboard configuration:

1. Authentication → OAuth Server.
2. Enable OAuth 2.1 server capabilities.
3. Set **Authorization Path** to `/oauth/consent` (combined with the Gapwise Site URL, `https://gapwise.ca`).
4. Enable Dynamic Client Registration for MCP clients that require it.
5. Keep explicit user approval enabled; Gapwise's consent page binds the exact OAuth `client_id` to the user before the token can reach delegated AI rows.
6. Prefer an asymmetric JWT signing key (RS256/ES256) before requesting `openid`/OIDC ID tokens.

Supabase OAuth access tokens include the OAuth-specific `client_id` claim. Gapwise RLS uses that claim to distinguish third-party MCP clients from ordinary first-party browser sessions. OAuth/OIDC identity scopes do not replace Gapwise permissions; fine-grained access remains in the delegation record and RLS policies.

Some clients may have additional discovery or refresh-token expectations. Verify each provider during its real connector test rather than weakening authorization or fabricating unsupported scopes.

## MCP URLs

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

Production deployments are built from the tested `main` branch. Do not promote an intermediate feature-branch Preview deployment as a substitute for the merged `main` commit unless the commit SHA is identical.

Before treating any deployment as production-ready, confirm:

- the deployed commit is known and CI-clean;
- `/api/health` is 200;
- protected-resource metadata is canonical;
- unauthenticated MCP requests fail closed;
- browser CORS accepts only the intended Gapwise origin;
- production logs contain no private payloads/tokens;
- real OAuth read/write/revoke tests pass for each supported client.

See [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) for the complete gate.
