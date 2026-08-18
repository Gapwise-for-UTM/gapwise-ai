# Security policy

Gapwise AI is a private integration service for Gapwise. Report security issues privately to the repository owner; do not open public disclosure issues while the repository remains private.

## Security boundaries

- Never store or log model prompts, timetable plaintext, tool arguments, tool results, access tokens, refresh tokens, OAuth codes, or encryption keys.
- Never request or possess Gapwise's main encrypted-private-data DEK.
- ACORN-imported academic meetings are read-only to AI integrations.
- AI write tools are limited to explicitly delegated personal timetable items and preferences.
- All private reads and writes require a valid user-scoped Supabase access token.
- Database rows are owner-scoped with RLS; private AI payloads are encrypted before database storage with a server-only key.
- Revocation must fail closed.

## Secrets

Production secrets belong in Vercel environment variables only. Do not commit them to GitHub, expose them through `NEXT_PUBLIC_` variables, include them in tool results, or print them in logs.
