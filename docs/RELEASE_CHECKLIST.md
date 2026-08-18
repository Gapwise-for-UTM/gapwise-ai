# Private release checklist

Checked items below have been verified in code, CI, production infrastructure, or the production-equivalent database policy suite. Provider/OAuth items stay unchecked until a real external client completes them.

- [ ] CI passes on the exact final deployment commit.
- [x] Supabase migrations applied and security/performance advisors reviewed.
- [ ] OAuth 2.1 Server enabled with explicit consent UI.
- [ ] Production Vercel env vars healthy; no secret uses a public prefix.
- [x] Protected-resource metadata resolves to the canonical MCP resource and correct Supabase issuer.
- [x] Unauthenticated MCP requests receive an OAuth challenge.
- [x] Revoked delegation deletes delegated state/actions and subsequent reads/writes fail closed.
- [x] Cross-user/OAuth-client RLS tests prove primary-data isolation.
- [x] Snapshot/action plaintext is encrypted before database storage and a database-only reader lacks the AI data key.
- [x] Stale revision writes fail closed.
- [x] Academic meetings cannot be mutated by any exposed tool.
- [x] Application code intentionally logs no prompts, arguments, results, bearer tokens, or decrypted timetable/action content.
- [ ] Claude connector completes the real OAuth/read/write/revocation matrix.
- [ ] ChatGPT connector completes every enabled tool permitted by the current plan/workspace.
- [x] Account deletion cascades through AI delegation, approval, and action rows; OAuth-client tokens are rejected by the account-deletion function.
- [x] Repository remains private during integration testing.

## Current external blockers

1. `https://gapwise-ai.vercel.app/api/health` must return HTTP 200. An invalid `GAPWISE_AI_DATA_KEY` keeps the service fail-closed; the value must decode to exactly 32 random bytes.
2. The Gapwise browser integration must be merged/deployed and `VITE_GAPWISE_AI_URL` must point at the canonical production MCP service.
3. Supabase OAuth Server must then be enabled with `/oauth/consent`, Dynamic Client Registration, and a suitable asymmetric JWT signing key for OAuth/OIDC.
4. Only after those gates pass should Claude and ChatGPT real-client validation begin.
