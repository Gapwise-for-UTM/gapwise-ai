# Browser delegation API

These HTTPS endpoints are called by the Gapwise web app, not directly by models.

- `PUT /api/delegation/snapshot` — publish/replace the minimized AI snapshot for the authenticated user.
- `GET /api/delegation/actions` — fetch decrypted queued AI actions for the authenticated user.
- `POST /api/delegation/actions/:id/complete` — mark an action applied or rejected by Gapwise.
- `DELETE /api/delegation` — revoke delegation and delete the user's AI snapshot/actions.
- `GET /api/delegation` — read delegation status/permissions without returning schedule content.

All browser endpoints require a Supabase bearer token and enforce the configured `GAPWISE_APP_ORIGIN` CORS policy. They never use ambient cookies.
