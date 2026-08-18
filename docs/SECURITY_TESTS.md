# Security regression requirements

Database/RLS and crypto behavior are release gates, not optional tests. A deployment is not production-ready if cross-user isolation, revocation, tamper detection, or stale-write rejection is untested or failing.
