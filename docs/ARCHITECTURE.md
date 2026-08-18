# Gapwise AI architecture

## Purpose

Expose Gapwise's deterministic timetable, gap, and campus truth to MCP-capable assistants without creating provider-specific business logic or weakening Gapwise's encrypted private-cloud design.

## Trust boundaries

1. **Gapwise browser** owns the user's canonical academic timetable and main encrypted private state.
2. **Supabase Auth** authenticates the user and, when OAuth 2.1 Server is enabled, issues user-scoped tokens to MCP clients.
3. **Gapwise AI** is an explicitly delegated plaintext processing boundary. It receives only a minimized AI snapshot and AI-managed personal-item actions. At rest, those payloads are encrypted with a Vercel-only key before being written to Supabase.
4. **Supabase Postgres** stores ciphertext and non-sensitive metadata under owner-scoped RLS.
5. **ChatGPT, Claude, and other MCP clients** see only tool results needed for the current request.

## Data flow

```text
ACORN .ics
   |
   v
Gapwise browser -- local parse --> canonical Meeting[]
   |
   | explicit AI delegation + sanitized snapshot
   v
Gapwise AI HTTPS API -- encrypt --> Supabase ciphertext
   ^                                  |
   | OAuth user token                 | owner RLS
   |                                  v
ChatGPT / Claude <--- MCP ------ Gapwise AI
   |
   | personal-item / preference action
   v
Gapwise AI -- encrypt --> ai_pending_actions
                              |
                              | Gapwise browser fetches + applies
                              v
                     canonical encrypted private state
```

## Read boundary

The snapshot may contain:

- normalized academic meetings: course code/name, section/activity, weekday, start/end, term, building/room, recurrence/date exclusions;
- AI-managed personal timetable items when enabled;
- gap and routing preferences when enabled;
- a monotonically increasing snapshot revision and update time.

The snapshot never contains:

- raw `.ics` bytes;
- Supabase access/refresh tokens;
- Gapwise private-data DEKs or KEKs;
- friend/friend-overlap data;
- precise live/background location;
- unrelated browser storage;
- hidden analytics identifiers.

## Write boundary

Academic meetings remain source-backed and read-only. MCP write tools can only queue typed actions for:

- create/update/delete personal timetable items;
- update explicitly AI-delegated gap preferences.

Every action includes an idempotency key, expected snapshot revision, creation time, and status. Gapwise applies actions to the canonical browser/private-cloud state and publishes a new snapshot. Stale revision writes fail rather than silently overwriting newer state.

## Provider neutrality

`gapwise-ai` exposes one remote Streamable HTTP MCP endpoint. Provider-specific configuration belongs outside the tool/business layer. ChatGPT and Claude consume the same tool names, schemas, results, and authorization semantics.
