# Connector release runbook

Use this runbook for the final release candidate after all code changes have merged.

## 1. Freeze

- Stop feature work on the connector release candidate.
- Record the exact `main` commit SHA.
- Ensure directory metadata, reviewer prompts, support links, and tool descriptions match that commit.

## 2. Automated checks

Run:

```bash
npm ci
npm run check
npm audit --omit=dev
```

Require the repository's secret/history scan, typecheck, tests, and production build to pass on the exact release SHA.

## 3. Infrastructure checks

- Confirm Vercel production deployment is the exact release SHA.
- Confirm `/api/health` returns 200.
- Confirm TLS for `ai.gapwise.ca` is valid.
- Confirm protected-resource metadata uses `https://ai.gapwise.ca/api/mcp`.
- Confirm an unauthenticated protected tool execution receives the expected OAuth challenge.
- Confirm Gapwise browser CORS/CSP trusts only intended first-party integration origins.
- Review Supabase security and performance advisors.

## 4. Privacy/security checks

- Search production logs for accidental bearer tokens, prompts, tool arguments/results, decrypted timetable data, or encryption material.
- Reconfirm cross-account RLS and application ownership assertions.
- Reconfirm revocation removes delegated state/actions and blocks later access.
- Reconfirm academic meetings cannot be mutated.
- Reconfirm stale writes fail closed.

## 5. Real clients

Complete `docs/CLIENT_VALIDATION.md` against the exact release SHA for ChatGPT and Claude. Do not substitute local MCP inspectors or protocol tests for the named clients.

## 6. Reviewer account

- Reset the synthetic reviewer account to a deterministic known state.
- Verify every prompt in `docs/REVIEWER_GUIDE.md`.
- Store credentials privately; never commit them.

## 7. Submission

Use `docs/DIRECTORY_METADATA.md` and `docs/SUBMISSION_CHECKLIST.md` as the canonical source of listing copy, URLs, reviewer notes, and post-approval tasks.

## 8. Post-approval

- Add official platform listing links to `gapwise.ca/ai`.
- Update compatibility docs with exact validated surfaces and dates.
- Keep a record of material connector changes that require revalidation.
