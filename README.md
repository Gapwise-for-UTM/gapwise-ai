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

**[Gapwise](https://gapwise.ca)** · **[Status](https://status.gapwise.ca)** · **[Developers](https://gapwise.ca/developers)** · **[Developer docs](https://docs.gapwise.ca)** · **[MCP service](https://ai.gapwise.ca/api/mcp)** · **[Architecture](docs/ARCHITECTURE.md)** · **[Security](SECURITY.md)**

</div>

---

## What this repository is

Gapwise AI is the separate, provider-neutral **Model Context Protocol (MCP)** service that lets an authorized assistant work with a deliberately minimized slice of a student's Gapwise context.

It is not a second implementation of the Gapwise timetable, routing, or gap-planning engine. The main Gapwise application owns canonical student state and deterministic campus calculations; this repository exposes permissioned, bounded interfaces to that state.

The first-party repositories form one product ecosystem:

| Repository | Role in the Gapwise ecosystem |
| --- | --- |
| [`andrewmuratov/gapwise`](https://github.com/andrewmuratov/gapwise) | Core web/PWA product, canonical student-state behavior, deterministic campus intelligence, public API/OpenAPI contract, and SDK source |
| [`andrewmuratov/gapwise-mobile`](https://github.com/andrewmuratov/gapwise-mobile) | Native iOS and Android client consuming canonical Gapwise contracts and product semantics |
| **`andrewmuratov/gapwise-ai`** | Permissioned OAuth/MCP layer for explicitly delegated student context and bounded AI-facing actions |
| [`andrewmuratov/gapwise-docs`](https://github.com/andrewmuratov/gapwise-docs) | Public developer documentation plus the operator-maintained Gapwise status surface |

The architectural rule across the ecosystem is simple: **Gapwise owns the facts and deterministic calculations; mobile and AI consume those contracts, and the docs describe the released public surfaces rather than creating new truth.**

> [!IMPORTANT]
> **Release status: public release candidate.** The source repository is public and the production service is configured around `https://ai.gapwise.ca`. Real external OAuth/read/write/revoke validation remains a gate before claiming broad ChatGPT, Claude, or other MCP-client support. See [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md).

---

## Runtime and architecture

Gapwise AI is a **Next.js 16** server application running on **Node.js 24** and deployed separately from the main Gapwise app. It uses MCP, Zod schemas, caller-scoped Supabase access, and a separate AES-256-GCM encryption domain for delegated payloads.

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

The current `app/api/mcp/route.ts` registers **13 permissioned tools**: nine read/status/planning tools and four bounded write tools.

### Read, status, and planning

| Tool | Purpose |
| --- | --- |
| `get_ai_delegation_status` | Report delegation state, revision, and permissions without timetable content |
| `get_my_day` | Return source-backed meetings, delegated personal items, and delegated deterministic gap context for one date |
| `get_my_week` | Return the normalized delegated timetable for one academic term |
| `get_my_gap_plan` | Return an exact precomputed delegated Gapwise gap assessment |
| `get_my_ai_preferences` | Return only planning/routing preferences explicitly delegated to AI |
| `get_my_decision_context` | Return a compact term-level planning summary grounded in delegated Gapwise state |
| `find_my_available_windows` | Find bounded source-backed free windows for one date or term weekday |
| `find_my_weekly_opportunities` | Search all seven weekdays for usable windows while respecting delegated Gapwise activity budgets |
| `check_my_plan_feasibility` | Check a proposed personal block against hard conflicts and known delegated Gapwise constraints |

### Bounded writes

| Tool | Purpose |
| --- | --- |
| `create_personal_item` | Queue creation of a personal timetable item |
| `update_personal_item` | Queue a bounded update to an AI-visible personal item |
| `delete_personal_item` | Queue deletion of an AI-visible personal item |
| `update_gap_preferences` | Queue a bounded partial update to delegated gap preferences |

Imported/source-backed academic meetings are intentionally **read-only** to AI.

The repository also contains `src/mcp/public-campus-tools.ts`, which defines four stateless public-campus tool registrations backed by Gapwise's deterministic campus API. That module is **not currently registered by the live MCP handler**, so those definitions are not counted or advertised as exposed tools. Wiring them in is a runtime/security change and should be validated separately.

---

## Grounding, privacy, and safety

Gapwise AI keeps **Gapwise-grounded facts** distinct from **assistant advice or inference**. Schedule arithmetic, recurrence/exclusions, deterministic gap assessments, activity budgets, route status/accuracy, transition buffers, and leave-by/arrival values must not be silently recomputed or upgraded by a model when Gapwise already supplies them.

The delegated snapshot excludes raw ACORN `.ics` files, friend/friend-overlap data, precise/live location, Supabase access or refresh tokens, Gapwise's primary private-data DEK/KEK, unrestricted database credentials, and unrelated browser state.

Delegated snapshots and queued actions are encrypted before database storage with a separate **AES-256-GCM** key supplied by `GAPWISE_AI_DATA_KEY`. Database requests use the Supabase publishable key plus the authenticated caller's bearer token. This is **not zero-knowledge encryption**: authorized plaintext exists transiently in the Gapwise AI runtime while an authorized tool request is processed.

Write safety is deliberately narrow: academic meetings cannot be mutated; personal-item/preference writes require explicit permission and the expected snapshot revision; retries may use bounded idempotency keys; fixed personal-item writes are revalidated before queueing; and revocation removes delegated state/actions so later private access fails closed.

See [`docs/PRIVACY.md`](docs/PRIVACY.md) and [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) for the precise boundary.

---

## Service endpoints

| Endpoint | Purpose |
| --- | --- |
| `https://ai.gapwise.ca/api/mcp` | Canonical Streamable HTTP MCP endpoint |
| `https://ai.gapwise.ca/.well-known/oauth-protected-resource` | OAuth protected-resource metadata |
| `https://ai.gapwise.ca/api/health` | Service/configuration health endpoint |

`gapwise-ai.vercel.app` remains an infrastructure fallback alias in deployment/configuration code. Public clients and documentation use the first-party `ai.gapwise.ca` origin.

Current cross-service operational information is published at **https://status.gapwise.ca**. That page is operator-maintained and is not a continuous monitor, historical uptime record, or SLA.

The main Gapwise developer surface is available at `https://gapwise.ca/developers`, with API base `https://api.gapwise.ca/v1` and OpenAPI 3.1 contract at `https://api.gapwise.ca/openapi.json`.

---

## Local development

Requirements: **Node.js 24.x**, **npm**, and a Supabase project compatible with the documented Gapwise AI schema for authenticated/delegation flows.

```bash
git clone https://github.com/andrewmuratov/gapwise-ai.git
cd gapwise-ai
npm ci
cp .env.example .env.local
npm run check
npm run dev
```

`npm run check` runs TypeScript typecheck, Vitest, and a Next.js production build. CI additionally runs `npm audit --omit=dev --audit-level=high`.

### Environment

Required server-side variables:

| Variable | Purpose |
| --- | --- |
| `GAPWISE_SUPABASE_URL` | Supabase project origin for Auth and caller-scoped REST access |
| `GAPWISE_SUPABASE_PUBLISHABLE_KEY` | Non-service-role publishable key forwarded with caller-scoped requests |
| `GAPWISE_AI_DATA_KEY` | Base64/Base64url encoding of exactly 32 random bytes for the AI encryption domain |
| `GAPWISE_APP_ORIGIN` | Exact first-party Gapwise browser origin; production is `https://gapwise.ca` |

Optional: `GAPWISE_AI_ORIGIN` for alternate/self-hosted deployments and `GAPWISE_OPENAI_APPS_CHALLENGE_TOKEN` for temporary OpenAI domain verification. Never put credentials or encryption keys in `NEXT_PUBLIC_*` variables. See [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md).

---

## Repository map

```text
app/                  Next.js routes: MCP, delegation bridge, metadata, health
public/               purple Gapwise AI logo and favicon assets
src/auth/             bearer-token verification + MCP/OAuth metadata
src/crypto/           delegated-payload AES-256-GCM envelope encryption
src/db/               caller-scoped Supabase REST adapter
src/delegation/       permissions, revisions, revocation, queued actions
src/domain/           schemas + deterministic schedule/decision queries
src/mcp/              MCP formatting plus public-campus tool definitions
src/http/             bounded request/response and CORS helpers
src/openai/           optional OpenAI domain-verification challenge helper
tests/                authorization, grounding, crypto, domain, safety regressions
docs/                 architecture, privacy, deployment, operations, contracts
```

---

## Gapwise ecosystem

The first-party repositories are separate deployment surfaces with one product identity, trust model, and source-of-truth hierarchy:

| Repository | Role | Primary surface |
| --- | --- | --- |
| **[`gapwise`](https://github.com/andrewmuratov/gapwise)** | Core web/PWA product, canonical student-state behavior, deterministic UTM campus intelligence, public API, OpenAPI contract, and SDK source | [gapwise.ca](https://gapwise.ca) / [api.gapwise.ca](https://api.gapwise.ca/v1) |
| **[`gapwise-mobile`](https://github.com/andrewmuratov/gapwise-mobile)** | Native iOS and Android client consuming canonical Gapwise contracts and product semantics | Native mobile app |
| **[`gapwise-ai`](https://github.com/andrewmuratov/gapwise-ai)** | Permissioned OAuth/MCP layer for explicitly delegated student context and bounded AI actions | [ai.gapwise.ca](https://ai.gapwise.ca/api/mcp) |
| **[`gapwise-docs`](https://github.com/andrewmuratov/gapwise-docs)** | Public developer documentation plus the operator-maintained service-status surface | [docs.gapwise.ca](https://docs.gapwise.ca) / [status.gapwise.ca](https://status.gapwise.ca) |

`gapwise` remains authoritative for deterministic timetable, gap, campus, routing, and primary student-state semantics. `gapwise-ai` adds a bounded delegated interface rather than becoming a parallel source of truth; `gapwise-mobile` consumes the same contracts; `gapwise-docs` documents released behavior.

---

## Documentation

| Document | Covers |
| --- | --- |
| [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Trust boundaries and data flow |
| [`API.md`](docs/API.md) | Browser delegation endpoints and current MCP surface |
| [`TOOL_CONTRACT.md`](docs/TOOL_CONTRACT.md) | Registered tools and mutation semantics |
| [`PRIVACY.md`](docs/PRIVACY.md) | Delegated-data and disclosure model |
| [`THREAT_MODEL.md`](docs/THREAT_MODEL.md) | Threats, assumptions, and controls |
| [`ENVIRONMENT.md`](docs/ENVIRONMENT.md) | Runtime configuration and secret handling |
| [`DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Vercel/Supabase production contract |
| [`RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) | Remaining broad-client release gates |
| [`STATUS.md`](docs/STATUS.md) | AI release status and the canonical cross-service status page |

## Contributing and security

Security-sensitive changes must preserve the documented trust boundaries and include regression coverage for changed authorization, schemas, encryption, grounding, or mutation behavior. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

Do **not** disclose vulnerabilities in a public issue. Follow [`SECURITY.md`](SECURITY.md) for responsible reporting.

## Project relationship

Gapwise AI is part of the independent [Gapwise](https://gapwise.ca) project. It is not an official University of Toronto service and is not affiliated with or endorsed by the University of Toronto.

## License

[MIT](LICENSE) © 2026 Andrew Muratov.
