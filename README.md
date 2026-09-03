<div align="center">

<img src="public/logo-mark-purple.svg" width="116" alt="Gapwise AI deer mark" />

# Gapwise AI

### Permissioned intelligence on top of deterministic Gapwise truth.

**The provider-neutral OAuth and Model Context Protocol (MCP) integration layer for authorized access to explicitly delegated Gapwise student context and bounded actions.**

[![AI Service](https://img.shields.io/badge/AI_Service-ai.gapwise.ca-8B5CF6?style=for-the-badge&logo=vercel&logoColor=white)](https://ai.gapwise.ca/api/health)
[![MCP](https://img.shields.io/badge/MCP-Streamable_HTTP-8B5CF6?style=for-the-badge)](https://ai.gapwise.ca/api/mcp)
[![MIT](https://img.shields.io/badge/License-MIT-111111?style=for-the-badge)](LICENSE)

<sub>Next.js · TypeScript · MCP · OAuth · Supabase · Node · Vercel</sub>

<br />

**[Gapwise](https://gapwise.ca)** · **[Data](https://data.gapwise.ca)** · **[Docs](https://docs.gapwise.ca)** · **[Status](https://status.gapwise.ca)** · **[MCP](https://ai.gapwise.ca/api/mcp)** · **[Architecture](docs/ARCHITECTURE.md)** · **[Security](SECURITY.md)**

</div>

---

## What Gapwise AI is

Gapwise AI is the permissioned AI integration layer of **Gapwise**, a multi-surface campus-intelligence ecosystem created and engineered by **Andrew Muratov**.

Gapwise is not merely a timetable website. It spans a student web/PWA product, native mobile client, deterministic public campus API and published JavaScript/TypeScript and Python SDKs, an open data/provenance portal, developer documentation, an independent operational status service, and this separately deployed OAuth/MCP boundary for AI clients.

Andrew's work across the ecosystem spans **full-stack software engineering, cybersecurity and privacy engineering, platform architecture, API and SDK design, data engineering, developer infrastructure, mobile engineering, and permissioned AI integration**.

This repository is deliberately **not** a second timetable, routing, or gap-planning engine. The main [`gapwise`](https://github.com/andrewmuratov/gapwise) platform owns canonical student state and deterministic campus calculations. Gapwise AI exposes minimized, permission-checked interfaces to that truth.

> **Gapwise owns the facts. AI clients reason over explicitly delegated Gapwise context rather than becoming the source of truth.**

---

## Architecture and trust boundary

```text
Gapwise browser / platform
  canonical timetable + deterministic campus state
                    |
                    | explicit minimized delegation
                    v
               Gapwise AI
            OAuth + MCP boundary
                    |
       encrypted snapshot / queued action
                    v
             Supabase Postgres
                    ^
                    |
          user-scoped bearer token
                    |
               MCP client
```

There is no server-side LLM provider required by this repository. Compatible MCP clients supply the model/reasoning layer. Gapwise AI supplies authorization, bounded data access, schemas, deterministic context, and safe mutation semantics.

Academic meetings remain read-only to AI. Personal-item and preference writes are typed, permission-checked, revision-bound, and queued for Gapwise rather than granting an assistant arbitrary write access to a student's source timetable.

Delegated data excludes the raw ACORN `.ics`, friend data, precise/live location, account credentials, primary private-data encryption keys, and unrelated browser state. Delegated snapshots and queued actions use a separate encryption domain at rest. This is not represented as zero-knowledge encryption: authorized plaintext exists transiently during an authorized tool request.

---

## Current MCP surface

The live private surface provides permissioned tools for:

- delegation status;
- day and week schedule context;
- exact precomputed gap plans;
- delegated planning and routing preferences;
- compact decision context;
- available-window and weekly-opportunity discovery;
- feasibility checks for proposed personal blocks;
- bounded creation, update, and deletion of personal items;
- bounded gap-preference updates.

Imported/source-backed academic meetings are intentionally read-only.

Canonical endpoint:

```text
https://ai.gapwise.ca/api/mcp
```

OAuth protected-resource metadata and service health are published at the same first-party origin. Broad-client compatibility claims remain evidence-gated; production support should only be advertised for clients that have completed the relevant read/write/revoke and negative-path validation.

---

## Public developer platform

Gapwise AI is separate from the unauthenticated public campus platform. Developers who need public UTM campus intelligence without private student context should use the canonical v1 API or one of the published first-party SDKs:

```bash
npm install @gapwise/sdk@0.1.0
python -m pip install gapwise==0.1.0
```

- API: `https://api.gapwise.ca/v1`
- OpenAPI: `https://api.gapwise.ca/openapi.json`
- Docs: `https://docs.gapwise.ca`

The Python package is published on PyPI through Trusted Publishing and has been independently clean-installed against the production API. These public SDKs do not grant access to delegated private AI context; the OAuth/MCP boundary remains separate by design.

---

## Gapwise ecosystem

| Repository | Role | Primary surface |
| --- | --- | --- |
| **[`gapwise`](https://github.com/andrewmuratov/gapwise)** | Core web/PWA, canonical student-state behavior, deterministic campus engine, public API, OpenAPI, and published SDK source | [gapwise.ca](https://gapwise.ca) / [api.gapwise.ca](https://api.gapwise.ca/v1) |
| **[`gapwise-mobile`](https://github.com/andrewmuratov/gapwise-mobile)** | Native iOS and Android client | Native mobile app |
| **[`gapwise-ai`](https://github.com/andrewmuratov/gapwise-ai)** | OAuth/MCP layer for explicitly delegated student context and bounded AI actions | [ai.gapwise.ca](https://ai.gapwise.ca) |
| **[`gapwise-data`](https://github.com/andrewmuratov/gapwise-data)** | Open campus-data, provenance, schema, validation, and reuse portal | [data.gapwise.ca](https://data.gapwise.ca) |
| **[`gapwise-docs`](https://github.com/andrewmuratov/gapwise-docs)** | Canonical public developer documentation | [docs.gapwise.ca](https://docs.gapwise.ca) |
| **[`gapwise-status`](https://github.com/andrewmuratov/gapwise-status)** | Independent service-health monitoring and incident communication | [status.gapwise.ca](https://status.gapwise.ca) |

All six repositories share one product identity and source-of-truth hierarchy. AI consumes canonical Gapwise contracts; Data explains the evidence behind campus truth; Docs describes released behavior; Status communicates operational state.

---

## Local development

Requirements: Node.js 24.x, npm, and a compatible Supabase project for authenticated/delegation flows.

```bash
git clone https://github.com/andrewmuratov/gapwise-ai.git
cd gapwise-ai
npm ci
cp .env.example .env.local
npm run check
npm run dev
```

Security-sensitive changes should preserve the documented authorization, encryption, grounding, schema, and mutation boundaries. See [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md), [`docs/PRIVACY.md`](docs/PRIVACY.md), and [`SECURITY.md`](SECURITY.md).

---

## Project relationship

Gapwise is an independent project created by Andrew Muratov. It is not an official University of Toronto service and is not affiliated with or endorsed by the University of Toronto.

## License

[MIT](LICENSE) © 2026 Andrew Muratov.
