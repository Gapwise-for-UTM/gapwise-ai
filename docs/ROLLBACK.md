# Rollback

The initial database change is additive. Runtime rollback uses Vercel deployment rollback; schema rollback is optional because dormant AI tables are harmless when no runtime uses them. If the AI storage key is compromised, disable the runtime first, rotate credentials, and invalidate existing AI ciphertext rather than attempting unsafe in-place recovery.
