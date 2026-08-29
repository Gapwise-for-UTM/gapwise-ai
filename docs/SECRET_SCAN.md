# Repository secret scan

Gapwise AI CI scans every commit reachable from the candidate head for a small set of high-confidence credential signatures before dependency installation, tests, or build.

The scanner deliberately excludes its own source file so its signature definitions cannot trigger a false positive. It checks reachable committed text for private-key blocks, common live provider-token prefixes, Google API keys, credential-bearing PostgreSQL URLs, and populated Supabase privileged JWT environment assignments.

This is a release guard, not a claim that automated pattern matching can detect every possible secret. Maintainers must still keep runtime credentials in provider secret stores, review unusual generated files before commit, and rerun the scan on the exact final release head.
