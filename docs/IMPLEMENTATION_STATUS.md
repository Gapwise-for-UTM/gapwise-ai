# Implementation status

Implemented on `feat/private-mcp-foundation`:

- provider-neutral MCP v2 / Streamable HTTP endpoint;
- Supabase bearer-token verification;
- OAuth protected-resource metadata;
- encrypted AI snapshot storage boundary;
- owner-scoped RLS production schema;
- revision/CAS snapshot publication;
- idempotent queued personal-item and gap-preference writes;
- browser delegation/status/revocation/action APIs;
- health endpoint;
- crypto/schema/schedule regression tests;
- pinned GitHub Actions CI.

Still required for end-to-end private use:

- wire the Gapwise web browser to publish/revoke snapshots and apply queued actions;
- deploy this repository on Vercel with production environment variables;
- enable/configure Supabase OAuth 2.1 Server and Gapwise authorization UI;
- validate with Claude and ChatGPT clients.
