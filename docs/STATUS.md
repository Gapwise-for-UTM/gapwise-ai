# Status

The production service is configured around the canonical `https://ai.gapwise.ca` origin and the repository contains the current OAuth, delegation, encryption, queued-write, safety, and CI implementation.

The source repository is now **public**. Public visibility does not imply broad client availability: real external OAuth/read/write/revoke validation and exact-head release checks remain required before Gapwise AI is represented as generally supported in ChatGPT, Claude, or other MCP clients.

See [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) for the remaining integration and release gates.
