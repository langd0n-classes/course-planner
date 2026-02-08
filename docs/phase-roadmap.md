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

## Phase 2A: Import, Calendar, What-If (next)

**Goal:** Make the app usable for real course planning.

**Scope:**
- Data import pipeline (academic calendar + course
  structure + CSV skills)
- DS-100 exemplar seed script (standalone, generates
  import JSON from `docs/ds100-exemplar/` files)
- Calendar view (weekly grid, holidays, planning gaps)
- Session status field (scheduled/canceled/moved)
- What-if simulation panel (explore impact of
  cancellations before committing, compare scenarios)
- Cancellation workflow with manual skill redistribution
- Redistribution tracking (audit trail)
- Technical debt fixes (Docker build, error handling,
  typed API client)

**Depends on:** Phase 1 merged.

**Build prompt:** `docs/prompts/phase2a_import_calendar_whatif.md`

---

## Phase 2B: Views, Flow, Workspace (after 2A)

**Goal:** Make the app a rich workspace, not just a
planning tool.

**Scope:**
- Coverage matrix fix (show ALL skills, gap visibility,
  clickable empty cells, health summary)
- In-app content views:
  - Term dashboard (health panel, module cards,
    assessment timeline)
  - Module detail view (live editable, reads like an
    overview document)
  - Session detail view (full description, coverage,
    assessments, prior art)
  - Skill detail view (coverage timeline, assessment
    links, dependency chain)
- Skill flow visualization (horizontal swimlane showing
  skills progressing through sessions, integrates with
  what-if panel)
- External-system exports only:
  - Blackboard module overview (.docx)
  - Term summary (markdown, for instructor reference)
  - Session/lecture prompt (for GenAI content generation)
- UI polish (loading states, toasts, breadcrumbs, empty
  states)

**Depends on:** Phase 2A merged. Needs import pipeline
(real data), calendar view (navigation context), and
what-if infrastructure (flow view integration).

**Build prompt:** `docs/prompts/phase2b_views_flow_workspace.md`

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
