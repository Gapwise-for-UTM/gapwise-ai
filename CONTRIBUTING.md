# Contributing to Gapwise AI

Thanks for helping improve Gapwise AI.

This repository sits on a sensitive authorization and privacy boundary. Contributions are welcome, but changes that affect authentication, authorization, delegated schemas, encryption, logging, or AI write behavior are held to a higher standard than ordinary application changes.

## Before you start

Please read:

- [`README.md`](README.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/PRIVACY.md`](docs/PRIVACY.md)
- [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md)
- [`docs/TOOL_CONTRACT.md`](docs/TOOL_CONTRACT.md)
- [`SECURITY.md`](SECURITY.md)

If a proposed change conflicts with those trust boundaries, open a design discussion before implementing it.

## Development setup

Requirements:

- Node.js 24
- npm

```bash
git clone https://github.com/andrewmuratov/gapwise-ai.git
cd gapwise-ai
npm ci
cp .env.example .env.local
npm run check
```

Use development-only credentials in local environment files. Never commit production secrets, tokens, encryption keys, OAuth codes, or private timetable data.

## Pull requests

Keep pull requests focused and explain:

1. what behavior changes;
2. why the change is needed;
3. which trust/security boundaries are affected;
4. how the change was tested.

Before requesting review, run:

```bash
npm run check
npm audit --omit=dev --audit-level=high
```

CI must pass on the exact pull-request head.

## Security-sensitive changes

Changes in any of these areas require regression tests:

- OAuth or bearer-token handling;
- RLS assumptions or database access behavior;
- delegated snapshot schemas;
- encryption/decryption or key parsing;
- personal-item or preference write actions;
- revision/idempotency semantics;
- browser-vs-MCP authorization separation;
- request-size, CORS, or origin validation;
- logging of authenticated/private requests.

Do not weaken a fail-closed behavior merely to make a client integration easier. Provider compatibility belongs at the protocol/configuration layer, not in duplicated provider-specific business logic.

## Data minimization rules

Unless an explicit, reviewed permission model is added, contributions must not expose:

- raw ACORN `.ics` data;
- Gapwise private-data DEKs/KEKs;
- Supabase refresh tokens or provider OAuth credentials;
- friend/friend-overlap data;
- precise live/background location;
- unrelated notes or browser storage;
- academic-meeting mutation capabilities.

## Reporting security issues

Do not open public issues for suspected vulnerabilities. Follow [`SECURITY.md`](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the repository's [MIT License](LICENSE).
