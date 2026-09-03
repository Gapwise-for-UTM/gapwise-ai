# Gapwise AI cost model

Gapwise AI is designed so that AI inference is supplied by the connected MCP client rather than purchased by the Gapwise backend.

## Invariants

- Gapwise AI must not require an OpenAI, Anthropic, or other server-side LLM API key for normal connector operation.
- Tool execution should use deterministic Gapwise logic, first-party APIs, and the existing Gapwise/Supabase data plane.
- Do not add an uncapped pay-as-you-go dependency to a user-triggerable tool path without an explicit project decision and documented hard spend control.
- Prefer bounded inputs, bounded outputs, caching where safe, request deadlines, and fail-closed behavior over unbounded compute or external calls.
- Production should remain operable on free/hard-capped infrastructure tiers where practical. Quota exhaustion should degrade availability rather than silently create monetary liability.

## Review requirement

Any pull request that adds a paid API, AI model invocation, metered storage/compute provider, background job, scheduled poller, or unbounded third-party request path must document:

1. why the dependency is necessary;
2. the exact billing trigger;
3. the hard spend/usage ceiling;
4. the behavior when that ceiling is reached; and
5. why a deterministic or existing first-party alternative is insufficient.

The connector-directory release does not require OpenAI or Anthropic API usage by Gapwise itself.
