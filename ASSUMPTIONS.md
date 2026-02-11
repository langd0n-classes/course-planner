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

## Phase 2A — Calendar & Import

### Calendar Model

- **CalendarSlot separates container from content**: CalendarSlots define when a class COULD meet (holidays, class days, breaks, finals). Sessions define what is planned for a given date. They are matched by date, not by foreign key, to allow importing calendars independently from course structure.

- **SlotType `break_day` instead of `break`**: The enum uses `break_day` because `break` is a reserved word in most languages and could cause issues in code generation.

- **Calendar days only, no time of day**: The calendar models days (Tue/Thu/Fri) but not specific time slots. Time-of-day scheduling is deferred.

### Import

- **Imports are additive only**: Import endpoints do not delete or overwrite existing data. If imported codes conflict with existing data, the import is rejected with a warning. This prevents accidental data loss from re-imports.

- **Skills created as term-scoped on import**: Imported skills use `isGlobal: false` and are linked to the importing term. Global skills can still be created manually.

- **Session sequences auto-assigned**: When importing sessions within a module, sequences are assigned based on array order if not explicitly provided.

- **Coverage redistribution is historical**: When a session is canceled and skills are redistributed, the original coverage entries remain on the canceled session. New entries are created on target sessions with `redistributedFrom` pointing back to the canceled session. This maintains a full audit trail.

### What-If

- **What-if is read-only until Apply**: The what-if panel runs pure simulation functions without touching the database. Only the "Apply cancellation" action persists changes.

- **New violations only**: The what-if simulation reports only NEW ordering violations caused by a cancellation, filtering out pre-existing violations.

- **Demo scenarios use live data**: The what-if panel's demo scenarios select sessions from the actual term data rather than using canned mock data. This ensures the demo reflects the current state of the course.

### Calendar View

- **Meeting pattern is data-driven**: The calendar view derives day columns from (1) the term's `meetingPattern.days` field if present, (2) unique `dayOfWeek` values from class_day CalendarSlots, or (3) a fallback of Tue/Thu/Fri. This handles MWF, TTh, daily, or any other pattern.

- **Module color coding by sequence**: Each module gets a distinct color based on its sequence number (cycling through 8 colors). This provides visual grouping on the calendar without requiring instructor configuration.

## Phase 2A.3 — Redistribution & Polish

### Redistribution UI

- **Redistribution step is optional**: After choosing to cancel a session, the instructor sees at-risk skills (unique coverage) with dropdowns to pick target sessions. They can redistribute, skip redistribution, or partially redistribute.

- **dryRun validation via cancel endpoint**: The cancel endpoint accepts a `dryRun: true` parameter that runs all validation (including ordering checks) without persisting the cancellation. This avoids duplicating validation logic in a separate endpoint.

- **AI suggestion is mock-only**: The "Suggest Redistribution" button calls a mock AI service that uses same-module preference, related-category preference, and round-robin distribution. No real AI provider is integrated.

- **Empty cell interactions use a modal**: Clicking an empty calendar cell (class_day with no session) opens a modal with "Create new session" and "Assign existing session" options, rather than inline editing.

- **WhatIfPanel is a shared component**: The what-if panel was extracted from the calendar page into `src/components/WhatIfPanel.tsx` and is reused on both the calendar view and the term detail page.

- **Non-at-risk skills shown collapsed**: Skills with `uniqueCoverage: false` are shown in a collapsed "Also covered elsewhere" section rather than the main at-risk list, to reduce noise.

### API Client Cleanup

- **Typed API client is the source of truth for UI types**: Page components import types from `src/lib/api-client.ts` rather than defining local duplicates. The `as unknown as X` pattern is removed in favor of direct typed returns.

- **Coverage and assessment pages retain local types**: Some pages define extended local interfaces (e.g., `CoverageRow`) that add fields not in the api-client types. These were left as-is to avoid scope creep.

## Phase 2B.1 — Coverage Matrix + Content Views

### Coverage Matrix

- **Matrix shows ALL skills**: The coverage matrix now shows every skill registered for the term, including those with zero coverage. Previously only skills with at least one coverage entry were visible, hiding gaps.

- **Health summary uses three-state model**: Skills are classified as "fully covered" (I + P + A), "partially covered" (at least one level but not all three), or "uncovered" (no coverage at all). The health bar shows all three states.

- **Canceled sessions excluded from health tracking**: Coverage entries on canceled sessions don't count toward a skill's coverage levels. The coverage entries are still visible in the matrix (for audit trail) but are not considered for the health summary.

- **Empty cell click-to-add via popover**: Clicking an empty matrix cell opens a small popover with I/P/A buttons rather than a modal or inline form. This minimizes disruption to the matrix view.

### Content Views

- **Module.notes field added**: A free-text `notes` field was added to the Module model for planning notes. This supports the "workspace" design principle — instructors can annotate modules with planning thoughts without it being formal content.

- **Session detail shows redistribution audit trail**: Redistributed coverage entries (those with `redistributedFrom` set) are shown in a separate section with orange styling to distinguish them from original coverage.

- **Skill detail uses timeline visualization**: Coverage entries for a skill are displayed as a vertical timeline sorted by session date/sequence, showing the progression through I → P → A.

- **Content views use shared components**: Breadcrumbs, CoverageBadge, StatusBadge, EditableText, LoadingSkeleton, and Toast are extracted to `src/components/` for reuse across all content views.

### Tech Debt Cleanup

- **Import page uses api-client**: The import page was the last holdout using raw `fetch()`. A new `importSkillsCsv` method with `requestRaw` helper was added to api-client to handle the text/csv content type.

- **Impact and assessment pages use shared types**: Local duplicate type definitions in the impact and assessments pages were removed in favor of types imported from `api-client.ts`. New `ImpactReport` and `ValidationItem` types were added to the api-client.
