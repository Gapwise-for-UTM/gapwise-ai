# Gapwise AI

Private, provider-neutral MCP integration service for [Gapwise for UTM](https://gapwise.ca).

Gapwise AI lets MCP-capable assistants such as ChatGPT and Claude reason from a user's **explicitly delegated, source-backed Gapwise timetable** and queue permissioned personal-planning changes without giving the service Gapwise's primary private-data encryption key.

## Security model

- Opt-in only; no delegation row means private tools fail closed.
- Academic meetings are read-only to AI.
- Raw ACORN `.ics`, friend data, precise location, main Gapwise DEKs/KEKs, OAuth codes, and refresh tokens are never tool data.
- Delegated snapshots and queued actions are AES-256-GCM encrypted before Supabase storage with a separate Vercel-only key.
- Every database request uses the caller's Supabase bearer token; owner/client-scoped RLS remains the authorization boundary.
- Writes require the current snapshot revision and are queued for the Gapwise browser to validate and apply to canonical state.
- Tool/prompt payloads are not intentionally logged.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/PRIVACY.md`](docs/PRIVACY.md), and [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).

## MCP endpoint

```text
https://gapwise-ai.vercel.app/api/mcp
```

The same Streamable HTTP endpoint is intended for ChatGPT, Claude, and later standards-compatible MCP clients. OAuth protected-resource metadata is published at:

```text
https://gapwise-ai.vercel.app/.well-known/oauth-protected-resource
```

### Private tools

- `get_ai_delegation_status`
- `get_my_day`
- `get_my_week`
- `get_my_gap_plan`
- `get_my_ai_preferences`
- `create_personal_item`
- `update_personal_item`
- `delete_personal_item`
- `update_gap_preferences`

When the user enables gap-plan sharing, `get_my_gap_plan` returns Gapwise's **precomputed deterministic assessment for the exact delegated gap**: routing status/confidence, travel and risk-buffer time, leave-by/arrival time, ranked recommendations, reasons, tags, and timeline segments. If an exact source-backed assessment was not delegated, the tool reports that fact instead of inventing route or usable-time data.

## Browser delegation API

Gapwise itself uses:

```text
GET    /api/delegation
DELETE /api/delegation
PUT    /api/delegation/snapshot
GET    /api/delegation/actions
POST   /api/delegation/actions/:id/complete
POST   /api/delegation/clients
DELETE /api/delegation/clients
```

These browser endpoints are separate from MCP authentication. OAuth-client JWTs are additionally constrained by database RLS and cannot use the direct-browser mutation paths for authoritative snapshots or action completion.

## Development

Node 24 is the project runtime.

```bash
npm install
npm run check
```

Required environment variables are documented in [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md). Do not commit secrets or put them in public client variables.

## Deployment

Production is deployed as the separate Vercel project `gapwise-ai` at `https://gapwise-ai.vercel.app`. It reuses Gapwise's existing Supabase project/user identities; there is no second account database. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Status

Keep this repository private until the release checklist in [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) passes with real OAuth clients and production-equivalent configuration.

## License

MIT.
