# Gapwise AI documentation

The README provides the public overview; these documents define the implementation and security contract in more detail.

## Core design

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — trust boundaries, canonical ownership, and data flow.
- [`TOOL_CONTRACT.md`](TOOL_CONTRACT.md) — MCP tools, schemas, and mutation semantics.
- [`PRIVACY.md`](PRIVACY.md) — delegated data, exclusions, at-rest protection, and logging posture.
- [`THREAT_MODEL.md`](THREAT_MODEL.md) — primary threats, assumptions, controls, and residual risk.

## Operations and deployment

- [`ENVIRONMENT.md`](ENVIRONMENT.md) — server configuration and key/origin requirements.
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — Vercel/Supabase deployment contract and `ai.gapwise.ca` migration.
- [`OPERATIONS.md`](OPERATIONS.md) — fail-closed behavior, key rotation, incident response, and operational checks.
- [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) — service, real-client, and public-release gates.

## Project-level policies

- [`../SECURITY.md`](../SECURITY.md) — vulnerability reporting and non-negotiable security boundaries.
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — development and review expectations for contributors.
- [`../LICENSE`](../LICENSE) — MIT license.
