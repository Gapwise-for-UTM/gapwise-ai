# Release evidence checkpoint — 2026-08-30

This is a dated **static/automated release-evidence checkpoint**, not a declaration of broad external-client support.

## What this checkpoint verifies

The pull request carrying this file is intentionally used to rerun the repository's full `npm run check` path on a fresh head. That command executes, in order:

1. the reachable-history high-confidence secret scan (`npm run scan:secrets`);
2. TypeScript typecheck;
3. the Vitest suite;
4. the Next.js production build.

CI also runs the production-dependency audit configured by the repository workflow. Vercel preview/deployment status and repository review integrations remain separate evidence sources.

## Static trust-boundary review

Fresh source review confirms the intended boundaries remain explicit:

- access tokens are cryptographically validated through Supabase Auth before decoded claims are trusted;
- MCP access additionally requires an OAuth `client_id`, the exact protected-resource audience, and required scopes;
- first-party browser delegation routes reject OAuth-client tokens so third-party clients cannot bypass MCP tool contracts;
- browser CORS allows only the configured first-party Gapwise origin and fails closed for other origins;
- delegated snapshots/actions use a separate AES-256-GCM data-key domain and remain ciphertext in Postgres;
- database access uses the non-privileged Supabase publishable key plus the authenticated caller bearer token rather than a service-role credential;
- audit events are allowlisted metadata only and exclude prompts, tool arguments/results, timetable content, bearer tokens, request bodies, headers, and encryption material;
- runtime regression tests forbid shell/dynamic-code primitives, direct unbounded `Request.json()` parsing, raw HTML injection, and client-exposed privileged secret names.

## What remains external

This checkpoint does **not** complete the real-client release gates. Broad support claims remain blocked on:

- the real Claude OAuth/read/write/revoke matrix;
- the real ChatGPT OAuth/read/write/revoke matrix;
- no-delegation/read-only/write-disabled/stale-write/revoke/re-auth production-equivalent cases;
- a final exact-head scan/CI/deployment confirmation after those external matrices are complete.

The release checklist remains authoritative for those gates.
