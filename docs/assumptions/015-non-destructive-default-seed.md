# Issue #15 — non-destructive default seed

- The default demo reserves deterministic UUIDs for its direct rows. Natural-key collisions fail instead of adopting user rows. Existing demo rows keep instructor edits; version pointers are set only when absent.
- The exemplar importer runs when its demo course is first created (or has no imported modules). Its stable course-scoped codes and version revisions identify the imported rows. Later default seed runs leave that course untouched.
- `--force` is the only path that clears every application table; migration history remains. Operator decision 2026-10-04, relayed by AICP.
