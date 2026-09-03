# Platform submission notes

These notes intentionally avoid pinning the integration to undocumented submission-field names. Platform submission UIs and labels change. Use the current official portal, then map its fields to the canonical values in `DIRECTORY_METADATA.md` and the reviewer procedure in `REVIEWER_GUIDE.md`.

## OpenAI

Use the current ChatGPT app/plugin submission flow associated with the Apps SDK/MCP developer surface. Connect the production endpoint `https://ai.gapwise.ca/api/mcp`, complete any requested developer/domain verification, provide the first-party legal/support URLs, and supply the private reviewer account only through the submission portal.

Do not add an OpenAI API key to Gapwise AI merely for directory submission. The connected ChatGPT client is the reasoning layer.

## Anthropic

Use the current Claude remote Connector/software directory submission flow. Supply the production MCP endpoint, domain ownership evidence when requested, public privacy/support/security information, synthetic reviewer account credentials, and at least three verified prompts.

Do not add an Anthropic API key to Gapwise AI merely for connector submission. The connected Claude client is the reasoning layer.
