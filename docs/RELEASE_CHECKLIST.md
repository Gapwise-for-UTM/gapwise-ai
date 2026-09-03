# Release checklist

Checked items have been verified in code, CI, production infrastructure, or the production-equivalent database policy suite. Public source visibility is separate from broad MCP-client release readiness.

## Service and security gates

- [ ] CI passes on the exact final broad-client release commit after the real-client matrices and any resulting fixes.
- [x] Supabase migrations are applied and security/performance advisors have been reviewed.
- [x] Supabase OAuth 2.1 Server is enabled with the Gapwise `/oauth/consent` authorization path and intended client-registration behavior; the production consent/resource boundary was validated under AND-114.
- [x] Production Vercel runtime configuration is healthy and `/api/health` returns HTTP 200.
- [x] No required secret/configuration variable uses a public client prefix.
- [x] Protected-resource metadata resolves to the canonical MCP resource and correct Supabase issuer on the active production origin.
- [x] Unauthenticated MCP requests receive an OAuth Bearer challenge and fail closed.
- [x] Revoked delegation deletes delegated state/actions and subsequent reads/writes fail closed.
- [x] Cross-user/OAuth-client RLS tests prove primary-data isolation.
- [x] AI REST reads independently reject any returned delegation/action/approved-client row whose `user_id` differs from the cryptographically verified caller.
- [x] AI delegation/action inserts independently reject owner IDs that differ from the authenticated caller.
- [x] Snapshot/action plaintext is encrypted before database storage and a database-only reader lacks the AI data key.
- [x] Stale revision writes fail closed.
- [x] Academic meetings cannot be mutated by any exposed tool.
- [x] Application code intentionally logs no prompts, private tool arguments/results, bearer tokens, or decrypted timetable/action content.
- [x] Account deletion cascades through AI delegation, approval, and action rows; OAuth-client tokens are rejected by the account-deletion function.

## Product integration gates

- [x] Gapwise browser delegation/OAuth-consent integration is merged and deployed on `gapwise.ca`.
- [x] Gapwise production CSP allows only the active trusted Gapwise AI origin alongside existing required origins.
- [x] `ai.gapwise.ca` is attached to the Vercel project, DNS/TLS are valid, and production metadata canonicalizes to that first-party origin.
- [x] The deployed Gapwise browser/CSP configuration was rechecked against `https://ai.gapwise.ca` during the production OAuth consent-boundary validation under AND-114.

## Real-client validation

- [ ] Claude completes the real OAuth/read/write/revocation matrix.
- [ ] ChatGPT completes the real OAuth/read/write/revocation matrix for every enabled tool supported by the current plan/workspace.
- [ ] No-delegation, read-only, write-disabled, stale-write, academic-immutability, cross-account refusal, revoke, and re-auth scenarios are exercised against production-equivalent identities.

## Public repository gate

- [x] MIT license is present.
- [x] Public-facing README documents the architecture, security model, data minimization, tools, development flow, and project relationship.
- [x] `SECURITY.md` defines private vulnerability reporting and non-negotiable boundaries.
- [x] `CONTRIBUTING.md` defines security-sensitive contribution requirements.
- [x] `.env.example` contains placeholders only and documents the intended custom origin without a secret.
- [x] Production secrets remain outside source control.
- [x] The security model does not rely on source secrecy.
- [x] Repository visibility was intentionally changed to public by the owner.
- [x] A fresh reachable-history high-confidence secret scan, typecheck, unit-test suite, production dependency audit, and production build passed on the 2026-08-30 release-evidence checkpoint merged in PR #33.
- [x] The application-layer cross-account ownership assertion suite passed in CI before PR #45 was merged.
- [ ] The final exact-head current-tree/history scan is rerun after the real-client matrices and any resulting fixes, immediately before the broad-client release claim.

## Remaining broad-client release gates

1. Complete the real ChatGPT and Claude OAuth/read/write/revoke matrices.
2. Exercise the production-equivalent no-delegation, read-only, write-disabled, stale-write, academic-immutability, cross-account refusal, revoke, and re-auth cases.
3. Run the final current-tree/history secret scan and exact-head CI/deployment verification after those external matrices and any resulting fixes.

The repository is public because the design is intended to remain secure under source disclosure. That decision does not by itself certify every external MCP client or complete the remaining integration tests.
