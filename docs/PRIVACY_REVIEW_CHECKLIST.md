# Connector privacy review checklist

Before public directory release confirm:

- [ ] public privacy policy explicitly covers AI connector processing;
- [ ] only explicitly delegated fields are exposed;
- [ ] no friend or precise live-location data is exposed;
- [ ] no raw ACORN calendar bytes are exposed;
- [ ] no credentials, refresh tokens, or encryption keys are exposed;
- [ ] application logs remain metadata-only;
- [ ] reviewer screenshots use synthetic data;
- [ ] revocation removes delegated state/actions;
- [ ] support documentation explains disconnect/revocation;
- [ ] directory disclosures match actual deployed behavior.
