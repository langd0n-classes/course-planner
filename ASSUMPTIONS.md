# Assumptions

Decisions made where the requirements were underspecified. Each can be revisited.

## Data Model

- **Instructor entity added**: The requirements didn't specify an Instructor table but multi-tenancy was requested. Added `Instructor` with `name` and `email`, linked to `Term` via `instructor_id`.

- **Skills are global by default**: Skills with `is_global=true` are shared across all terms. Term-specific skills use `is_global=false` with a `term_id`. Clone copies references to global skills (not duplicates).

- **Assessment-Skill is a join table**: Rather than using a `UUID[]` column for `skills_assessed` on Assessment (as in the requirements doc), we use a proper `AssessmentSkill` join table for referential integrity.

- **Coverage unique constraint**: `(session_id, skill_id, level)` is unique — a skill can't have the same coverage level twice in the same session, but CAN have different levels (e.g., both introduced and practiced in one session).

- **Artifact parent resolution**: Artifacts use `parent_type` enum + nullable FKs (`session_id`, `assessment_id`, `module_id`) rather than a single polymorphic `parent_id`, for type safety.

## Authentication

- **No auth for MVP**: Single-user local dev. Data is scoped by instructor but there's no login/password system. The UI lets you switch instructors implicitly via term ownership.

- **Multi-tenant ready**: The data model supports multiple instructors. Auth can be layered on without schema changes.

## Calendar / Schedule

- **Calendar is display-only**: The requirements mentioned iCal but the user clarified the calendar is for display (showing lecture/lab numbers and dates), not for integration with external calendar apps.

- **Calendar display deferred**: A full calendar view (weekly grid with sessions) is deferred to a future phase. The MVP shows sessions as a sorted list within modules, with dates visible.

- **Session dates are optional**: Sessions can be created without dates (useful during planning). The impact report flags undated sessions as info items.

## AI Integration

- **Mock only for MVP**: The `AiPlanner` interface is implemented with `MockAiPlanner` that returns canned responses. Designed for future OpenAI and Anthropic adapters.

- **Two provider slots**: The interface anticipates both ChatGPT (OpenAI) and Claude (Anthropic) as real implementations, with env vars `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`.

## Export

- **Artifact export stubs**: The `ArtifactExporter` interface returns mock content. The notebook skeleton generator creates a valid `.ipynb` structure but with placeholder content.

- **No iCal export**: Per user preference, we implemented artifact export stubs instead of iCal. iCal can be added later behind the same interface pattern.

## Coverage Rules

- **Ordering by sequence, not just date**: Coverage ordering is determined by `module_sequence` first, then `session_sequence`, then `date` as tiebreaker. This handles cases where dates are null or sessions are on the same day.

- **Same-session multi-level allowed**: A skill can be both "introduced" and "practiced" in the same session (common for labs).

## Term Cloning

- **Dates are cleared on clone**: When cloning a term, all session dates and assessment due dates are set to null. The instructor must set new dates for the new term.

- **Prior art linking**: Cloned sessions automatically reference their source sessions in the `prior_art` array, enabling "what did I do last time?" queries.

- **Same instructor by default**: Clone defaults to the same instructor but accepts an optional `instructorId` override.

## UI

- **Server components for homepage**: The homepage uses server-side rendering. All interactive pages (terms, modules, etc.) are client components.

- **No drag-and-drop**: Session reordering uses form-based sequence numbers, not drag-and-drop. Drag-and-drop is a future polish item.

- **Inline coverage in session list**: Coverage entries are shown inline on the session list (e.g., `[A01:I, A02:P]`) for quick scanning.
