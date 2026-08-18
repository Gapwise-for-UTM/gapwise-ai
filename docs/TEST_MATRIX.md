# Test matrix

## Authentication

- missing bearer token → challenge/401;
- malformed token → 401;
- expired token → 401;
- wrong issuer → 401;
- valid user token → authenticated identity;
- revoked delegation → tool-level refusal.

## Authorization / isolation

- user A cannot read user B snapshot;
- user A cannot queue/update/complete user B actions;
- client-supplied user IDs are ignored/not accepted;
- write-disabled delegation rejects every mutation tool.

## Crypto

- ciphertext round trip;
- fresh nonce per encryption;
- wrong key/AAD/tampered ciphertext fails;
- payload size caps enforced before encryption/decryption.

## MCP

- tools/list exposes bounded schemas;
- read tools return structuredContent;
- mutation tools report queued state;
- stale revision returns isError;
- academic meeting write does not exist.

## Browser API

- CORS allows only Gapwise production origin;
- preflight succeeds for allowed methods;
- snapshot validation rejects unknown fields/oversize content;
- revoke removes snapshot/actions.
