# User support playbook

Common connector support cases and intended responses:

## Connector will not link

Verify the user is signed in to Gapwise, AI delegation is enabled, the client reaches the canonical MCP URL, and the user completes the Gapwise consent flow. Do not ask for bearer tokens or OAuth codes.

## Schedule data is missing

Confirm the timetable is present and current in Gapwise and that the corresponding AI read permission is delegated. Gapwise AI intentionally does not guess missing source data.

## A personal-item write fails

Refresh the current Gapwise AI context/revision and retry only if the requested block still passes permission and conflict/transition checks. Stale or unsafe writes are intended to fail closed.

## Academic class cannot be edited

This is intentional. Imported/source-backed academic meetings are immutable through AI integrations.

## Disconnect/revoke

Use the Gapwise AI access controls to revoke connector approval/delegation. After revocation, private MCP reads/writes must fail until explicit reauthorization.

## Security concern

Do not request sensitive reproduction data in a public issue. Direct the reporter to the private vulnerability-reporting route in `SECURITY.md` / the public support page.
