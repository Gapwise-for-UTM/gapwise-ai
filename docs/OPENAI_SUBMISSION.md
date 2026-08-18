# OpenAI app submission checklist

This document is the release gate for submitting the production Gapwise MCP service to OpenAI.

## Production identity

- MCP URL: `https://ai.gapwise.ca/api/mcp`
- Protected-resource metadata: `https://ai.gapwise.ca/.well-known/oauth-protected-resource`
- OAuth authorization server: the Gapwise Supabase Auth project discovered from protected-resource metadata
- Domain challenge: `https://ai.gapwise.ca/.well-known/openai-apps-challenge`
- Public product site: `https://gapwise.ca`

The infrastructure alias `https://gapwise-ai.vercel.app` is not a second OAuth resource. Production metadata canonicalizes both hostnames to `https://ai.gapwise.ca/api/mcp`.

## Domain verification

When OpenAI supplies a domain-verification token, set it only in the production deployment as `GAPWISE_OPENAI_APPS_CHALLENGE_TOKEN`. The challenge route must return the token as the entire response body, with no JSON wrapper or extra text. Remove the variable after verification if OpenAI no longer requires the endpoint to remain populated.

## Tool review assertions

All tools:

- identify OAuth in their MCP `_meta.securitySchemes` metadata;
- remain discoverable before authentication;
- return an in-band `_meta["mcp/www_authenticate"]` challenge when invoked without a valid caller;
- derive the Gapwise user exclusively from the verified bearer token;
- reject ordinary browser-session tokens for MCP because they lack an OAuth `client_id`;
- reject OAuth bearer tokens that are not targeted at the canonical Gapwise MCP resource.

Write tools additionally require the current snapshot revision and the corresponding explicit delegation permission. Academic course meetings cannot be mutated through the MCP surface.

## Positive reviewer test cases

1. **Check connection status** — Connect a Gapwise account, invoke `get_ai_delegation_status`, and confirm the tool reports whether AI access is enabled without exposing timetable content when it is disabled.
2. **Read one day** — With schedule delegation enabled, invoke `get_my_day` for a weekday represented in the user's source-backed timetable and confirm returned meetings match Gapwise exactly.
3. **Read deterministic gap plan** — Invoke `get_my_gap_plan` for a delegated gap and confirm route status, confidence, travel/buffer timing, and recommendation reasons are preserved rather than recomputed by the model.
4. **Queue a personal item** — With personal-item write permission enabled, read the current revision and invoke `create_personal_item`; confirm the response is a queued action rather than a direct academic schedule mutation.
5. **Update delegated planning preferences** — With preference write permission enabled, invoke `update_gap_preferences` using the current revision and confirm the bounded patch is queued.

## Negative reviewer test cases

1. **Unauthenticated tool call** — Invoke any tool before connecting Gapwise. The call must fail with `isError: true` and include `_meta["mcp/www_authenticate"]`; no Gapwise data may be returned.
2. **Stale revision write** — Read a snapshot, change the Gapwise state so the revision advances, then retry a write using the old revision. The tool must return a conflict and make no dependent assumption.
3. **Forbidden academic mutation / missing permission** — Attempt to target an academic class with a personal-item write path, or disable the relevant write delegation before making a write. The action must be rejected rather than broadening authority.

## Release checks before submission

1. `npm run check` passes on the exact production commit.
2. GitHub branch protection/status checks are green.
3. Supabase OAuth server and dynamic registration settings are verified in the dashboard.
4. The custom access-token hook is enabled and new OAuth tokens contain `resource: "https://ai.gapwise.ca/api/mcp"` while retaining normal Supabase claims.
5. Both production hostnames publish protected-resource metadata whose `resource` is exactly `https://ai.gapwise.ca/api/mcp`.
6. Unauthenticated MCP initialization and `tools/list` succeed, but unauthenticated `tools/call` returns the in-band authentication challenge.
7. A newly issued OAuth token succeeds against the MCP endpoint; an ordinary browser token and a wrong-resource token fail.
8. The OpenAI domain challenge is configured only when the submission portal provides a token, and its live response body is exactly that token.
9. OpenAI's Scan Tools step reports the intended nine tools with accurate descriptions and annotations.
10. Complete one end-to-end connection in ChatGPT and one in Claude using non-production test data before broad launch.

## Release notes template

> Gapwise adds a permissioned MCP integration for AI clients. Connected users can read explicitly delegated timetable, gap-planning, and preference data and may queue bounded personal-item or preference changes when those permissions are enabled. Academic course meetings remain source-backed and read-only. OAuth credentials are user-scoped, resource-bound, and protected by existing Supabase RLS plus Gapwise's per-user OAuth-client approval gate.
