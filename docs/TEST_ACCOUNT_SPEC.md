# Synthetic reviewer account specification

Create one dedicated synthetic Gapwise account for OpenAI/Anthropic directory review. The account must not contain real student data.

## Recommended fixture

- Three academic courses across at least three UTM buildings.
- Meetings on at least four weekdays.
- One day with back-to-back classes.
- One day with a long gap covered by a deterministic Gapwise gap assessment.
- One day with a short gap that should not support a long activity.
- One recurring fixed personal item.
- One flexible personal item.
- Routing preference: prefer indoor.
- Gap preference values that exercise meal/buffer/setup logic.
- AI delegation enabled for all read permissions.
- AI write permission enabled for personal items and selected gap preferences.

## Determinism

Before each platform review submission, reset the synthetic account to the same fixture so reviewer prompts produce predictable results. Do not use a personal account because reviewer writes and deletes are expected.

## Secrets

Reviewer credentials are never source-controlled. Supply them only through the platform's private reviewer-credential mechanism or another private channel explicitly requested by the platform.
