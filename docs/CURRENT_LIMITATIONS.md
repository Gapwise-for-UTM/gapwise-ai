# Current integration limitations

- Gapwise now has deterministic public campus APIs, and this repository contains a public-campus MCP registration module, but the current live `app/api/mcp/route.ts` handler does not register those four public tools. The live MCP surface therefore remains the 13 permissioned private tools; clients must not assume the unregistered public definitions are available.
- MCP write actions are applied by Gapwise through the queued-action channel; they do not remotely rewrite the primary encrypted private payload.
- Broad ChatGPT/Claude support is still a release-validation target rather than a universal support claim. Real OAuth/read/write/revoke behavior depends on the current client/product capabilities and must pass the repository's compatibility matrix before a client is represented as supported.
