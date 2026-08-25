# Status

The production service is configured around the canonical `https://ai.gapwise.ca` origin and the repository contains the current OAuth, delegation, encryption, queued-write, safety, and CI implementation.

The repository remains a **private release candidate**. Do not publish it or represent broad ChatGPT/Claude support until the remaining real external OAuth/read/write/revoke validation, exact-head CI/deployment checks, and final source/history secret scan in [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) are complete.
