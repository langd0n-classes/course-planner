# Phase Roadmap

## Phase 1: MVP (complete)

**Goal:** Working CRUD app with domain validation logic.

**Delivered:**
- Data model: Term, Module, Skill, Session, Coverage,
  Assessment, Artifact, Instructor
- CRUD API routes for all entities
- Domain rules: coverage ordering, GAIE progression,
  orphan/unassessed detection, move impact analysis
- Coverage matrix view with filters
- Impact/validation report
- Term cloning (deep copy)
- Session move with impact feedback
- Assessment management with skill linking
- Skills browser
- Service interfaces (AiPlanner, ArtifactExporter) with
  mock implementations
- 25 unit tests, CI pipeline

**What's missing:** The app is a database with forms, not
a planning tool. No way to import real data, no calendar
view, no change simulation, coverage matrix hides gaps.

**Build prompt:** `docs/prompts/claude_code_web_mvp_build_prompt.md`

---

## Phase 2A: Import, Calendar, What-If

**Goal:** Make the app usable for real course planning.

### Pass 1 (complete — PR #2)

**Delivered:**
- Schema extensions: `SessionStatus` enum (scheduled/
  canceled/moved), `CalendarSlot` model, Coverage
  `redistributedFrom`/`redistributedAt` tracking
- Data import pipeline:
  - `POST /api/terms/[id]/import-calendar` (upsert calendar
    slots with date range validation)
  - `POST /api/terms/[id]/import-structure` (transactional
    import of modules, sessions, skills, coverages,
    assessments with referential integrity checks)
  - `POST /api/terms/[id]/import-skills-csv` (CSV upload)
- DS-100 exemplar seed script (`scripts/generate-ds100-
  exemplar.ts`) generating 60 calendar slots, 8 modules,
  40 sessions, 69 skills, 106 coverages, 9 assessments
- Calendar view (`/terms/[id]/calendar`): weekly grid
  with session cards, module color coding, holidays,
  planning gaps, unscheduled section
- What-if domain logic (`src/domain/whatif.ts`):
  `simulateCancellation`, `compareScenarios`,
  `validateRedistribution`, `computeCoverageHealth`
- What-if panel (side drawer): impact analysis, at-risk
  skills, health diff, scenario comparison, demo scenarios
- Cancellation workflow: `POST /api/sessions/[id]/cancel`
  with `validateRedistribution` call and redistribution
  entries
- Import UI (`/terms/[id]/import`): three tabs (Calendar,
  Structure, CSV), validation preview, file upload
- Technical debt: typed API client (TypeScript generics
  replacing `unknown`), `loadTermData` extracted to
  shared `src/lib/term-data.ts`
- 43 unit tests passing (13 what-if + 5 schema tests)

**Build prompt:** `docs/prompts/phase2a_import_calendar_whatif.md`

### Pass 2 (in progress)

**Scope:**
- Redistribution UI: per-skill target-session dropdowns,
  mock AI suggest button, ordering validation in the UI,
  confirm/skip flow
- Empty calendar cell interactions (click to create or
  assign session)
- What-if panel on term detail page (not just calendar)
- Calendar meeting pattern derived from data (not
  hardcoded TTh/F)
- Typed API client cleanup (remove duplicate interfaces
  and double-casts from pages, switch calendar page to
  use `api` client)
- `next.config.ts` standalone output fix (Docker build)
- Missing tests: cancel route API tests, Playwright E2E
  smoke test

**Build prompt:** `docs/prompts/phase2a3_redistribution_and_polish.md`

---

## Phase 2A.3: Redistribution & Polish (complete)

**Goal:** Make cancellation actionable with redistribution,
fix quality issues from Phase 2A code review.

**Delivered:**
- Redistribution UI in what-if panel: multi-step flow
  (impact → redistribute → validate → confirm)
- At-risk skill dropdowns with same-module/other-module
  grouping
- "Suggest Redistribution" button using improved mock AI
  (same-module, same-category, round-robin preferences)
- dryRun validation via cancel endpoint
- "Cancel Without Redistributing" option
- Non-at-risk skills shown in collapsed reference section
- Empty calendar cell interactions (create session /
  assign unscheduled session)
- What-if panel on term detail page (shared component)
- Calendar meeting pattern derived from data (not
  hardcoded TTh/F)
- Typed API client cleanup: removed duplicate interfaces,
  `as unknown as` casts, raw fetch() in calendar page
- Shared WhatIfPanel component (`src/components/`)
- AI suggestion endpoint (`POST /api/ai/suggest-
  redistribution`)
- Cancel endpoint tests (6 tests with Prisma mocking)
- Playwright E2E test scaffold
- `output: "standalone"` in next.config.ts (was already
  present)
- 49 unit tests passing (6 new cancel route tests)

**Build prompt:** `docs/prompts/phase2a3_redistribution_and_polish.md`

---

## Phase 2B: Views, Flow, Workspace (after 2A)

**Goal:** Make the app a rich workspace, not just a
planning tool.

Split into two parallel sub-phases based on lessons
from Phase 2A (scope was too large for one session;
strict file ownership enables parallel execution).

### 2B.1: Coverage Matrix + Content Views (complete)

**Delivered:**
- Coverage matrix fix: show ALL skills (was hiding
  uncovered), health summary bar (fully/partially/
  uncovered), clickable empty cells with I/P/A popover,
  gap and at-risk filter buttons, session/skill links
- Term dashboard: health panel (session/coverage/
  assessment stats), assessment timeline strip, recent
  cancellations section, module cards with skill/session
  counts
- Module detail view: editable learning objectives,
  planning notes, sessions with inline-editable
  descriptions, skills summary table
- Session detail view: editable description/notes,
  coverage entries, redistribution audit trail, linked
  assessments, what-if panel integration
- Skill detail view: coverage status (I/P/A indicators),
  timeline visualization, assessment links
- New domain logic: `coverage-matrix.ts` with
  `assembleCoverageMatrix`, `computeHealthBar`,
  `filterMatrixRows` + 12 unit tests
- Shared components: Breadcrumbs, CoverageBadge,
  EditableText, LoadingSkeleton, StatusBadge, Toast
  (context + provider)
- Schema: `Module.notes` field added with migration
- Tech debt: import page uses api-client (no raw
  fetch()), impact/assessments pages use shared types
  from api-client
- 61 unit tests passing (12 new coverage-matrix tests)
- E2E test for content navigation (7 test cases)

**Owns:** All existing pages, api-client.ts, components/

**Issue:** #4 (build prompt attached as comment)

### 2B.2: Skill Flow Visualization (parallel)

**Scope:**
- Skill flow grid: skills as rows, sessions grouped by
  module as columns, coverage level dots
- Gap visibility (uncovered skills as prominent empty
  rows)
- Canceled session visual indicators
- Hover/click interactions, filtering
- Stretch: what-if simulation overlay

**Owns:** `src/app/terms/[id]/flow/`,
`src/components/flow/` (new files only)

**Issue:** #5 (build prompt attached as comment)

### 2C: External-System Exports (after 2B)

**Scope (deferred from original 2B):**
- Blackboard module overview (.docx)
- Term summary (markdown, for instructor reference)
- Session/lecture prompt (for GenAI content generation)

Exports are a "failure state" (design principle #2) and
don't block the workspace experience. Deferred to keep
2B focused on in-app views.

**Issue:** #6 (build prompt not yet written)

**Depends on:** Phase 2B complete (#4, #5).

---

## Phase 3: AI Integration (future)

**Goal:** Replace mock AI with real providers.

**Scope (tentative):**
- Real AiPlanner implementation (Claude/Anthropic)
- Redistribution suggestions powered by actual course
  context
- Coverage gap analysis with pedagogical reasoning
- Contextual chat for course design consultation
- Content review against pedagogical principles

**Depends on:** Phase 2B. Manual workflows must be
correct before automating them with AI.

**No build prompt written yet.** Design depends on the
state of the app after Phase 2B.

---

## Phase 4: Content Authoring (future)

**Goal:** The app becomes where instructors BUILD course
content, not just plan it.

**Scope (tentative):**
- In-app assignment authoring (with AI assistance)
- Lecture plan builder
- Past-semester content reference and adaptation
- Template system for common content patterns
- Integration with notebook formats (Jupyter/Otter)

**No build prompt written yet.** This is the long-term
vision described in the design principles.

---

## Phase 5: History, Search, Collaboration (future)

**Scope (tentative):**
- Cross-term search (find sessions by topic across all
  terms)
- Term comparison (side-by-side diff)
- Skill evolution timeline across semesters
- Audit log
- Authentication and role-based access
- Real-time collaboration

**No build prompt written yet.**
