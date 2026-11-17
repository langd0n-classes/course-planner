# Coverage Rules

- **Ordering by sequence, not just date**: Coverage ordering is determined by `module_sequence` first, then `session_sequence`, then `date` as tiebreaker. This handles cases where dates are null or sessions are on the same day.

- **Same-session multi-level allowed**: A skill can be both "introduced" and "practiced" in the same session (common for labs).
