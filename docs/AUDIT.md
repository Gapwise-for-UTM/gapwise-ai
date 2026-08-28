# Audit posture

Gapwise AI emits a deliberately small server-side audit event for every registered private MCP tool invocation. The event is written to the hosting platform's structured runtime logs and contains only:

- event type (`gapwise.mcp.tool`);
- tool name;
- a stable pseudonymous caller reference derived from the authenticated user ID;
- OAuth client ID when available from verified auth context;
- a coarse outcome: `success`, `delegation_error`, `internal_error`, or `auth_required`.

The logging platform supplies the event timestamp. Gapwise AI does **not** add tool arguments, requested dates/times, course/section/location facts, personal-item fields, timetable or delegated-snapshot content, tool responses, prompts/conversation content, access or refresh tokens, auth URLs, encryption material, raw request bodies, IP addresses, or headers to these audit events.

The audit sink is non-blocking: an observability failure is swallowed and cannot become a dependency of a user tool call. Regression tests enforce the allowlisted event shape and representative success/auth/error paths.

This gives operators a privacy-preserving `who / when / which tool / coarse outcome` trail. It does **not** imply a fixed retention period, immutable/WORM storage, third-party audit certification, or guaranteed availability of provider logs. Those are hosting/operations properties and must be verified separately for any release claim.

User-visible delegation status remains separate and includes delegation creation/update/revocation times and permissions, not model conversation content.
