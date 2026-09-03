# Anthropic Connector Directory submission checklist

This document is the Anthropic-specific release gate for Gapwise. Use `DIRECTORY_METADATA.md`, `REVIEWER_GUIDE.md`, `TEST_ACCOUNT_SPEC.md`, and `SUBMISSION_CHECKLIST.md` as the canonical shared listing/reviewer package.

## Production identity

- Product: **Gapwise**
- Website: `https://gapwise.ca`
- AI page: `https://gapwise.ca/ai`
- Remote MCP server: `https://ai.gapwise.ca/api/mcp`
- Privacy: `https://gapwise.ca/privacy`
- Terms: `https://gapwise.ca/terms`
- Support: `https://gapwise.ca/support`
- Security: `https://gapwise.ca/security`
- Developer docs: `https://docs.gapwise.ca/ai/`

Gapwise must be described as an independent integration, not as endorsed by Anthropic or the University of Toronto.

## Directory-policy mapping

Before submission confirm:

- user/private data is minimized to the connector's function;
- tool descriptions are narrow, unambiguous, human-readable, and match actual behavior;
- the connector does not pull hidden behavioral instructions from external sources;
- privacy, support, troubleshooting, and security-reporting surfaces are public;
- a standard synthetic testing account with realistic sample data is available privately to Anthropic;
- at least three working prompts are supplied (the canonical reviewer guide contains substantially more);
- Gapwise can prove control of every first-party domain/API/UI the connector uses;
- the connector is actively maintained;
- the current Software Directory Terms/design requirements are accepted at submission time.

## MCP-specific requirements

Gapwise should demonstrate that:

- errors fail closed and return useful feedback;
- tool calls are token-frugal and bounded;
- every tool name is well below the 64-character limit;
- private remote-service access uses secure OAuth over first-party HTTPS with a publicly trusted certificate;
- the `tools/list` surface exposes a `title` plus explicit applicable annotations, including `readOnlyHint` and `destructiveHint`;
- the transport is Streamable HTTP;
- public campus tools have no private OAuth declaration and cannot access private student state;
- private tools carry the Gapwise OAuth declaration and independently verify the caller.

## Real Claude validation

Against the exact release SHA, complete:

1. add `https://ai.gapwise.ca/api/mcp` as a custom remote connector;
2. verify all 17 tools are discovered with the correct public/private authorization metadata;
3. exercise public building/routing tools before private authorization;
4. connect the synthetic reviewer Gapwise account through the normal OAuth/consent flow;
5. exercise private day/week/decision/availability/gap/feasibility reads;
6. exercise supported personal-item create/update/delete and preference update flows;
7. verify write approval UX and tool annotations are sensible;
8. verify no-delegation, read-only, write-disabled, stale-revision, academic-immutability, and cross-account failures;
9. revoke access and confirm subsequent private tool calls fail;
10. reconnect and confirm a fresh authorization succeeds;
11. review Gapwise production logs for absence of prompts, private tool payloads, bearer tokens, and decrypted schedule/action content.

Record exact product surface/date/result in `CLIENT_VALIDATION.md`.

## Reviewer materials

Supply privately:

- the synthetic reviewer-account credentials;
- the canonical MCP URL;
- the prompts in `REVIEWER_GUIDE.md`;
- a short note explaining that public tools are stateless campus intelligence while private tools require explicit Gapwise delegation;
- instructions for revoking/reconnecting;
- public privacy/support/security URLs.

## Submission posture

Do not add an Anthropic API key to Gapwise AI for directory submission. Claude is the reasoning layer; Gapwise is the remote MCP data/action layer.

After approval, update `gapwise.ca/ai`, the README, and compatibility docs with the official directory link and exact validated Claude surface/date. Directory inclusion should be stated factually and not described as Anthropic endorsement.
