# Gapwise ecosystem integration

`ai` is the OAuth/MCP trust boundary of the seven-repository Gapwise product ecosystem. It exposes stateless public UTM campus intelligence plus explicitly delegated, minimized student context and bounded actions to compatible AI clients. It does not replace deterministic Gapwise product logic, the public campus API, or the public SDKs.

All seven first-party product repositories are owned by the **Gapwise for UTM** GitHub organization (`Gapwise-for-UTM`). Organization-wide GitHub defaults live in the separate `.github` repository. Andrew Muratov remains the creator and primary maintainer.

## Connected surfaces

- GitHub organization: `https://github.com/Gapwise-for-UTM`
- Core product/API/SDK source: `Gapwise-for-UTM/gapwise`
- Native Android client: `Gapwise-for-UTM/android`
- Native iOS client: `Gapwise-for-UTM/ios`
- AI/MCP source: `Gapwise-for-UTM/ai`
- Campus data/provenance source: `Gapwise-for-UTM/data`
- Developer documentation source: `Gapwise-for-UTM/docs`
- Operational status source: `Gapwise-for-UTM/status`
- Public API: `https://api.gapwise.ca/v1`
- OpenAPI: `https://api.gapwise.ca/openapi.json`
- Data/provenance: `https://data.gapwise.ca`
- Developer docs: `https://docs.gapwise.ca`
- AI/MCP endpoint: `https://ai.gapwise.ca/api/mcp`
- Operational status: `https://status.gapwise.ca`

## Product scope

Gapwise timetable identity supports UTM, UTSG, UTSC, and mixed-campus schedules. Public campus intelligence exposed by this repository remains UTM-focused because the current canonical first-party map/routing/data layer is UTM-focused. AI must not infer equivalent St. George or Scarborough routing coverage merely because a timetable can contain those campuses.

## Public SDK state

Public campus developers use equal first-party SDKs owned by the core repository:

- TypeScript `@gapwise/sdk`: version `0.1.1` is published on both npm and JSR through provenance-backed GitHub Actions publishing. Node, Bun, and Deno are runtime targets for one portable TypeScript implementation, not separate SDKs.
- Python `gapwise==0.1.0`: published on PyPI through Trusted Publishing.

These SDKs intentionally expose public campus intelligence only. They do not grant access to private student schedules, delegation state, queued actions, or AI authorization.

## AI-specific source-of-truth rules

1. Deterministic timetable, gap, routing, campus, and leave-by calculations remain owned by `gapwise`.
2. Android and iOS consume canonical product semantics rather than becoming alternate timetable/routing authorities.
3. AI consumes explicit delegated representations of canonical state rather than recomputing authoritative student facts from prose.
4. Imported/source-backed academic meetings remain read-only to AI.
5. Supported personal-item and preference mutations remain typed, scoped, permission-checked, revision-bound, and bounded by the core product model.
6. Raw ACORN files, friend data, precise/live location, credentials, primary private-data encryption keys, and unrelated browser state remain outside the delegated surface unless an explicit future design and security review says otherwise.
7. Named AI-client compatibility is only advertised after end-to-end OAuth/read/write/revoke and negative-path evidence exists.
8. Public SDK/runtime/registry changes must not blur the private OAuth/MCP boundary.
9. All-campus timetable identity must not be presented as all-campus public map/routing coverage.

## Change impact

When an MCP resource/tool/schema changes, check whether it requires updates to:

- canonical `gapwise` state or deterministic calculations;
- `android` AI surfaces and permission UX;
- `ios` AI surfaces and permission UX;
- `docs` AI/OAuth/MCP documentation;
- `data` if new campus facts/provenance are surfaced;
- `status` health probes or incident wording;
- public SDK docs only when the public campus contract itself changes.

AI is integrated with the ecosystem through explicit contracts and permissions, not through hidden duplication of product logic.
