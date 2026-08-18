# Private release checklist

- [ ] CI passes on exact deployment commit.
- [ ] Supabase migration applied and security advisors reviewed.
- [ ] OAuth 2.1 Server enabled with explicit consent UI.
- [ ] Production Vercel env vars configured; no secret uses a public prefix.
- [ ] Protected resource metadata resolves to the correct Supabase issuer.
- [ ] Unauthenticated MCP requests receive an OAuth challenge.
- [ ] Revoked delegation blocks reads and writes immediately.
- [ ] Cross-user RLS tests prove isolation.
- [ ] Snapshot/action ciphertext is unreadable from database-only access.
- [ ] Stale revision writes fail closed.
- [ ] Academic meetings cannot be mutated by any tool.
- [ ] Logs contain no prompts, arguments, results, tokens, or decrypted content.
- [ ] Claude connector exercises every enabled tool.
- [ ] ChatGPT connector exercises every enabled tool permitted by the current plan/workspace.
- [ ] Account deletion removes AI delegation rows.
- [ ] Repository remains private until the above checks pass.
