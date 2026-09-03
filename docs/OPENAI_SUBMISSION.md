# OpenAI app submission checklist

This document is the OpenAI-specific release gate for the production Gapwise MCP service. Use `DIRECTORY_METADATA.md`, `REVIEWER_GUIDE.md`, and `SUBMISSION_CHECKLIST.md` as the canonical cross-platform listing/reviewer package.

## Production identity

- MCP URL: `https://ai.gapwise.ca/api/mcp`
- Protected-resource metadata: `https://ai.gapwise.ca/.well-known/oauth-protected-resource`
- OAuth authorization server: the Gapwise Supabase Auth project discovered from protected-resource metadata
- Domain challenge: `https://ai.gapwise.ca/.well-known/openai-apps-challenge`
- Public product site: `https://gapwise.ca`
- AI product page: `https://gapwise.ca/ai`
- Privacy: `https://gapwise.ca/privacy`
- Terms: `https://gapwise.ca/terms`
- Support: `https://gapwise.ca/support`

The infrastructure alias `https://gapwise-ai.vercel.app` is not a second OAuth resource. Production metadata canonicalizes both hostnames to `https://ai.gapwise.ca/api/mcp`.

## Domain verification

When OpenAI supplies a domain-verification token, set it only in production as `GAPWISE_OPENAI_APPS_CHALLENGE_TOKEN`. The challenge route must return the token as the entire response body, with no JSON wrapper or extra text. Do not invent a token before the submission flow provides one.

## Tool review assertions

The release surface contains **17 tools**:

- four public stateless UTM campus-intelligence tools with no private OAuth security declaration;
- nine OAuth-protected private read/status/planning tools; and
- four OAuth-protected bounded write tools.

For private tools, Gapwise:

- advertises OAuth through the compatibility metadata/root projection required by the client;
- requests only the supported minimal `email` identity scope;
- derives the Gapwise user exclusively from the verified bearer token;
- rejects ordinary browser-session tokens because they lack an OAuth `client_id` and MCP audience;
- rejects OAuth bearer tokens whose `aud` does not contain exactly `https://ai.gapwise.ca/api/mcp`;
- rejects tokens missing the required granted scope; and
- returns an in-band `_meta["mcp/www_authenticate"]` challenge when private execution lacks a valid caller.

Public tools do not inherit those OAuth declarations and never access private Gapwise state. All tools declare input/output schemas and bounded capability descriptions. Write tools additionally require the current snapshot revision and the corresponding explicit delegation permission. Academic course meetings cannot be mutated through the MCP surface.

## Positive reviewer test cases

1. **Public building lookup** — Ask what a known UTM building code means and confirm the public tool works without private Gapwise schedule access.
2. **Public route** — Request a building-to-building route and confirm Gapwise route status/confidence/accessibility warnings are preserved.
3. **Check private connection status** — Connect a synthetic Gapwise account, invoke `get_ai_delegation_status`, and confirm the tool reports delegation state without exposing timetable content when disabled.
4. **Read one day** — With schedule delegation enabled, invoke `get_my_day` for a represented weekday and confirm returned meetings match Gapwise exactly.
5. **Find weekly opportunity** — Request a realistic study interval and confirm the client uses `find_my_weekly_opportunities` rather than model-side interval subtraction.
6. **Queue a personal item** — With personal-item write permission enabled, read the current revision and invoke `create_personal_item`; confirm the response is a queued action rather than a direct academic schedule mutation.

## Negative reviewer test cases

1. **Private call before connection** — Invoke a private tool before connecting Gapwise. The call must fail with the OAuth challenge and return no private data.
2. **Unapproved OAuth client** — An unapproved OAuth client must not receive the MCP audience needed for private access.
3. **Wrong audience or missing scope** — A cryptographically valid token without the exact MCP audience or required scope remains unauthenticated.
4. **Stale revision write** — A write using an old snapshot revision must fail without silently overwriting newer state.
5. **Forbidden academic mutation / missing permission** — Attempts to alter an academic meeting or exceed delegated write authority must fail.
6. **Revocation** — Revoke the connector/delegation and confirm subsequent private reads/writes fail until explicit reauthorization.

## Release checks before submission

1. `npm run check` and CI pass on the exact production commit.
2. Supabase OAuth Server and Gapwise `/oauth/consent` are active with the intended MCP client-registration flow.
3. Approved OAuth tokens contain the exact MCP audience; browser/unapproved/wrong-audience tokens do not.
4. Production protected-resource metadata identifies `https://ai.gapwise.ca/api/mcp` and the supported `email` scope.
5. MCP initialization and `tools/list` expose all 17 tools with four public tools lacking OAuth declarations and 13 private tools carrying them.
6. The production OpenAI domain challenge is configured only if/when the current submission portal supplies a token.
7. The complete real ChatGPT OAuth/read/write/revoke and negative-path matrix in `CLIENT_VALIDATION.md` passes against the exact release SHA.
8. The synthetic reviewer account is reset to the fixture in `TEST_ACCOUNT_SPEC.md` and credentials are supplied only through the private submission mechanism.
9. Listing metadata, legal/support URLs, country availability, branding, and reviewer prompts are populated from the canonical release docs.
10. Do not claim OpenAI endorsement; describe directory availability factually after approval.

## Release notes template

> Gapwise provides a remote MCP integration that combines stateless UTM campus intelligence with explicitly delegated private timetable/planning context. Connected users can ask about schedules, availability, routes, and Gapwise gap assessments and may queue bounded personal-item or preference changes when those permissions are enabled. Academic course meetings remain source-backed and read-only. Private OAuth credentials are user-scoped, resource-bound, and protected by Gapwise's approval, RLS, ownership, encryption, and revocation boundaries.
