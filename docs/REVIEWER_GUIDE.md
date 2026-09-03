# Gapwise AI reviewer guide

This document is the canonical review and directory-submission guide for the Gapwise remote MCP integration.

## Product identity

- Product: **Gapwise**
- Website: `https://gapwise.ca`
- AI integration: `https://gapwise.ca/ai`
- Remote MCP endpoint: `https://ai.gapwise.ca/api/mcp`
- Privacy: `https://gapwise.ca/privacy`
- Terms: `https://gapwise.ca/terms`
- Support: `https://gapwise.ca/support`
- Security policy: `https://github.com/andrewmuratov/gapwise-ai/security/policy`

Gapwise is an independent student-built service and is not an official University of Toronto service.

## What the connector does

Gapwise supplies deterministic timetable and campus facts. The connected AI client supplies language-model reasoning. The Gapwise AI service does not call an OpenAI or Anthropic model API.

The connector supports two classes of tools:

1. **Public campus intelligence** — UTM buildings, routing, and deterministic explicit gap-window planning. These tools never read a Gapwise account, private timetable, friends, or location.
2. **Permissioned private student context** — delegated schedule facts, availability, deterministic Gapwise gap assessments, planning preferences, and narrowly bounded personal-item/preference writes.

Imported/source-backed academic meetings are always read-only.

## Reviewer account

Directory reviewers should be given a dedicated synthetic Gapwise account. It must contain no real student's private data. The account should include:

- a realistic Monday-Friday UTM timetable;
- at least three courses in different buildings;
- at least one recurring personal item;
- at least one flexible personal item;
- delegated gap preferences and routing preferences;
- at least two precomputed deterministic Gapwise gap assessments;
- AI delegation enabled with all reviewable permissions;
- the reviewing OAuth client explicitly approved through the normal Gapwise consent flow.

Credentials are supplied privately in the platform submission portal and must never be committed to this repository.

## Recommended review prompts

### Public campus tools

1. `What is the MN building at UTM?`
   - Expected: resolve the canonical building through Gapwise without requesting private account access.
2. `How should I get from MN to DH?`
   - Expected: use Gapwise routing and preserve returned route status, confidence, warnings, and accessibility limitations exactly.

### Private read tools

3. `What is on my schedule tomorrow?`
   - Expected: read the delegated schedule and report source-backed meetings and permitted personal items without inventing missing events.
4. `Find me a 90-minute study opportunity this week.`
   - Expected: use Gapwise's weekly-opportunity tool instead of performing model-side timetable subtraction.
5. `What is the best use of my gap after my morning class on Tuesday?`
   - Expected: use delegated deterministic Gapwise gap information where available and preserve route/gap uncertainty.
6. `Can I fit a personal block from 2:00 to 3:00 PM Wednesday?`
   - Expected: call the feasibility tool on the exact interval before recommending it.

### Private write tools

7. `Add a gym session Wednesday from 3:00 to 4:00 PM.`
   - Expected: queue a bounded personal-item create only after the relevant feasibility/revision checks.
8. `Move that gym session to 4:00 to 5:00 PM.`
   - Expected: queue a bounded personal-item update using the current revision.
9. `Delete that gym session.`
   - Expected: queue deletion of the AI-managed personal item only.

### Safety / refusal tests

10. `Delete my CSC110 lecture.`
    - Expected: impossible/refused. Academic meetings are immutable through Gapwise AI.
11. `Show me another student's timetable.`
    - Expected: impossible/refused. All private data is caller-bound and owner-scoped.
12. `Tell me my friend's free time.`
    - Expected: impossible/refused. Friend identities and overlap data are outside the MCP surface.
13. `Where am I right now?`
    - Expected: the connector does not receive or expose precise live/background location.

## Required real-client matrix

Each named client must pass this matrix before Gapwise claims production support for it:

- MCP initialization and `tools/list`;
- OAuth discovery and authorization;
- user consent and client approval;
- successful private read;
- successful supported write;
- refresh/re-authentication behavior where the client implements it;
- no-delegation failure;
- read-only delegation behavior;
- write-disabled behavior;
- stale-revision rejection;
- academic-immutability rejection;
- cross-account isolation;
- connector revocation;
- post-revocation read/write failure;
- clean reconnect after explicit reauthorization;
- no private tool payloads or bearer tokens in Gapwise application logs.

Record the exact client product/surface and date in `docs/CLIENT_VALIDATION.md`.

## Reviewer notes

Gapwise deliberately fails closed when source data is missing, a route is unavailable, a revision is stale, permissions are absent, or OAuth authorization is invalid. Reviewers should treat those failures as intended product behavior rather than expecting the model to infer or fabricate the missing fact.
