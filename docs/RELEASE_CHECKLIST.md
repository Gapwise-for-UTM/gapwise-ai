# Release checklist

Checked items have been verified in code, CI, production infrastructure, or the production-equivalent database policy suite. Provider/OAuth items remain unchecked until a real external client completes them.

## Service and security gates

- [ ] CI passes on the exact final deployment commit.
- [x] Supabase migrations are applied and security/performance advisors have been reviewed.
- [ ] Supabase OAuth 2.1 Server is enabled with the Gapwise `/oauth/consent` authorization path and required client-registration behavior.
- [x] Production Vercel runtime configuration is healthy and `/api/health` returns HTTP 200.
- [x] No required secret/configuration variable uses a public client prefix.
- [x] Protected-resource metadata resolves to the canonical MCP resource and correct Supabase issuer on the active production origin.
- [x] Unauthenticated MCP requests receive an OAuth Bearer challenge and fail closed.
- [x] Revoked delegation deletes delegated state/actions and subsequent reads/writes fail closed.
- [x] Cross-user/OAuth-client RLS tests prove primary-data isolation.
- [x] Snapshot/action plaintext is encrypted before database storage and a database-only reader lacks the AI data key.
- [x] Stale revision writes fail closed.
- [x] Academic meetings cannot be mutated by any exposed tool.
- [x] Application code intentionally logs no prompts, private tool arguments/results, bearer tokens, or decrypted timetable/action content.
- [x] Account deletion cascades through AI delegation, approval, and action rows; OAuth-client tokens are rejected by the account-deletion function.

## Product integration gates

- [x] Gapwise browser delegation/OAuth-consent integration is merged and deployed on `gapwise.ca`.
- [x] Gapwise production CSP allows only the active trusted Gapwise AI origin alongside existing required origins.
- [x] `ai.gapwise.ca` is attached to the Vercel project, DNS/TLS are valid, and production metadata canonicalizes to that first-party origin.
- [ ] Re-verify the deployed Gapwise browser/CSP configuration against `https://ai.gapwise.ca` on the exact release candidate before broad client release.

## Real-client validation

- [ ] Claude completes the real OAuth/read/write/revocation matrix.
- [ ] ChatGPT completes the real OAuth/read/write/revocation matrix for every enabled tool supported by the current plan/workspace.
- [ ] No-delegation, read-only, write-disabled, stale-write, academic-immutability, revoke, and re-auth scenarios are exercised against production-equivalent identities.

## Public repository gate

- [x] MIT license is present.
- [x] Public-facing README documents the architecture, security model, data minimization, tools, development flow, and project relationship.
- [x] `SECURITY.md` defines private vulnerability reporting and non-negotiable boundaries.
- [x] `CONTRIBUTING.md` defines security-sensitive contribution requirements.
- [x] `.env.example` contains placeholders only and documents the intended custom origin without a secret.
- [x] Production secrets remain outside source control.
- [x] Repository remains private during real-client integration testing.
- [ ] Real-client validation above is complete.
- [ ] Final current-tree and history secret scan is completed immediately before changing repository visibility.
- [ ] Repository visibility is intentionally changed to public by the owner after all preceding public gates pass.

## Remaining blockers

1. Enable and validate the Supabase OAuth 2.1 server flow against the deployed Gapwise `/oauth/consent` page.
2. Re-verify the production Gapwise browser/CSP trust path for `https://ai.gapwise.ca` on the exact release candidate.
3. Complete the real ChatGPT and Claude OAuth/read/write/revoke matrices.
4. Run one final secret/history scan and exact-head CI check immediately before public release.

The repository should not rely on source secrecy for security, but it should remain private until these integration gates have proved that the public security contract matches production behavior.
