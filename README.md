<div align="center">

<img src="public/logo-mark-purple.svg" width="116" alt="Gapwise AI deer mark" />

# Gapwise AI

### Permissioned intelligence on top of deterministic Gapwise data.

**The provider-neutral MCP integration layer for authorized access to explicitly delegated Gapwise student context.**

[![AI Service](https://img.shields.io/badge/AI_Service-ai.gapwise.ca-8B5CF6?style=for-the-badge&logo=vercel&logoColor=white)](https://ai.gapwise.ca/api/health)
[![CI](https://img.shields.io/github/actions/workflow/status/andrewmuratov/gapwise-ai/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/andrewmuratov/gapwise-ai/actions/workflows/ci.yml)
[![MCP](https://img.shields.io/badge/MCP-Streamable_HTTP-8B5CF6?style=for-the-badge)](https://ai.gapwise.ca/api/mcp)
[![MIT](https://img.shields.io/badge/License-MIT-111111?style=for-the-badge)](LICENSE)

<sub>Next.js 16.3 · TypeScript 5.8 · MCP · Supabase · npm · Node 24 · Vercel</sub>

<br />

**[Gapwise](https://gapwise.ca)** · **[Developers](https://gapwise.ca/developers)** · **[Developer docs](https://docs.gapwise.ca)** · **[MCP service](https://ai.gapwise.ca/api/mcp)** · **[Architecture](docs/ARCHITECTURE.md)** · **[Security](SECURITY.md)**

</div>

---

## What this repository is

Gapwise AI is the separate, provider-neutral **Model Context Protocol (MCP)** service that lets an authorized assistant work with a deliberately minimized slice of a student's Gapwise context.

It is not a second implementation of the Gapwise timetable, routing, or gap-planning engine. The main Gapwise application owns canonical student state and deterministic campus calculations; this repository exposes permissioned, bounded interfaces to that state.

| Repository | Role in the Gapwise ecosystem |
| --- | --- |
| [`andrewmuratov/gapwise`](https://github.com/andrewmuratov/gapwise) | Core product, canonical private student state, and deterministic campus-intelligence system |
| [`andrewmuratov/gapwise-docs`](https://github.com/andrewmuratov/gapwise-docs) | Public developer documentation for the Gapwise API, OpenAPI contract, and SDK surface |
| **`andrewmuratov/gapwise-ai`** | Permissioned MCP layer for explicitly delegated student context and bounded AI-facing actions |

The architectural rule is the same across the ecosystem: **Gapwise owns the facts and deterministic calculations; AI clients reason over those facts without silently recreating them.**

> [!IMPORTANT]
> **Release status: private release candidate.** The production service is configured around `https://ai.gapwise.ca`, but the repository intentionally remains private while real external OAuth/read/write/revoke validation and the final pre-publication secret/history scan remain release gates. Do not interpret the presence of ChatGPT/Claude integration documentation as a claim of universal client support. See [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md).

---

## What runs here

Gapwise AI is a **Next.js 16** server application running on **Node.js 24** and deployed separately from the main Gapwise app. It uses the Model Context Protocol server stack, Zod schemas, caller-scoped Supabase access, and a separate AES-256-GCM encryption domain for delegated payloads.

There is **no server-side LLM provider in this repository**. Gapwise AI does not call OpenAI, Anthropic, or another model API to generate answers. Compatible MCP clients supply the model/reasoning layer. The optional `GAPWISE_OPENAI_APPS_CHALLENGE_TOKEN` is only for first-party domain verification during an OpenAI app submission flow; it is not a model API key.

```text
Gapwise browser
  canonical timetable + private state
          |
          | explicit minimized delegation
          v
     Gapwise AI
  OAuth + MCP boundary
          |
          | encrypted snapshot / queued action
          v
   Supabase Postgres
          ^
          |
          | user-scoped OAuth bearer token
          |
     MCP client
```

The browser remains canonical for academic meetings and the primary encrypted private state. MCP write success means a typed action was **queued for Gapwise**, not that the assistant directly rewrote a student's source timetable.

---

## Current MCP surface

The current `app/api/mcp/route.ts` registers **13 permissioned tools**: nine read/status/planning tools and four bounded write tools. Tool discovery is provider-neutral; private calls require verified OAuth context and an enabled delegation with the necessary permissions.

### Read, status, and planning tools

| Tool | Purpose |
| --- | --- |
| `get_ai_delegation_status` | Report delegation state, revision, and permissions without returning timetable content |
| `get_my_day` | Return source-backed meetings, delegated personal items, and delegated deterministic gap context for one date |
| `get_my_week` | Return the normalized delegated timetable for one academic term |
| `get_my_gap_plan` | Return an exact precomputed delegated Gapwise gap assessment |
| `get_my_ai_preferences` | Return only planning/routing preferences explicitly delegated to AI |
| `get_my_decision_context` | Return a compact term-level planning summary grounded in delegated Gapwise state |
| `find_my_available_windows` | Find bounded source-backed free windows for one date or term weekday |
| `find_my_weekly_opportunities` | Search Monday–Friday for usable windows while respecting delegated Gapwise activity budgets |
| `check_my_plan_feasibility` | Check a proposed personal block against hard conflicts and known delegated Gapwise constraints |

### Bounded write tools

| Tool | Purpose |
| --- | --- |
| `create_personal_item` | Queue creation of a personal timetable item |
| `update_personal_item` | Queue a bounded update to an AI-visible personal item |
| `delete_personal_item` | Queue deletion of an AI-visible personal item |
| `update_gap_preferences` | Queue a bounded partial update to delegated gap preferences |

Imported/source-backed academic meetings are intentionally **read-only** to AI.

The repository also contains `src/mcp/public-campus-tools.ts`, which defines four stateless public-campus tool registrations backed by Gapwise's deterministic campus API. That module is **not currently registered by the live MCP handler**, so this README does not count or advertise those four definitions as exposed tools. Wiring that module into the production handler would be a runtime change and should be validated separately from this branding/documentation update.

---

## Grounding contract

Gapwise AI keeps two kinds of output distinct:

- **Gapwise-grounded facts** — values actually returned by Gapwise or present in the explicitly delegated snapshot;
- **assistant advice/inference** — conclusions, prioritization, explanations, or outside knowledge supplied by the client model.

Schedule arithmetic, recurrence/exclusions, deterministic gap assessments, activity budgets, routing status/accuracy, transition buffers, and leave-by/arrival values must not be recomputed or upgraded by the model when Gapwise already supplies them.

Unknown, approximate, unavailable, and accessibility-unverified states remain visible rather than being rewritten as confident guesses.

---

## Privacy and safety boundaries

AI access is explicit opt-in and separate from ordinary Gapwise sign-in. The delegated snapshot is intentionally narrower than the user's full Gapwise state.

It excludes:

- raw ACORN `.ics` files;
- friend/friend-overlap data;
- precise or live location;
- Supabase access or refresh tokens;
- Gapwise's primary private-data DEK/KEK;
- credentials or unrestricted database access;
- unrelated browser state.

Delegated snapshots and queued actions are encrypted before database storage with a separate **AES-256-GCM** key supplied by `GAPWISE_AI_DATA_KEY`. Database requests use the Supabase publishable key plus the authenticated caller's bearer token; the runtime does not require a Supabase service-role key for its normal MCP/delegation data path.

This is **not zero-knowledge encryption**: authorized plaintext exists transiently in the Gapwise AI runtime while an authorized tool request is processed. The trust boundary is documented in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/PRIVACY.md`](docs/PRIVACY.md), and [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).

Write safety is deliberately narrow:

- academic meetings cannot be mutated;
- personal-item/preference writes require explicit permission;
- writes carry the expected snapshot revision;
- retries can use bounded idempotency keys;
- fixed personal-item writes are revalidated against delegated hard conflicts and known Gapwise constraints before queueing;
- revocation removes delegated state/actions and later private access fails closed.

---

## Service endpoints

Canonical production origin:

```text
https://ai.gapwise.ca
```

| Endpoint | Purpose |
| --- | --- |
| `https://ai.gapwise.ca/api/mcp` | Streamable HTTP MCP endpoint |
| `https://ai.gapwise.ca/.well-known/oauth-protected-resource` | OAuth protected-resource metadata |
| `https://ai.gapwise.ca/api/health` | Service/configuration health endpoint |

`gapwise-ai.vercel.app` remains a documented infrastructure fallback alias in deployment/configuration code, but public clients and documentation should use the first-party `ai.gapwise.ca` origin.

The main Gapwise developer surface remains:

- Developer hub: `https://gapwise.ca/developers`
- Public API base: `https://api.gapwise.ca/v1`
- OpenAPI 3.1: `https://api.gapwise.ca/openapi.json`

---

## Local development

Requirements:

- **Node.js 24.x**
- **npm** (the repository is locked with `package-lock.json`)
- a Supabase project compatible with the documented Gapwise AI schema for authenticated/delegation flows

```bash
git clone https://github.com/andrewmuratov/gapwise-ai.git
cd gapwise-ai
npm ci
cp .env.example .env.local
npm run check
npm run dev
```

`npm run check` runs the repository's local release-oriented checks in this order:

```text
TypeScript typecheck → Vitest unit tests → Next.js production build
```

GitHub Actions additionally runs `npm audit --omit=dev --audit-level=high` before the production build.

### Environment variables

Required server-side variables:

| Variable | Purpose |
| --- | --- |
| `GAPWISE_SUPABASE_URL` | Supabase project origin used for Auth and caller-scoped REST access |
| `GAPWISE_SUPABASE_PUBLISHABLE_KEY` | Non-service-role publishable key forwarded with caller-scoped requests |
| `GAPWISE_AI_DATA_KEY` | Base64/Base64url encoding of exactly 32 random bytes for the separate AI encryption domain |
| `GAPWISE_APP_ORIGIN` | Exact first-party Gapwise browser origin allowed by the delegation API; production is `https://gapwise.ca` |

Optional variables:

| Variable | Purpose |
| --- | --- |
| `GAPWISE_AI_ORIGIN` | Override the externally visible AI origin for alternate/self-hosted deployments |
| `GAPWISE_OPENAI_APPS_CHALLENGE_TOKEN` | Temporary OpenAI app-domain verification token when a submission flow requests it |

Never place credentials, OAuth secrets, encryption keys, or private server configuration in `NEXT_PUBLIC_*` variables. See [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) for the complete contract.

---

## Repository map

```text
app/                  Next.js routes: MCP, delegation bridge, metadata, health
public/               Gapwise AI purple logo and favicon assets
src/auth/             bearer-token verification + MCP/OAuth metadata
src/crypto/           delegated-payload AES-256-GCM envelope encryption
src/db/               caller-scoped Supabase REST adapter
src/delegation/       permissions, revisions, revocation, and queued actions
src/domain/           schemas + deterministic schedule/decision queries
src/mcp/              MCP formatting plus public-campus tool definitions
src/http/             bounded request/response and CORS helpers
src/openai/           optional OpenAI domain-verification challenge helper
tests/                authorization, grounding, crypto, domain, and safety regressions
docs/                 architecture, privacy, deployment, operations, and contracts
```

---

## Documentation

| Document | Covers |
| --- | --- |
| [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Trust boundaries and data flow |
| [`API.md`](docs/API.md) | Browser delegation endpoints and the current MCP tool surface |
| [`TOOL_CONTRACT.md`](docs/TOOL_CONTRACT.md) | Registered MCP tools and mutation semantics |
| [`PRIVACY.md`](docs/PRIVACY.md) | Delegated-data and disclosure model |
| [`THREAT_MODEL.md`](docs/THREAT_MODEL.md) | Threats, assumptions, and controls |
| [`ENVIRONMENT.md`](docs/ENVIRONMENT.md) | Runtime configuration and secret handling |
| [`DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Vercel/Supabase production contract and first-party origin |
| [`OPERATIONS.md`](docs/OPERATIONS.md) | Fail-closed operation and incident handling |
| [`RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) | Gates before broad/public release |

---

## Contributing and security

Security-sensitive changes must preserve the documented trust boundaries and include regression coverage for any changed authorization, schema, encryption, grounding, or mutation behavior. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

Do **not** disclose vulnerabilities in a public issue. Follow [`SECURITY.md`](SECURITY.md) for responsible reporting and the project's non-negotiable security boundaries.

---

## Project relationship

Gapwise AI is part of the independent [Gapwise](https://gapwise.ca) project. It is not an official University of Toronto service and is not affiliated with or endorsed by the University of Toronto.

## License

[MIT](LICENSE) © 2026 Andrew Muratov.
