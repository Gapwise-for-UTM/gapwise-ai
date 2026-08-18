# MCP tool contract

All private tools require an authenticated, non-revoked AI delegation for the current Supabase user. Tool results are intentionally structured and bounded. Tool handlers never accept arbitrary SQL, JavaScript, URLs, graph nodes, or generic execute instructions.

## Read tools

### `get_my_day`
Returns source-backed academic meetings and delegated personal items for one date/weekday plus the current snapshot revision. Does not infer missing classes.

### `get_my_week`
Returns the compact normalized schedule for one term. Bounded to the existing Gapwise meeting caps.

### `get_my_gap_plan`
Returns the user's stored gap preference context and the two schedule boundaries around a requested gap. The MCP layer does not invent Gapwise routing truth; until the Gapwise public deterministic API is available, route-dependent fields are explicitly unavailable rather than guessed.

### `get_my_ai_preferences`
Returns only preferences the user explicitly delegated to AI.

## Write tools

### `create_personal_item`
Queues a new personal timetable item. Requires write delegation and `expectedRevision`.

### `update_personal_item`
Queues changes to an AI-visible personal item by stable ID. Requires write delegation and `expectedRevision`.

### `delete_personal_item`
Queues deletion of a personal item by stable ID. Requires write delegation and `expectedRevision`.

### `update_gap_preferences`
Queues a bounded partial update to delegated gap preferences. Requires write delegation and `expectedRevision`.

## Public tools

The future public Gapwise API remains the source for canonical UTM buildings/routing. Those tools can be added to this MCP server without changing private authentication or duplicating domain logic.

## Mutation semantics

A successful MCP write means **queued for Gapwise**, not that the primary encrypted private payload was remotely rewritten. Gapwise applies queued actions in the browser, preserving its existing cryptographic boundary. The tool result explicitly reports `queued` and its action ID.
