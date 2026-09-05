# Security Policy

Gapwise AI handles explicitly delegated private timetable data and authenticated write requests. Security reports are taken seriously and should be disclosed privately.

## Reporting a vulnerability

**Do not open a public GitHub issue for a suspected security vulnerability.**

Prefer `security@gapwise.ca` or GitHub private vulnerability reporting for the organization-owned repository at `https://github.com/Gapwise-for-UTM/gapwise-ai/security/advisories/new`. Include only the minimum information needed to establish contact until a private channel is confirmed.

A useful report includes:

- the affected route, tool, or component;
- the expected security property;
- the observed behavior;
- reproduction steps using non-production/test data;
- impact and any known prerequisites.

Please do not access another user's data, perform destructive testing against production, publish credentials/tokens, or disclose a vulnerability publicly before a fix can be evaluated.

## Supported code

Security fixes target the current `main` branch and the production deployment derived from it. Older commits, forks, and independently deployed instances are not supported by the Gapwise project.

## Non-negotiable security boundaries

- Never store or log model prompts, private tool arguments/results, access tokens, refresh tokens, OAuth codes, encryption keys, or decrypted timetable/action payloads.
- Never request or possess Gapwise's primary encrypted-private-data DEK/KEK.
- Raw ACORN `.ics`, friend/friend-overlap data, precise live/background location, and unrelated browser data are outside the private MCP tool surface.
- ACORN/source-backed academic meetings are read-only to AI integrations; no academic mutation tool may be exposed.
- AI write tools are limited to explicitly delegated personal timetable items and permitted preferences.
- Private reads and writes require a valid user-scoped Supabase access token.
- MCP access additionally requires an OAuth client identity; OAuth-client tokens may not use browser-authoritative mutation endpoints.
- Database rows remain caller-scoped with RLS; private AI payloads are encrypted before database storage with a separate server-only data key.
- The application independently rejects any AI delegation, pending-action, or approved-client row whose `user_id` does not exactly match the cryptographically verified caller, so an upstream/RLS regression fails closed instead of silently becoming a cross-account read.
- Delegation/action inserts are likewise rejected if application code attempts to write a different owner ID than the authenticated caller.
- Writes remain typed, revision-bound, and idempotency-bounded; stale writes fail closed.
- Revocation must remove delegated state/actions and make subsequent private reads/writes fail closed.

These application ownership checks are defense in depth. They do not replace Supabase RLS, OAuth client approval, MCP audience binding, token validation, or encryption user binding; all of those controls are expected to agree on the same caller.

## Secrets

Production secrets belong in the deployment platform's server-only environment variables. Do not commit them to GitHub, expose them through `NEXT_PUBLIC_*` variables, include them in MCP/tool responses, or print them in logs.

The Supabase publishable key is designed for client-side use and is not treated as a privileged database credential. Service-role keys, database passwords, private signing material, AI data-encryption keys, OAuth client secrets, and user tokens must never be committed.

## Public-source posture

Gapwise AI is designed so that publishing the source code does not weaken its security model. Authentication, authorization, RLS, cryptographic key separation, application ownership assertions, and fail-closed validation are the security controls; repository secrecy is not.

The source repository is public, but broad named-client compatibility remains separately evidence-gated. ChatGPT, Claude, or another client should not be described as fully verified until the release checklist's real-client OAuth/read/write/revocation and negative-path matrices have passed on the final release state.
