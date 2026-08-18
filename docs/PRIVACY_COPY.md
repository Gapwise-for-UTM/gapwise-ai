# Consent copy source

Use this language in Gapwise's AI integration UI:

**Connect AI to Gapwise**

Gapwise can share a minimized copy of your timetable with an AI connector you authorize. Your original ACORN file, friends, precise location, account credentials, and Gapwise encryption keys are never included.

The authorized AI provider can see the timetable facts returned by tools while you use it. Gapwise AI encrypts the delegated copy before storing it in Supabase, but the authorized Gapwise AI runtime must decrypt it transiently to answer your tool request. This is not zero-knowledge or end-to-end encryption.

Academic classes are always read-only. If you separately allow edits, AI can queue changes only to personal timetable items and gap preferences. You can revoke access at any time; revocation deletes the delegated snapshot and queued AI changes.
