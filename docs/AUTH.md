# Authentication

The MCP endpoint is an OAuth protected resource. It validates Supabase access tokens locally against the project's JWKS and issuer. Caller identity is always derived from the token `sub` claim; tool arguments never select an account.

The browser delegation API accepts the user's normal Gapwise Supabase bearer token under the same verification rules. Tokens are not stored by Gapwise AI.
