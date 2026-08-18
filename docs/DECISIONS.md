# Architecture decisions

## ADR-001 — One MCP server
Use one provider-neutral remote MCP server. ChatGPT, Claude, and later clients consume the same tool contracts.

## ADR-002 — Separate repository and Vercel project
Keep integration/runtime/provider concerns out of the Gapwise web-app repository. Gapwise remains the domain source of truth.

## ADR-003 — Same Supabase project
Reuse the existing Gapwise user identities and RLS boundary. Do not create a parallel user database.

## ADR-004 — No primary private-data key delegation
The MCP service never obtains the normal Gapwise private-data DEK. AI data has a separate explicit delegation lifecycle.

## ADR-005 — Academic meetings are immutable to AI
AI may reason about source-backed class meetings but cannot rewrite them. Writes target personal timetable items and delegated preferences only.

## ADR-006 — Server-encrypted AI storage
AI snapshots/actions are encrypted before Supabase storage with a separate Vercel-only AES-256-GCM key. This preserves the database-only-compromise confidentiality goal while acknowledging the AI runtime as a plaintext trust boundary.

## ADR-007 — Queued writes
MCP write success means a typed action is queued. Gapwise applies it against a matching snapshot revision and republishes state. This avoids remotely rewriting the primary encrypted payload.
