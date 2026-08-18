# Gapwise AI privacy model

Gapwise AI is opt-in. A user must be signed into Gapwise and explicitly enable AI delegation before a private MCP client can read schedule data or queue changes.

## Shared with an enabled AI client

Only data required for delegated timetable assistance is returned: normalized class meeting facts, enabled personal timetable items, enabled planning preferences, and deterministic/explicit status metadata.

## Never shared through the private MCP surface

- original ACORN `.ics` bytes;
- Gapwise account passwords or social-provider credentials;
- Supabase refresh tokens;
- Gapwise private-data encryption keys;
- friend identities, friend availability, or overlap data;
- precise live/background location;
- unrelated notes or browser data unless a future permission explicitly adds them.

## At-rest protection

Private AI snapshots and queued AI actions are encrypted by the Gapwise AI service before storage in Supabase. The encryption key is held only in the Gapwise AI Vercel environment. A Supabase database-only compromise therefore does not reveal these payloads.

This is not end-to-end or zero-knowledge encryption: plaintext exists transiently in the authorized Gapwise AI runtime and is returned to the AI provider when the user invokes a tool that requires it.

## Logging

Application logs contain operational metadata only: request ID, route/tool name, status, latency, protocol version, and coarse error code. Prompt text, tool arguments, tool results, authorization headers, timetable content, and decrypted payloads are not intentionally logged.
