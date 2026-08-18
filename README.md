# Gapwise AI

Private, provider-neutral MCP integration service for [Gapwise for UTM](https://gapwise.ca).

Gapwise AI lets MCP-capable assistants such as ChatGPT and Claude reason from a user's **explicitly delegated, source-backed Gapwise timetable** and queue permissioned personal-planning changes without giving the service Gapwise's primary private-data encryption key.

## Security model

- Opt-in only; no delegation row means private tools fail closed.
- Academic meetings are read-only to AI.
- Raw ACORN `.ics`, friend data, precise location, main Gapwise DEKs/KEKs, OAuth codes, and refresh tokens are never tool data.
- Delegated snapshots and queued actions are AES-256-GCM encrypted before Supabase storage with a separate Vercel-only key.
- Every database request uses the caller's Supabase bearer token; owner-scoped RLS remains the authorization boundary.
- Writes require the current snapshot revision and are queued for the Gapwise browser to apply to canonical state.
- Tool/prompt payloads are not intentionally logged.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/PRIVACY.md`](docs/PRIVACY.md), and [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).

## MCP endpoint

```text
POST /api/mcp
```

The same Streamable HTTP endpoint is intended for ChatGPT, Claude, and later standards-compatible MCP clients. OAuth protected-resource metadata is published at:

```text
/.well-known/oauth-protected-resource
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

`get_my_gap_plan` currently returns exact schedule boundaries/preferences but deliberately leaves route-dependent fields unavailable until the shared deterministic Gapwise routing API is connected. It never substitutes LLM guesses for Gapwise routing truth.

## Browser delegation API

Gapwise itself uses:

```text
GET    /api/delegation
DELETE /api/delegation
PUT    /api/delegation/snapshot
GET    /api/delegation/actions
POST   /api/delegation/actions/:id/complete
```

## Development

Node 24 is the project runtime.

```bash
npm install
npm run check
```

Required environment variables are documented in [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md). Do not commit secrets or put them in public client variables.

## Deployment

Deploy as a separate Vercel project connected to this repository. Reuse Gapwise's existing Supabase project/user identities; do not create a second account database. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Status

Keep this repository private until the release checklist in [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) passes with real OAuth clients and production-equivalent configuration.

## License

MIT.
