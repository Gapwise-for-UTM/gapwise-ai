# MCP tool contract

The live Gapwise AI MCP service registers **17 tools** through one Streamable HTTP endpoint: four stateless public UTM campus-intelligence tools and 13 OAuth-protected permissioned student-context tools.

Tool handlers never accept arbitrary SQL, JavaScript, URLs, graph nodes, or generic execute instructions. Imported/source-backed academic meetings remain read-only.

## Public campus tools

These tools use public deterministic Gapwise campus data. They do not authenticate a Gapwise account and do not read a student's private timetable, friends, precise location, or private sync state.

### `list_utm_buildings`
Lists canonical UTM buildings with Gapwise routing/accessibility coverage and provenance.

### `get_utm_building`
Resolves one canonical UTM building by code, official name, or known alias. Unknown or ambiguous values fail closed.

### `route_between_utm_buildings`
Runs Gapwise's deterministic building-to-building routing engine and preserves route status, verification, time/distance, accessibility state, confidence, and warnings rather than upgrading uncertainty in model prose.

### `plan_utm_gap_window`
Runs Gapwise's deterministic gap-assessment engine for one explicit free window between two UTM buildings using explicitly supplied routing/gap preferences. It does not discover a user's free time or private schedule.

## Private read, status, and planning tools

These tools require a verified OAuth caller and the relevant non-revoked Gapwise AI delegation permission.

### `get_ai_delegation_status`
Returns delegation state, revision, and permissions without returning timetable content.

### `get_my_day`
Returns exact source-backed academic meetings, explicitly delegated personal items, and delegated deterministic Gapwise gap context for one calendar date. Missing meetings, locations, routes, or recommendations are not invented.

### `get_my_week`
Returns the normalized delegated timetable for one academic term together with permitted personal items/gap context.

### `get_my_gap_plan`
Returns the exact precomputed deterministic Gapwise assessment for one delegated gap when gap-plan sharing is enabled. Route status/confidence, timing, warnings, and recommendation fields are preserved rather than recomputed by the model.

### `get_my_ai_preferences`
Returns only planning/routing preferences the user explicitly allowed Gapwise to share with AI.

### `get_my_decision_context`
Returns a compact term-level planning summary including hard schedule load, delegated fixed personal constraints, authoritative Gapwise gap opportunities, route uncertainty, freshness/revision, and permitted preferences.

### `find_my_available_windows`
Finds source-backed free windows for one date or one term weekday. Without explicit search bounds it only returns windows bounded by delegated hard events; it does not invent wake/sleep assumptions or edge-of-day availability.

### `find_my_weekly_opportunities`
Searches all seven weekdays for usable planning windows. When an interval is covered by a delegated deterministic Gapwise gap assessment, usable activity time is capped by the Gapwise activity budget and an unavailable transition route contributes zero validated activity minutes.

### `check_my_plan_feasibility`
Checks a proposed personal block against delegated hard conflicts and, when applicable, the authoritative activity envelope/transition state for a delegated Gapwise gap. Arbitrary proposed locations are echoed but are not route-validated by this tool.

## Private write tools

### `create_personal_item`
Queues a new personal timetable item. Requires explicit personal-item write delegation and the current `expectedRevision`.

### `update_personal_item`
Queues a bounded update to an AI-visible personal item by stable ID. Requires explicit write delegation and the current `expectedRevision`.

### `delete_personal_item`
Queues deletion of an AI-visible personal item by stable ID. Requires explicit write delegation and the current `expectedRevision`.

### `update_gap_preferences`
Queues a bounded partial update to delegated gap-planning preferences. Requires explicit preference-write delegation and the current `expectedRevision`.

Fixed personal-item creates/updates are independently revalidated at the service layer against delegated hard conflicts and known deterministic Gapwise transition/activity-envelope constraints before they are queued.

## Authentication projection

Public tools intentionally carry no OAuth `securitySchemes`. Private tools advertise Gapwise OAuth metadata in `_meta`, and the compatibility projection mirrors that declaration to root-level `securitySchemes` for clients that require it. Tool execution still independently verifies the caller; metadata is not authorization.

## Mutation semantics

A successful MCP write means **queued for Gapwise**, not that the primary encrypted private payload was remotely rewritten. Every queued mutation is typed and revision-bound; optional idempotency keys make exact retries safe. Gapwise applies pending actions against canonical browser/private-cloud state and republishes a newer snapshot.

Models must read again before making dependent changes because a queued action is not equivalent to immediate canonical-state mutation.
