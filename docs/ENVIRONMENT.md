# Environment variables

Gapwise AI is configured entirely through server-side environment variables.

```text
GAPWISE_SUPABASE_URL=https://olrtvbblxbgcxbhvujaw.supabase.co
GAPWISE_SUPABASE_PUBLISHABLE_KEY=...
GAPWISE_AI_DATA_KEY=... # exactly 32 random bytes, Base64/Base64url encoded
GAPWISE_APP_ORIGIN=https://gapwise.ca
# Optional override for alternate deployments:
# GAPWISE_AI_ORIGIN=https://ai.gapwise.ca
# Optional OpenAI Apps domain-verification token:
# GAPWISE_OPENAI_APPS_CHALLENGE_TOKEN=...
```

## Requirements

### `GAPWISE_SUPABASE_URL`

The Supabase project origin used for authentication and caller-scoped data access.

### `GAPWISE_SUPABASE_PUBLISHABLE_KEY`

The project's publishable/anon-style key used when forwarding the authenticated caller to Supabase. This key is not a service-role credential and does not bypass RLS.

### `GAPWISE_AI_DATA_KEY`

A cryptographically random 256-bit key used for Gapwise AI's separate AES-256-GCM encryption domain. The value must decode to exactly 32 bytes. Base64url and standard Base64 forms are accepted.

Generate this value outside source control and store it only in the server deployment environment. Do not reuse a password, Gapwise's primary private-data key, or another application's encryption key.

### `GAPWISE_APP_ORIGIN`

The exact first-party Gapwise web origin allowed to call the browser delegation API. Production uses:

```text
https://gapwise.ca
```

### `GAPWISE_AI_ORIGIN`

Optional explicit externally visible origin for OAuth protected-resource metadata. The canonical public production service is:

```text
https://ai.gapwise.ca
```

Production requests arriving through `ai.gapwise.ca` or the infrastructure fallback `gapwise-ai.vercel.app` are canonicalized to `https://ai.gapwise.ca/api/mcp` even if this optional variable is unset. Set the variable only when an alternate deployment needs to override that behavior.

### `GAPWISE_OPENAI_APPS_CHALLENGE_TOKEN`

Optional, temporary value supplied by the OpenAI app submission flow when verifying ownership of `ai.gapwise.ca`. When present, the service exposes the token verbatim at:

```text
https://ai.gapwise.ca/.well-known/openai-apps-challenge
```

The route returns `404` while the variable is absent or malformed. Never commit the verification token to source control; set it as a server-side deployment variable and remove it when it is no longer needed.

## Public-variable rule

No credential, OAuth secret, encryption key, or private server configuration may use a `NEXT_PUBLIC_` prefix.

The Supabase publishable key is intentionally non-privileged, but Gapwise AI keeps all integration configuration server-side to avoid accidental client coupling and to make the trust boundary obvious.
