# MCP tool contract

The live Gapwise AI MCP service registers **17 tools** through one Streamable HTTP endpoint: four stateless public UTM campus-intelligence tools and 13 OAuth-protected permissioned student-context tools.

Tool handlers never accept arbitrary SQL, JavaScript, URLs, graph nodes, or generic execute instructions. Imported/source-backed academic meetings remain read-only.

## Assistant-readable structured output

Private schedule/planning tools preserve their existing rich source objects for compatibility, while also exposing additive, presentation-ready projections where useful. Downstream assistants should prefer these projections for short answers instead of re-parsing prose or recomputing Gapwise facts.

- `meetingFacts` flattens day/time/course/component/location plus `semanticType`, `componentLabel`, and `isHardCommitment`. Reserved assessment placeholders use component `RES` and `isHardCommitment: false`.
- `gapPlanGroups` deduplicates equivalent gap plans. Week/term results use `appliesTo` for weekdays; date-range results use `appliesToDates`. Groups include usable time, leave-by/arrival, confidence, one key warning, and surrounding course/component/location facts.
- `flags` / `dataQualityFlags` expose deterministic schedule-data anomalies as machine-readable evidence. Flags are warnings to verify data, not claims that the source is definitely wrong.
- `actionItems` exposes relevant user-fixable setup gaps. The first supported item is a missing one-way home commute time when leaving campus is enabled, because that prevents Gapwise from evaluating go-home recommendations.

MCP text `content` is intentionally compact. Exact recurrence, exclusions, rich recommendation reasons/timelines, full warnings, and canonical source records remain in `structuredContent`.

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
Returns exact source-backed schedule occurrences for one calendar date. `academicMeetings` and `reservedAssessmentWindows` are separated, `meetingFacts` exposes flat assistant-ready facts, and `gapPlanGroups` summarizes delegated deterministic gap plans. Missing meetings, locations, routes, or recommendations are not invented.

### `get_my_week`
Returns the normalized delegated timetable for one academic term. Existing `meetings` and `gapPlans` remain available; `academicMeetings`, `reservedAssessmentWindows`, `meetingFacts`, and deduplicated weekday `gapPlanGroups` provide the preferred assistant-facing view. RES placeholders are not included in hard academic load or planning boundaries.

### `search_my_schedule`
Searches delegated meetings by course code/name, section, building, or room. Each result explicitly includes `semanticType`, `componentLabel`, and `isHardCommitment`, so an assistant does not need to infer whether a result is an ordinary commitment or RES placeholder.

### `get_my_course_context`
Resolves one delegated course without guessing. It separates ordinary academic meetings from RES placeholders, exposes flat `meetingFacts`, and returns `flags` for deterministic anomalies such as duplicate records, multiple same-section/day windows, overlapping section meetings, unusually high weekly section minutes, or late meetings.

### `get_my_schedule_range`
Returns date-specific occurrences for 1–14 consecutive days while respecting recurrence ranges and exclusions. Each day includes `meetingFacts`, and repeated equivalent gap plans are returned once in top-level `gapPlanGroups` with `appliesToDates`.

### `get_my_gap_plan`
Returns the exact precomputed deterministic Gapwise assessment for one delegated gap when gap-plan sharing is enabled. Route status/confidence, timing, warnings, recommendations, reasons, tags, and timeline fields are preserved rather than recomputed by the model.

### `get_my_ai_preferences`
Returns only planning/routing preferences the user explicitly allowed Gapwise to share with AI.

### `get_my_decision_context`
Returns a compact term-level planning summary including hard schedule load, RES count, authoritative gap opportunities, deduplicated `gapPlanGroups`, `dataQualityFlags`, relevant setup `actionItems`, route uncertainty, freshness/revision, and permitted preferences.

### `find_my_available_windows`
Finds source-backed free windows for one date or one term weekday. Without explicit search bounds it only returns windows bounded by delegated hard events; it does not invent wake/sleep assumptions or edge-of-day availability. RES placeholders are intentionally excluded from hard boundaries.

### `find_my_weekly_opportunities`
Searches all seven weekdays for usable planning windows. When an interval is covered by a delegated deterministic Gapwise gap assessment, usable activity time is capped by the Gapwise activity budget and an unavailable transition route contributes zero validated activity minutes.

### `check_my_plan_feasibility`
Checks a proposed personal block against delegated hard conflicts and, when applicable, the authoritative activity envelope/transition state for a delegated Gapwise gap. Arbitrary proposed locations are echoed but are not route-validated by this tool.

## Private write tools

### `update_gap_preferences`
Queues a bounded partial update to delegated gap-planning preferences. Requires explicit preference-write delegation and the current `expectedRevision`.

Legacy Personal Item action schemas remain decodable for compatibility, but Personal Items are retired and their create/update/delete MCP tools are no longer part of current planning semantics.

## Compatibility

The assistant-facing fields above are additive. Existing rich/raw arrays remain present, so clients that consume `meetings`, `gapPlans`, and preference objects do not need to migrate immediately. Current delegated snapshot schema v1 remains readable; this change does not require a snapshot-schema migration.

For new clients, prefer the flat assistant-facing fields for presentation and keep the rich objects as evidence when exact recurrence, route, timeline, or recommendation details are needed.

## Authentication projection

Public tools intentionally carry no OAuth `securitySchemes`. Private tools advertise Gapwise OAuth metadata in `_meta`, and the compatibility projection mirrors that declaration to root-level `securitySchemes` for clients that require it. Tool execution still independently verifies the caller; metadata is not authorization.

## Mutation semantics

A successful MCP write means **queued for Gapwise**, not that the primary encrypted private payload was remotely rewritten. Every queued mutation is typed and revision-bound; optional idempotency keys make exact retries safe. Gapwise applies pending actions against canonical browser/private-cloud state and republishes a newer snapshot.

Models must read again before making dependent changes because a queued action is not equivalent to immediate canonical-state mutation.
