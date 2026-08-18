# Deployment

The service is designed for a separate Vercel project connected to `andrewmuratov/gapwise-ai`.

Required environment variables:

- `GAPWISE_SUPABASE_URL=https://olrtvbblxbgcxbhvujaw.supabase.co`
- `GAPWISE_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>`
- `GAPWISE_AI_DATA_KEY=<base64url 32-byte random key>`
- `GAPWISE_APP_ORIGIN=https://gapwise.ca`

Optional:

- `GAPWISE_AI_ORIGIN=https://mcp.gapwise.ca` once a custom domain is attached. If omitted, request origin is used for protected-resource metadata.

Never put these values in `NEXT_PUBLIC_*` variables. The publishable key is not secret by itself, but keeping all server integration configuration server-side avoids accidental coupling.

## Supabase OAuth 2.1

Gapwise's existing Supabase project must have OAuth 2.1 Server enabled, with the authorization UI hosted in the Gapwise app. MCP clients then authenticate as existing Gapwise users. RLS remains the database authorization layer; OAuth OIDC scopes are not used as database permissions.

## MCP URL

`https://<vercel-project-domain>/api/mcp`

Protected resource metadata:

`https://<vercel-project-domain>/.well-known/oauth-protected-resource`

Health:

`https://<vercel-project-domain>/api/health`
