# Environment variables

Gapwise AI is configured entirely through server-side environment variables.

```text
GAPWISE_SUPABASE_URL=https://olrtvbblxbgcxbhvujaw.supabase.co
GAPWISE_SUPABASE_PUBLISHABLE_KEY=...
GAPWISE_AI_DATA_KEY=... # exactly 32 random bytes, Base64/Base64url encoded
GAPWISE_APP_ORIGIN=https://gapwise.ca
GAPWISE_AI_ORIGIN=https://ai.gapwise.ca # set after the custom domain is verified
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

The externally visible origin used when publishing OAuth protected-resource metadata. For the public production service, prefer the first-party hostname:

```text
https://ai.gapwise.ca
```

Do not set this value until the hostname is attached to the Vercel project, DNS is verified, HTTPS is active, and `/api/health` succeeds on that hostname. Until then, the deployment can continue using its Vercel production alias.

## Public-variable rule

No credential, OAuth secret, encryption key, or private server configuration may use a `NEXT_PUBLIC_` prefix.

The Supabase publishable key is intentionally non-privileged, but Gapwise AI keeps all integration configuration server-side to avoid accidental client coupling and to make the trust boundary obvious.
