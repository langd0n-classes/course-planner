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

### 2B.2: Skill Flow Visualization (complete)

**Delivered:**
- Skill flow grid (`/terms/[id]/flow`): skills as rows
  grouped by category, sessions as columns grouped by
  module, I/P/A coverage badges
- Skill thread lines: horizontal line from each skill's
  first to last coverage; dashed red (broken) across
  canceled sessions — design principle #5's signature
  visual
- Gap visibility: uncovered skills with red left border +
  NOT COVERED label; partial coverage yellow
- Canceled sessions: tinted columns, dimmed/struck badges
- Interactions: row + column hover highlighting, click
  cell to add/remove coverage, session/skill headers link
  to detail pages
- Filters: category, module, gaps-only, show/hide canceled
- Summary bar: skills health, session counts, at-risk count
- Stretch goal shipped: read-only what-if cancellation
  overlay (pure `simulateCancellation`, impact summary,
  dashed simulated column, at-risk row flags)
- flow-utils unit tests (68 total suite tests)

**Scope (original):**
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

### 2C: External-System Exports (complete)

**Delivered:**
- `src/lib/exporters.ts` export builders for:
  - term summary markdown
  - module overview DOCX
  - session GenAI prompt text
- Export routes:
  - `GET /api/terms/[id]/export/summary`
  - `GET /api/modules/[id]/export-overview`
  - `GET /api/sessions/[id]/export-prompt`
- DOCX packaging via `docx` for Blackboard-compatible module overview downloads
- API route tests for module overview and session prompt exports
- Minimal secondary download controls on the term, module, and session detail pages via the shared api-client download path

Exports remain a "failure state" (design principle #2): they are present as
small secondary actions, not a separate workspace.

**Issue:** #6

**Depends on:** Phase 2B complete (#4, #5).

---

## Roadmap ordering (updated 2026-07-11)

The phases below merge the original roadmap (3/4/5) with ideas from an
unscoped `gpt-5.6-sol` ideation pass (`docs/plans/open-ended-feature-ideas.md`
on `explore/sol-open-ended-ideas`) into one priority order. **Operator
decision:** real AI integration (originally Phase 3) is pushed to last —
`MockAiPlanner` is sufficient until the UI/general-feature surface is mostly
built out; there's no reason to pay AI design/cost/latency complexity before
the workflows it would enhance are themselves settled.

Two architecture debts, flagged during the Sol ideation pass, should be
resolved before the phases that depend on them (called out inline below —
don't let them become load-bearing bugs in newer, bigger features):
- **Temporal ordering isn't truly temporal**: coverage validation sorts by
  module/session *sequence*, with date only as a tiebreaker, so a session
  can move to a different date without its effective pedagogical order
  changing. Relevant to any phase reasoning about "what order did things
  really happen in."
- **Skill ownership on term clone is inconsistent**: term imports create
  term-scoped skills, but cloning reuses every coverage/assessment skill ID
  as-is, so a cloned term can point at skills owned by its source term.
  Relevant to any phase that builds on top of cloning (course-memory, most
  directly).

---

## Phase 3: Prerequisite Readiness

**Goal:** Turn the existing `Skill.prerequisites` field (in the schema,
currently unused by planning logic) into an operational dependency graph.

**Scope (tentative):**
- Show where a session relies on skills not yet introduced/sufficiently
  practiced
- Identify bottleneck skills
- Include downstream readiness failures in move/cancellation simulations
  (e.g. canceling an early session can make later sessions pedagogically
  premature even if that session's own coverage totals look fine)
- Deepens design principle #5 (skills flow through the semester) across
  skills, not just within one skill's I→P→A levels — complements the flow
  view rather than duplicating it

No real AI needed — deterministic graph traversal and readiness rules.
Builds directly on the flow visualization just shipped (#5/#8).

**Depends on:** resolving the temporal-ordering debt above first — a
prerequisite graph is meaningless if session order isn't trustworthy.

**No build prompt written yet.**

---

## Phase 4: Capacity & Workload Budgets

**Goal:** Add feasibility signals alongside the existing coverage/gap
signals — a structurally "healthy" plan can still be unteachable (three
major assessments landing together, a canceled lecture's content dumped
into a session with no room for it).

**Scope (tentative):**
- Estimated/observed effort on sessions, activities, assessments (student
  prep/completion time, in-class minutes, instructor grading load)
- Weekly load bands; flag overloaded weeks, assessment pileups,
  implausibly dense sessions
- Extend redistribution validation to ask "can this session absorb the
  work?", not just "does ordering remain valid?"

No real AI needed. Stretches the current mostly-count-based health model
into a feasibility dimension — a deliberate, worthwhile stretch.

**No build prompt written yet.**

---

## Phase 5: Workspace Continuity — Planning Branches & Course Memory

**Goal:** The two largest workspace-depth ideas from the ideation pass,
grouped because they're both about the app remembering/simulating across
time rather than just within a single edit.

**Scope (tentative):**
- **Persistent planning branches**: generalize the single-session
  cancellation preview (design principle #3, what-if before commit) into
  named, persistent scenarios — multiple tentative changes, compared
  against the live plan, applied whole or in part. The fullest expression
  of the what-if principle.
- **Course-memory loop**: structured post-use reflection per session/
  assessment/module (what happened, timing variance, keep/revise/retire),
  surfaced as an "adaptation inbox" during term cloning. `priorArt` and
  `clonedFromId` already exist in the schema and are barely consumed today
  — this closes that gap rather than opening a new one.

No real AI required for either; mock AI could later populate a branch
proposal or reflection prompt, but the workflows are valuable without it.

**Depends on:** resolving the skill-ownership-on-clone debt above — the
course-memory loop's clone-adaptation workflow would otherwise inherit
that inconsistency.

**No build prompt written yet.**

---

## Phase 6: Content Authoring

**Goal:** The app becomes where instructors BUILD course content, not
just plan it. (Originally Phase 4 — unchanged, still the long-term vision
described in the design principles.)

**Scope (tentative):**
- In-app assignment authoring (with AI assistance)
- Lecture plan builder
- Past-semester content reference and adaptation
- Template system for common content patterns
- Integration with notebook formats (Jupyter/Otter)

**No build prompt written yet.**

---

## Phase 7: Evidence-Backed Alignment

**Goal:** Replace the implicit assumption that an I/P/A label proves
alignment with a traceable chain: learning objective → skill → learning
activity → assessment → rubric criterion. Today, adding an "assessed"
badge can make the matrix look healthy even if the assessment doesn't
meaningfully elicit that skill — this measures bookkeeping completeness,
not alignment quality.

**Scope (tentative):**
- Coverage entries carry a brief rationale/evidence reference
- Distinguish declared coverage vs. activity-backed vs.
  assessment-linkage-without-rubric vs. unmapped objectives
- Primary experience stays an interactive alignment view, not an
  accreditation export (principle #2 still applies if an institution
  eventually needs one)

Largest and most decision-heavy of the ideation-pass ideas (rubric
criteria as first-class entities? how much evidence counts as verified?
configurable taxonomies beyond I/P/A?) — placed after the more concretely
scoped phases above.

**No build prompt written yet.**

---

## Phase 8: History, Search, Collaboration

**Goal:** unchanged from the original Phase 5.

**Scope (tentative):**
- Cross-term search (find sessions by topic across all
  terms)
- Term comparison (side-by-side diff)
- Skill evolution timeline across semesters
- Audit log
- Authentication and role-based access
- Real-time collaboration

**No build prompt written yet.**

---

## Phase 9: AI Integration

**Goal:** Replace mock AI with real providers. (Originally Phase 3 —
deliberately moved last; see the ordering note above.)

**Scope (tentative):**
- Real AiPlanner implementation (Claude/Anthropic)
- Redistribution suggestions powered by actual course
  context
- Coverage gap analysis with pedagogical reasoning
- Contextual chat for course design consultation
- Content review against pedagogical principles

**Depends on:** the bulk of the UI/general-feature phases above.
`MockAiPlanner` remains the default per design principle #8 until real
integration is explicitly opted into.

**No build prompt written yet.** Design depends on the state of the app
once the phases above are further along.
