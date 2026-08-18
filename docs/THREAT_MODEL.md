# Threat model

## Assets

- user-scoped OAuth access tokens;
- minimized AI schedule snapshots;
- AI-managed personal timetable actions;
- server-only AI data-encryption key;
- user consent/revocation state.

## Primary threats and controls

### Broken object-level authorization
Every database row is owner-scoped with RLS. The service never accepts a `user_id` from a tool argument as authority; caller identity comes from the verified bearer token.

### Prompt injection / arbitrary execution
The MCP server exposes only narrow typed tools. There is no generic SQL, fetch-URL, script, shell, query, or execute tool. User-provided timetable text is treated as data and never as server instructions.

### Stale or conflicting AI writes
Writes require `expectedRevision` and an idempotency key. The browser applies queued actions only against the expected snapshot revision. Conflicts fail closed and require a fresh read/retry.

### Token theft
Tokens are accepted only in the Authorization header, never logged or persisted by Gapwise AI, and are validated for signature, issuer, audience where applicable, expiration, and subject. HTTPS is mandatory in production.

### Database compromise
Private snapshot/action payloads are encrypted before storage using a server-only AES-256-GCM key. Database-only access reveals ciphertext plus bounded metadata, not timetable plaintext.

### Server compromise
A compromised Gapwise AI runtime can observe delegated plaintext during tool calls and has the AI storage key. This is an explicit trust boundary disclosed to users. It still does not receive the primary Gapwise private-data key.

### Cross-origin abuse
Browser delegation endpoints allow only the configured Gapwise origin and use bearer authentication. MCP endpoints use OAuth bearer authentication rather than ambient cookies.

### Destructive model behavior
Academic meetings are immutable through AI tools. Deletes apply only to personal items and remain queued until Gapwise applies them. Provider-side confirmation is additive, not relied on as the sole safety control.

### Excessive collection
Snapshots are minimized, capped, versioned, revocable, and never include friend or location data. Disabling delegation deletes the stored snapshot and queued actions.
