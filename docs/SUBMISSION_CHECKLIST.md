# ChatGPT + Claude directory submission checklist

This checklist is intentionally operational. It contains only steps needed to move Gapwise AI from a production MCP service to a publicly discoverable integration.

## Shared release candidate

- [ ] `main` contains the final MCP tool surface and metadata.
- [ ] `https://ai.gapwise.ca/api/health` returns 200.
- [ ] `https://ai.gapwise.ca/.well-known/oauth-protected-resource` is correct and canonical.
- [ ] Unauthenticated MCP discovery succeeds where permitted and protected execution challenges for OAuth.
- [ ] `https://gapwise.ca/ai`, `/privacy`, `/terms`, and `/support` are public and internally consistent.
- [ ] Public logo/brand assets used in submissions are first-party Gapwise assets.
- [ ] A synthetic reviewer account is prepared and credentials are stored only in the submission portal/password manager.
- [ ] `docs/REVIEWER_GUIDE.md` prompts work against the release candidate.
- [ ] `docs/CLIENT_VALIDATION.md` is complete for every platform being claimed as supported.
- [ ] Exact-head CI, typecheck, tests, dependency audit, secret/history scan, production build, and deployment verification pass.
- [ ] Supabase security/performance advisors are reviewed after final schema/policy changes.
- [ ] Production logs are checked for absence of prompts, tool arguments/results, bearer tokens, or decrypted private content.

## OpenAI / ChatGPT

- [ ] Developer/account identity requirements are satisfied.
- [ ] Gapwise developer identity and first-party domain ownership are verified when requested.
- [ ] The app/plugin is connected to `https://ai.gapwise.ca/api/mcp`.
- [ ] OAuth linking is tested from the current ChatGPT app/developer surface.
- [ ] Every tool actually exposed to ChatGPT passes its supported read/write/negative-path tests.
- [ ] Submission metadata uses `Gapwise` consistently for name/developer identity.
- [ ] Website: `https://gapwise.ca`.
- [ ] Privacy: `https://gapwise.ca/privacy`.
- [ ] Terms: `https://gapwise.ca/terms`.
- [ ] Support: `https://gapwise.ca/support`.
- [ ] Reviewer instructions point to `docs/REVIEWER_GUIDE.md` content and include the private synthetic-account credentials.
- [ ] Country availability is selected intentionally.
- [ ] Listing copy does not claim University of Toronto affiliation or endorsement.
- [ ] Submit for public directory review.

## Anthropic / Claude

- [ ] Anthropic account eligibility/identity requirements are satisfied.
- [ ] The remote connector is added using `https://ai.gapwise.ca/api/mcp` and completes OAuth.
- [ ] Domain/API/UI ownership can be demonstrated for all first-party resources referenced by the connector.
- [ ] Support and security channels are public and reachable.
- [ ] A standard synthetic testing account with realistic sample data is supplied privately.
- [ ] At least three working example prompts are supplied; prefer the complete `REVIEWER_GUIDE.md` set.
- [ ] Tool titles/descriptions and MCP annotations accurately match behavior, including read-only/destructive/open-world semantics.
- [ ] The real Claude read/write/revoke and negative-path matrix is complete.
- [ ] Listing copy describes Gapwise as an independent integration and does not imply Anthropic or University endorsement.
- [ ] Submit to the current Anthropic connector/software directory review flow.

## After approval

- [ ] Add official directory links/buttons to `https://gapwise.ca/ai`.
- [ ] Update `docs/COMPATIBILITY.md` with the exact tested client surfaces and dates.
- [ ] Update README wording from release target to supported only for validated surfaces.
- [ ] Monitor security/support reports and platform policy changes.
- [ ] Re-run the client matrix after material OAuth/MCP/tool-schema changes.
