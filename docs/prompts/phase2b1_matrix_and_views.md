# phase2b1_matrix_and_views.md

## Prompt Name
Course Planner — Phase 2B.1: Coverage Matrix Fix and
Content Views
(Runs in PARALLEL with Phase 2B.2)

## How to use
1) Open the course-planner repo in Claude Code Web.
2) Ensure Phase 2A is fully merged (PRs #2 and #3).
3) Paste this entire prompt.
4) Let it run. No kickoff questions — defaults are below.

## Prerequisite

Phase 2A (PRs #2 and #3) must be merged. Key files:

- `src/lib/api-client.ts` — typed client (extend this
  for any new endpoints)
- `src/components/WhatIfPanel.tsx` — shared what-if panel
- `src/domain/whatif.ts` — pure domain functions
- `src/lib/term-data.ts` — shared data loader
- `src/app/terms/[id]/calendar/page.tsx` — calendar view
- `src/app/terms/[id]/coverage/page.tsx` — coverage
  matrix (known gap: only shows skills with existing
  coverage, hiding the uncovered skills that matter most)
- `src/app/terms/[id]/assessments/page.tsx` — has local
  duplicate types
- `src/app/terms/[id]/impact/page.tsx` — has local
  duplicate types
- `src/app/terms/[id]/import/page.tsx` — has raw fetch()
- `prisma/schema.prisma` — current schema
- `e2e/calendar-whatif.spec.ts` — existing E2E scaffold

---

## Role
You are a senior full-stack engineer continuing work on an
existing codebase. You are turning a planning tool into a
full course workspace.

Read `CLAUDE.md` and `docs/design-principles.md` first.

If something is underspecified, make a reasonable default,
document it in `ASSUMPTIONS.md` (append), and proceed.

Work test-first (TDD) for domain logic and API routes.

---

## Defaults (no kickoff questions)

- Inline click-to-edit for descriptions (save on blur)
- Session detail as a slide-over panel from calendar,
  with its own URL for direct linking
- Term dashboard enhances the existing `/terms/[id]` page
  (don't create a separate dashboard page)
- Proceed immediately after confirming prerequisites

---

## PARALLEL SESSION NOTICE

This prompt runs in parallel with Phase 2B.2 (Skill Flow
Visualization). To avoid merge conflicts:

**You own these files** — modify freely:
- `src/app/terms/[id]/coverage/page.tsx`
- `src/app/terms/[id]/assessments/page.tsx`
- `src/app/terms/[id]/impact/page.tsx`
- `src/app/terms/[id]/import/page.tsx`
- `src/app/terms/[id]/page.tsx` (term detail)
- `src/lib/api-client.ts` (extend with new methods/types)
- Any files you create under `src/app/terms/[id]/modules/`
  or `src/app/terms/[id]/sessions/`
- `src/components/` (any new shared components)

**Do NOT create or modify these** — the parallel session
owns them:
- `src/app/terms/[id]/flow/` (anything under this path)
- `src/components/flow/` (anything under this path)

If you want to add a "Flow View" nav link on the term
detail page, add it with `href={/terms/${id}/flow}` but
know the page won't exist until the parallel PR lands.

---

## Context: What's missing

The app can import data, display a calendar, and simulate
cancellations. But it has no content depth. Clicking a
module or session leads nowhere useful. The coverage
matrix actively hides uncovered skills — the exact thing
it should surface. There's no way to see a module as a
coherent planning unit or trace a skill's assessment
history.

The result: the app feels like a database viewer, not a
workspace. This phase fixes that.

---

## Rules from prior phases (READ CAREFULLY)

These patterns caused bugs in Phases 2A and 2A.3:

a) **Always use `src/lib/api-client.ts`** — NEVER use raw
   `fetch()` in page or component files. If api-client.ts
   doesn't have the method you need, ADD it there first,
   then call it from the UI.

b) **Import types from `src/lib/api-client.ts`** — NEVER
   define local `interface` duplicates in page files. The
   coverage, assessments, and impact pages currently have
   duplicate type definitions with `as unknown as X`
   double-casts. Fix these as you touch those files.

c) **Wire parameters end-to-end.** If you add a field to
   a Zod schema on a route, also add it to the
   api-client.ts method signature AND thread it through
   every UI component that calls it. Don't leave gaps
   between backend and frontend.

d) **E2E tests must import real data.** Playwright tests
   should use the import endpoints to load calendar +
   structure data before testing UI features. An E2E test
   on an empty database verifies nothing useful.

e) **Extract shared UI into `src/components/`.** Currently
   only WhatIfPanel.tsx lives there. As you build content
   views, extract reusable pieces (breadcrumbs, editable
   text fields, status badges, coverage level badges)
   into components/ rather than duplicating across pages.

---

## Known tech debt to fix in this pass

Fix these as you touch the affected files (don't make a
separate cleanup pass):

- `src/app/terms/[id]/coverage/page.tsx` — local Skill,
  Session, CoverageRow interfaces duplicate api-client.ts.
  Replace with imports from api-client.
- `src/app/terms/[id]/assessments/page.tsx` — local Skill,
  AssessmentSkill, Assessment interfaces duplicate
  api-client.ts.
- `src/app/terms/[id]/impact/page.tsx` — local types
  that may duplicate api-client.ts.
- `src/app/terms/[id]/import/page.tsx` — raw fetch() for
  JSON imports (CSV tab is fine since it needs different
  Content-Type, but Calendar and Structure tabs should
  use the typed client).

---

## What to build (in this order)

### A) Priority 1: Fix the Coverage Matrix

The current matrix only shows skills that already have
coverage entries. This defeats the purpose — see design
principle #4 ("Gaps are more important than coverage").

**Fixes:**

1. Show **ALL skills** for the term as rows, including
   those with zero coverage. Empty rows ARE the point —
   they show gaps.

2. Add a **coverage health summary** bar above the matrix:
   - "X skills fully covered (I + P + A)"
   - "Y skills partially covered"
   - "Z skills with no coverage"
   - Use color-coded segments (green/yellow/red)
   - Reuse `computeCoverageHealth` from
     `src/domain/whatif.ts` if it fits, or write a simple
     counting function in domain logic (test first).

3. Make **empty cells clickable**: clicking an empty cell
   opens a small popover with three buttons (Introduced,
   Practiced, Assessed) to add coverage directly via
   `api.createCoverage()`.

4. Add a **"Show only gaps"** filter toggle that hides
   fully-covered skills, leaving only partial/uncovered.

5. Add a **"Show only at-risk"** filter that shows skills
   whose coverage was affected by canceled sessions (uses
   the what-if infrastructure from Phase 2A).

6. While you're in this file: remove the local duplicate
   type definitions and import from api-client.ts.

---

### B) Priority 2: In-App Content Views

These views turn the app into a workspace. Each should
feel like reading a living document, not viewing a
database record.

**B1. Term Dashboard (enhance existing `/terms/[id]`)**

The existing term detail page is a flat list of modules
with inline session management. Enhance it:

- **Semester health panel** at top: total sessions,
  scheduled/canceled counts, skill coverage health (from
  the coverage health logic), next upcoming assessment
  due date
- **Module cards**: each module as a card with title,
  session count, skill coverage completeness %, next
  session date. Clicking a card navigates to module
  detail.
- **Assessment timeline**: horizontal bar below the health
  panel showing assessments by due date, color-coded by
  type (GAIE, exam, project, assignment)
- **Recent changes section**: if any sessions were
  canceled or coverage redistributed recently, show a
  brief log ("Lec 14 canceled Feb 3, 4 skills
  redistributed")
- Nav links to: Calendar, Coverage Matrix, Flow View,
  Import

Keep the existing inline session management working —
enhance, don't replace. The module cards can link to
detail pages while the inline expand still works for
quick edits.

**B2. Module Detail View**

New page: `/terms/[id]/modules/[moduleId]`

This should read like the `lm-03-overview.md` exemplar
file (in `docs/ds100-exemplar/`) but be live and
editable:

- **Header**: module code, title, sequence number
- **Learning objectives**: editable list (add/remove/
  reorder)
- **Sessions list**: all sessions in this module, ordered
  by date, each showing:
  - Title, date, type badge (lecture/lab), status badge
    (scheduled/canceled/moved)
  - Description (inline click-to-edit — click text to
    enter edit mode, save on blur or Cmd/Ctrl+Enter)
  - Coverage badges: which skills at which levels
  - Canceled sessions shown with strikethrough and
    redistribution notes
- **Skills summary table**: all skills covered in this
  module, their coverage progression (where they're I'd,
  P'd, A'd across this module's sessions)
- **Notes section**: free-form editable text area for
  instructor planning notes about the module

This page needs a `notes` field on the Module model.
Add it to the Prisma schema as an optional text field.
Run a migration.

**B3. Session Detail View**

New route: `/terms/[id]/sessions/[sessionId]`

Also accessible as a slide-over panel from the calendar
(clicking a session card opens the panel; the URL updates
so it's directly linkable).

Content:
- Full session description (editable inline)
- Type and status badges
- Coverage entries with skill details (skill code,
  description, level badge)
- Linked assessments
- If canceled: reason, timestamp, redistribution audit
  trail (which skills went where, from Coverage
  `redistributedFrom`)
- Notes field (editable)
- "What if I cancel this?" button (opens WhatIfPanel)

**B4. Skill Detail View**

Enhance the existing `/skills` page or add
`/terms/[id]/skills/[skillId]`:

- Skill description, category, code
- **Coverage timeline**: horizontal bar showing where
  this skill appears across the semester — which sessions
  introduce, practice, and assess it, in chronological
  order. Simple colored dots on a timeline, not a complex
  visualization.
- **Assessment links**: which assessments test this skill
- **Coverage gaps**: if the skill is missing I, P, or A
  coverage, show it prominently

---

### C) Priority 3: Navigation and Polish

Build these as you build the content views (not as a
separate pass):

- **Breadcrumbs**: Term > Module > Session hierarchy on
  all detail pages. Extract as a shared component.
- **Loading states**: skeleton/spinner for data-fetching
  views. At minimum: term dashboard, module detail,
  coverage matrix.
- **Empty states**: helpful messages when lists are empty
  ("No sessions in this module yet. Import course
  structure or add sessions manually.")
- **Toast notifications**: simple toast for save
  confirmations ("Description updated", "Coverage added")
  and errors. Use a lightweight approach — a context
  provider + CSS transitions, no heavy library.

---

## TDD requirements

Minimum test coverage for this phase:

**Domain logic tests:**
- Coverage matrix data assembly: given N total skills and
  M coverage entries, verify all N skills appear in the
  matrix output
- Coverage health summary: verify fully/partially/
  uncovered counts

**API route tests (if new routes needed):**
- Module detail endpoint returns sessions with coverage
  and learning objectives
- Any new endpoints added for content views

**Playwright E2E (at least one):**
- Import data → navigate to term dashboard → click module
  card → verify module detail shows sessions and skills →
  click a session → verify session detail shows coverage

If scope must be cut: cut toast notifications first, then
loading states. Do not cut the content views or the
coverage matrix fix.

---

## Constraints

- **Mock AI only.** Keep `MockAiPlanner`. No real AI.
- No authentication yet.
- **Generic app** — nothing course-specific.
- Extend existing pages (term detail) rather than creating
  parallel dashboard pages.
- Prefer simple Tailwind CSS. No UI component library.
- New schema fields are fine (e.g., Module.notes). Run
  migrations.

---

## Definition of done

A reviewer can:
- View the coverage matrix with ALL skills visible,
  including uncovered ones as prominent empty rows
- See the health summary bar (X fully covered, Y partial,
  Z uncovered)
- Click an empty cell to add coverage directly
- Toggle "Show only gaps" to focus on uncovered skills
- Navigate to the term dashboard and see health stats,
  module cards, assessment timeline
- Click a module card to reach the module detail view
- Read learning objectives, session descriptions, and
  skill coverage on the module detail page
- Edit a session description inline (click-to-edit)
- View a session detail with coverage, assessments, and
  cancellation audit trail
- View a skill's coverage timeline across the semester
- Navigate via breadcrumbs (Term > Module > Session)
- See helpful empty states and loading skeletons
- Run `npm test` with all tests passing
- Run `npm run e2e` with at least one passing E2E test

---

## Operating rules
- Read `CLAUDE.md` first.
- Do not ask for permission to create files; just do it.
- Avoid overengineering. Prefer simple, readable solutions.
- Prefer small, focused commits with clear messages.
- If you hit ambiguity, choose a default, record it in
  `ASSUMPTIONS.md`, proceed.
- Append to existing docs — don't overwrite prior content.
- Respect the parallel session file ownership rules above.
- Update `docs/phase-roadmap.md` when this phase is done.

---

## Start now
Begin by:
1) Confirming Phase 2A features are present.
2) Summarizing the scope you will deliver (1 paragraph).
3) Starting implementation with the coverage matrix fix.
