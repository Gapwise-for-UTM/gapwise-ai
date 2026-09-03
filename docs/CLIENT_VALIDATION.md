# Real-client validation record

Gapwise names a client as production-supported only after the exact product surface passes the matrix below against the release candidate.

## Status

| Client | Surface | OAuth | Reads | Writes | Negative paths | Revoke / re-auth | Status |
|---|---|---:|---:|---:|---:|---:|---|
| ChatGPT | Current public/custom app surface | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Pending real-client validation |
| Claude | Current remote connector surface | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Pending real-client validation |

Do not change a row to supported from unit tests or protocol simulation alone. Real-client evidence is required.

## Validation matrix

For each client, record date, tester, product/plan/workspace, connector identifier, release commit SHA, and results for:

- initialization and `tools/list`;
- OAuth protected-resource discovery;
- authorization and Gapwise consent;
- successful delegated day/week read;
- preferences/decision-context read;
- single-day availability search;
- weekly opportunity search;
- feasibility check;
- supported create/update/delete personal-item flow;
- supported preference update;
- no-delegation behavior;
- read-only permissions;
- write-disabled permissions;
- stale-revision rejection;
- academic-meeting mutation rejection;
- cross-account refusal/isolation;
- revocation and post-revocation failure;
- clean reconnect/re-authorization;
- production log review for absence of private payloads/tokens.

## ChatGPT evidence

Pending.

## Claude evidence

Pending.
