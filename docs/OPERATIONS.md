# Operations

## Fail-closed defaults

- Missing required environment variables: service health reports `misconfigured`; private endpoints fail.
- Missing/invalid/expired bearer token: `401`.
- No AI delegation or revoked delegation: private tools return an explicit authorization error.
- Stale snapshot revision on write: action is rejected.
- Unknown timetable/personal-item identifier: fail; never guess.
- Decryption/authentication failure: fail; never return partial plaintext.

## Logging policy

Permitted fields: timestamp, request ID, route/tool name, HTTP status, elapsed milliseconds, protocol version, deployment version, and coarse error code.

Prohibited fields: Authorization headers, tokens, prompts, MCP arguments, tool results, timetable/personal-item contents, decrypted payloads, notes, OAuth codes, encryption keys.

## Key rotation

`GAPWISE_AI_DATA_KEY` is a 32-byte base64url AES key. The first production version uses one active key. Before rotating, add a key-version column/value and deploy dual-read/new-write behavior; do not replace the only key in-place while ciphertext exists.

## Incident response

1. Revoke/rotate the AI data key if exposed.
2. Disable the MCP deployment or AI delegation endpoints if authorization behavior is suspect.
3. Revoke affected OAuth applications/tokens in Supabase.
4. Preserve operational logs without copying private payloads into incident notes.
5. Require users to republish AI snapshots after destructive key rotation if old ciphertext is intentionally abandoned.
