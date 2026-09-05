# Campus data ownership

Canonical public UTM campus facts and geometry live in `andrewmuratov/gapwise-data` under `data/utm`.

`gapwise` consumes a validated build-time snapshot of that dataset and remains responsible for deterministic routing, gap planning, public API behavior, and SDK contracts. `gapwise-ai` should continue exposing those deterministic Gapwise semantics through MCP rather than becoming a second campus-data or routing engine.

## Rules for this repository

- Public campus MCP tools consume deterministic Gapwise campus/API semantics; they do not maintain an independent UTM dataset.
- Private delegated tools and OAuth/permission boundaries are unchanged by campus-data ownership.
- Do not copy building, entrance, footprint, or routing-graph facts into this repository as a parallel source of truth.
- Do not make MCP availability depend on a runtime fetch from `data.gapwise.ca` or GitHub.
- Campus fact/evidence changes start in `gapwise-data`; calculation/API changes start in `gapwise`; MCP schema/permission changes start here.

The machine-readable ecosystem contract in `gapwise.ecosystem.json` records the same ownership boundary.
