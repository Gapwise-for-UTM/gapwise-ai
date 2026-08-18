# Current integration limitations

- Until Gapwise exposes its deterministic public routing/gap services through a transport-neutral API, the private MCP service must not invent route truth. It can return schedule boundaries and explicit `routingStatus: unavailable` for route-dependent advice.
- MCP write actions are applied by Gapwise through the queued-action channel; they do not remotely rewrite the primary encrypted private payload.
- ChatGPT custom MCP write availability depends on the current ChatGPT plan/workspace rollout; this is a client limitation, not a reason to fork the server.
