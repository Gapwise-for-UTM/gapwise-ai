# App review notes

Reviewers should understand these intentional behaviors:

- Gapwise is not the language model. The connected client supplies model reasoning.
- Missing/ambiguous campus or timetable facts are not guessed.
- Public campus tools are stateless and never require private student context.
- Private tools require explicit delegation and a verified user-scoped OAuth client.
- Academic meetings cannot be changed by an AI client.
- Personal-item/preference writes are queued, typed, permission-gated, and revision-bound.
- Route accessibility/availability uncertainty must be preserved, not upgraded by the model.
- Revocation is expected to make subsequent private tool calls fail.

A failure caused by absent permission, stale revision, unavailable route, or revoked access is therefore a successful enforcement case, not necessarily a connector defect.
