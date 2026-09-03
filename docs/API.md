# Gapwise AI API

## Browser delegation API

These HTTPS endpoints are called by the Gapwise web app, not directly by models.

- `PUT /api/delegation/snapshot` — publish/replace the minimized AI snapshot for the authenticated user.
- `GET /api/delegation/actions` — fetch decrypted queued AI actions for the authenticated user.
- `POST /api/delegation/actions/:id/complete` — mark an action applied or rejected by Gapwise.
- `DELETE /api/delegation` — revoke delegation and delete the user's AI snapshot/actions.
- `GET /api/delegation` — read delegation status/permissions without returning schedule content.

All browser endpoints require a Supabase bearer token and enforce the configured `GAPWISE_APP_ORIGIN` CORS policy. They never use ambient cookies.

## Remote MCP API

The provider-neutral Streamable HTTP MCP endpoint is `POST /api/mcp` (with protocol-compatible `GET` handling). The same endpoint exposes a stateless public UTM campus-intelligence surface and an OAuth-protected private student-context surface.

### Public campus tools

These tools do not require a Gapwise account and never read timetable, account, friend, location, or private-sync state:

- `list_utm_buildings` — list canonical UTM buildings with Gapwise routing/accessibility coverage and provenance.
- `get_utm_building` — resolve one canonical building by code, official name, or known alias; unknown/ambiguous names fail closed.
- `route_between_utm_buildings` — use Gapwise's deterministic campus routing engine for an explicit building pair while preserving routed/approximate/unavailable status, verification, accessibility state, confidence, and warnings.
- `plan_utm_gap_window` — run Gapwise's deterministic gap-assessment engine for an explicit free window and explicit route/gap preferences. This tool does not discover a user's free time.

### Private read tools

OAuth-authenticated clients receive only the user's explicitly delegated data and capabilities.

- `get_ai_delegation_status` — current delegation state, revision, and permissions; no timetable content.
- `get_my_day` — source-backed meetings, delegated personal items, and date-valid delegated gap plans for one calendar date.
- `get_my_week` — normalized term timetable plus delegated personal items/gap plans.
- `get_my_gap_plan` — exact precomputed Gapwise assessment for a named gap window.
- `get_my_ai_preferences` — only planning/routing preferences the user explicitly delegated.
- `get_my_decision_context` — compact term-level planning context: hard schedule load, Gapwise gap opportunities, route uncertainty, freshness/revision, and delegated preferences.
- `find_my_available_windows` — source-backed free windows for one date or one term weekday using academic meetings and delegated fixed personal items as hard constraints. Flexible items are reported as soft competing constraints. Without explicit day bounds, it intentionally returns only windows bounded by hard events rather than assuming wake/sleep or edge-of-day availability.
- `find_my_weekly_opportunities` — searches all seven weekdays in one call. For a window covered by a delegated deterministic Gapwise gap assessment, `usableActivityMinutes` is capped by Gapwise's primary activity budget rather than raw free time, and an unavailable transition route yields zero validated activity minutes. A window without a delegated gap assessment is explicitly marked `temporal_only`.
- `check_my_plan_feasibility` — validates a proposed personal block against hard conflicts and, when a delegated Gapwise gap contains it, the authoritative primary activity envelope and transition route state. Proposed arbitrary locations are not route-validated by this tool.

### Private write tools

- `create_personal_item`
- `update_personal_item`
- `delete_personal_item`
- `update_gap_preferences`

Writes remain permission-gated, typed, revision-checked, idempotent queued actions. Imported academic meetings are never writable.

Fixed personal-item creates and updates also receive service-layer semantic validation before they are queued. A client cannot bypass this by skipping the read-only feasibility tool: Gapwise rejects delegated hard timetable conflicts and known deterministic transition/activity-envelope violations. Conflict-free blocks outside a delegated Gapwise gap may still be accepted as temporal-only because their surrounding travel is not known to be unsafe; clients must not describe those as route-validated.

## Planning orchestration contract

For broad personalized planning requests, clients should start with `get_my_decision_context`. For a whole-term-week search such as “find 90 minutes for studying,” clients should use `find_my_weekly_opportunities`; for one date or weekday, use `find_my_available_windows`. Models should not subtract timetable intervals themselves.

Before proposing a concrete personal block, clients should call `check_my_plan_feasibility` on the exact interval. Fixed-item writes are independently revalidated server-side, so a conflict or transition rejection is authoritative even if the client believed the block was feasible.

When a personalized plan needs building-to-building routing or an explicit Gapwise gap calculation, clients can combine the permissioned schedule/availability tools with the stateless public campus tools. Public campus tools must never be represented as having discovered the user's private timetable or location.

Gapwise-owned deterministic facts remain authoritative: recurrence/exclusions, hard conflicts, raw versus usable gap time, gap activity budgets, setup/pack-up envelopes, route status/accuracy/confidence, buffers, and leave-by/arrival times. A model may reason about user goals and tradeoffs, but it must not upgrade missing or approximate Gapwise data into invented certainty.
