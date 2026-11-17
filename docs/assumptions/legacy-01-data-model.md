# Data Model

- **Instructor entity added**: The requirements didn't specify an Instructor table but multi-tenancy was requested. Added `Instructor` with `name` and `email`, linked to `Term` via `instructor_id`.

- **Skills are global by default**: Skills with `is_global=true` are shared across all terms. Term-specific skills use `is_global=false` with a `term_id`. Clone copies references to global skills (not duplicates).

- **Assessment-Skill is a join table**: Rather than using a `UUID[]` column for `skills_assessed` on Assessment (as in the requirements doc), we use a proper `AssessmentSkill` join table for referential integrity.

- **Coverage unique constraint**: `(session_id, skill_id, level)` is unique — a skill can't have the same coverage level twice in the same session, but CAN have different levels (e.g., both introduced and practiced in one session).

- **Artifact parent resolution**: Artifacts use `parent_type` enum + nullable FKs (`session_id`, `assessment_id`, `module_id`) rather than a single polymorphic `parent_id`, for type safety.
