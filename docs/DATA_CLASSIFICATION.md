# Data classification

| Data | Classification | MCP access |
|---|---|---|
| Canonical UTM building/routing data | Public | Yes, through deterministic Gapwise API when available |
| Normalized academic meeting facts | Private delegated | Read only |
| AI-managed personal timetable items | Private delegated | Read/write when enabled |
| Gap preferences | Private delegated | Read/write when enabled |
| Routing preferences | Private delegated | Read when enabled |
| Raw ACORN `.ics` | Highly private / local source | Never |
| Main Gapwise private-data ciphertext | Private encrypted | Never exposed to MCP service as payload |
| Main Gapwise DEK / Vercel KEK | Secret cryptographic | Never |
| Friend data/overlap | Private separate domain | Never |
| Precise live location | Sensitive transient | Never in v1 |
| OAuth access token | Credential | Transport/auth only; never tool data/logging |
| AI snapshot/action ciphertext | Private encrypted | Stored under RLS; decrypted only in authorized runtime |
