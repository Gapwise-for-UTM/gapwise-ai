# AI connector data-use disclosure

This document is the concise source for user-facing connector disclosures.

## Data the connector may receive when the user enables it

Depending on explicit Gapwise permissions: normalized academic meeting facts; selected personal timetable items; selected gap/routing preferences; deterministic Gapwise gap assessments; snapshot revision/freshness metadata; and queued personal-item/preference changes requested through the connected assistant.

## Data deliberately excluded

Raw ACORN calendar files, account passwords/social credentials, Supabase refresh tokens, Gapwise primary private-data encryption keys, friend identities/availability/overlap data, precise live or background location, and unrelated browser/private state.

## Processing model

Gapwise AI temporarily processes authorized plaintext to answer an MCP tool request and encrypts delegated snapshots/actions before database storage. It is not zero-knowledge with respect to the Gapwise AI runtime. The connected AI provider receives tool results needed for the user's request according to that provider's product/privacy terms.

## Model responsibility

Gapwise does not require a server-side OpenAI or Anthropic model call. The connected client supplies model reasoning; Gapwise supplies deterministic facts, permission checks, and bounded actions.

## Revocation

The user can revoke AI delegation/access from Gapwise. Revocation removes delegated connector state/actions and subsequent private MCP access fails closed until the user explicitly authorizes again.
