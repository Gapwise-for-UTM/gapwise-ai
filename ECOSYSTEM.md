# Gapwise ecosystem integration

`gapwise-ai` is the OAuth/MCP trust boundary of the six-repository Gapwise ecosystem. It exposes explicitly delegated, minimized student context and bounded actions to compatible AI clients. It does not replace deterministic Gapwise product logic, the public campus API, or the public SDKs.

## Connected surfaces

- Core product/API/SDK source: `andrewmuratov/gapwise`
- Public API: `https://api.gapwise.ca/v1`
- OpenAPI: `https://api.gapwise.ca/openapi.json`
- Data/provenance: `https://data.gapwise.ca`
- Developer docs: `https://docs.gapwise.ca`
- AI/MCP endpoint: `https://ai.gapwise.ca/api/mcp`
- Operational status: `https://status.gapwise.ca`
- Native mobile client: `andrewmuratov/gapwise-mobile`

## Public SDK state

Public campus developers use equal first-party SDKs owned by the core repository:

- TypeScript `@gapwise/sdk`: npm `0.1.0` is published. The same package identity is reserved on JSR and linked to the core GitHub repository for OIDC publishing; a JSR version is not released until the registry confirms it. Node, Bun, and Deno are runtime targets for one portable TypeScript implementation, not separate SDKs.
- Python `gapwise==0.1.0`: published on PyPI through Trusted Publishing.

These SDKs intentionally expose public campus intelligence only. They do not grant access to private student schedules, delegation state, queued actions, or AI authorization.

## AI-specific source-of-truth rules

1. Deterministic timetable, gap, routing, campus, and leave-by calculations remain owned by `gapwise`.
2. AI consumes explicit delegated representations of canonical state rather than recomputing authoritative student facts from prose.
3. Imported/source-backed academic meetings remain read-only to AI.
4. Personal-item and preference mutations remain typed, scoped, permission-checked, revision-bound, and bounded by the core product model.
5. Raw ACORN files, friend data, precise/live location, credentials, primary private-data encryption keys, and unrelated browser state remain outside the delegated surface unless an explicit future design and security review says otherwise.
6. Named AI-client compatibility is only advertised after end-to-end OAuth/read/write/revoke and negative-path evidence exists.
7. Public SDK/runtime/registry changes must not blur the private OAuth/MCP boundary.

## Change impact

When an MCP resource/tool/schema changes, check whether it requires updates to:

- canonical `gapwise` state or deterministic calculations;
- mobile AI surfaces and permission UX;
- `gapwise-docs` AI/OAuth/MCP documentation;
- `gapwise-data` if new campus facts/provenance are surfaced;
- `gapwise-status` health probes or incident wording;
- public SDK docs only when the public campus contract itself changes.

AI is integrated with the ecosystem through explicit contracts and permissions, not through hidden duplication of product logic.
