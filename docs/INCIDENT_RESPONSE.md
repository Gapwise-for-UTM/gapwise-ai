# Connector incident response

For a suspected connector security or privacy incident:

1. Stop or revoke affected OAuth client access if necessary.
2. Preserve minimal operational evidence without copying private tool payloads or credentials into tickets.
3. Determine whether the issue affects authorization, RLS/ownership, encrypted delegated data, write safety, logging, or platform compatibility.
4. Patch and verify the affected boundary with negative-path tests.
5. Rotate affected server-side secrets if exposure is plausible.
6. Re-run real-client validation for materially affected OAuth/MCP behavior.
7. Notify affected users when required and update public status/support information as appropriate.
8. If a directory policy or platform integration is affected, follow the platform's current security/reporting requirements.

Never use public GitHub issues for credentials, tokens, private timetable data, or vulnerability proof-of-concept details.
