# Gapwise AI cost model

Gapwise AI is designed so that AI inference is supplied by the connected MCP client rather than purchased by the Gapwise backend. Compatible clients provide the model/reasoning layer; Gapwise AI provides OAuth, bounded data access, deterministic context, and safe mutation semantics.

## Runtime invariant

Gapwise AI MUST NOT require server-side LLM inference or an uncapped metered AI-provider dependency to operate.

```text
user
  -> ChatGPT / Claude / another MCP client
  -> client-provided model inference
  -> Gapwise AI remote MCP service
  -> authorized Gapwise / Supabase data
```

The connector runtime therefore must not depend on an OpenAI, Anthropic, Google, Azure OpenAI, or AI Gateway model API key owned by Gapwise.

`GAPWISE_OPENAI_APPS_CHALLENGE_TOKEN` is explicitly allowed because it is an application/domain verification challenge token, not a model-inference credential.

## Invariants

- Gapwise AI must not require an OpenAI, Anthropic, or other server-side LLM API key for normal connector operation.
- Tool execution should use deterministic Gapwise logic, first-party APIs, and the existing Gapwise/Supabase data plane.
- Do not add an uncapped pay-as-you-go dependency to a user-triggerable tool path without an explicit project decision and documented hard spend control.
- Prefer bounded inputs, bounded outputs, caching where safe, request deadlines, and fail-closed behavior over unbounded compute or external calls.
- Production should remain operable on free/hard-capped infrastructure tiers where practical. Quota exhaustion should degrade availability rather than silently create monetary liability.
- Do not automatically upgrade plans, disable spend caps, or add paid fallbacks to clear a temporary quota condition.

## CI enforcement

`scripts/check-cost-model.mjs` runs as part of `npm run check`. It rejects known server-side model SDKs and model-provider credential declarations in the repository's runtime configuration.

This is intentionally a narrow repository guard. It can prevent obvious source-controlled architecture drift, but it cannot prove account-level billing state. Vercel, Supabase, DNS/domain renewal, and other provider settings can be changed outside this repository.

## Review requirement

Any pull request that adds a paid API, AI model invocation, metered storage/compute provider, background job, scheduled poller, or unbounded third-party request path must document:

1. why the dependency is necessary;
2. the exact billing trigger;
3. the hard spend/usage ceiling;
4. the behavior when that ceiling is reached; and
5. why a deterministic or existing first-party alternative is insufficient.

Any proposal that adds a server-side model SDK or model credential, changes production from a free/hard-capped tier to a paid/overage-capable tier, weakens a provider spend cap, or introduces automatic paid fallback requires explicit owner approval before merge or rollout.

## What this does not promise

The connector-directory release does not require OpenAI or Anthropic API usage by Gapwise itself. This architecture supports a strong goal of keeping Gapwise AI at $0 incremental model-inference cost to operate, but it is not a mathematical guarantee that the entire Gapwise ecosystem can never incur any expense. Domain renewals and provider/account configuration live outside this repository, and future platform policy can change.

User-facing copy should therefore prefer accurate wording such as **"Free to use"** or **"No server-side model billing in the connector"** rather than claiming unlimited or permanently cost-free service.
