# phase2b_views_flow_workspace.md

## Prompt Name
Course Planner — Phase 2B: Content Views, Flow
Visualization, Workspace UX
(Sequential follow-up to Phase 2A)

## How to use
1) Open the course-planner repo in Claude Code Web.
2) Ensure Phase 2A work is merged to main.
3) Paste this entire prompt into Claude Code Web.
4) Answer the kickoff questions, then let it run.

## Prerequisite
Phase 2A must be merged. The app should have:
- Working data import (calendar + course structure)
- Calendar view with sessions in date slots
- What-if panel with cancellation/redistribution workflow
- `CalendarSlot` model, `status` field on Session,
  `redistributedFrom` on Coverage
- DS-100 exemplar data importable

---

## Role
You are a senior full-stack engineer continuing work on an
existing codebase. You are extending a working planning tool
into a full course workspace.

Your job is to make the in-app experience rich enough that
instructors rarely need to leave the app. If something is
underspecified, make a reasonable default, document it in
`ASSUMPTIONS.md` (append), and proceed.

Work test-first (TDD). Keep external integrations behind
pluggable interfaces with mocks.

---

## Design principle (IMPORTANT — same as Phase 2A)

**The app IS the workspace, not a data entry form.**

Everything should be visible and interactive in the UI.
Exports exist ONLY for feeding external systems the app
cannot replace (LMS import, GenAI content generation
prompts). If you're tempted to build a "download as
markdown" feature, ask: should this just be a page or panel
in the app instead? The answer is almost always yes.

---

## Inputs (already in the repo)

- `docs/ds100-exemplar/` — exemplar course data (read the
  README)
- `docs/course-planner-requirements.md` — original
  requirements
- `ARCHITECTURE.md`, `ASSUMPTIONS.md` — existing docs
- All Phase 2A code (import, calendar, what-if)
- The app should have DS-100 exemplar data imported (run
  the seed script from Phase 2A if needed)

---

## Kickoff questions (ask once, then continue)

1) Has Phase 2A been fully merged? Can you confirm the
   calendar view, what-if panel, and import pipeline are
   working?

2) For the skill flow visualization (Priority 3 below),
   do you want a simple HTML/CSS version first or jump
   straight to SVG? (default: HTML/CSS with flexbox,
   upgrade to SVG later)

3) For the module detail view, should session descriptions
   be editable inline (click-to-edit) or open in a
   separate form/modal? (default: inline click-to-edit)

If I don't answer within a reasonable time, proceed with
defaults.

---

## What to build (in this order)

### A) Priority 1: Fix the Coverage Matrix

The current matrix only shows skills that already have
coverage entries. This defeats the purpose.

**Fixes:**
- Show **ALL skills** for the term as rows, including
  those with zero coverage. Empty rows ARE the point —
  they show gaps.
- Add a **coverage health summary** bar above the matrix:
  - "X skills fully covered (I + P + A)"
  - "Y skills partially covered"
  - "Z skills with no coverage"
  - Use color-coded segments (green/yellow/red)
- Make **empty cells clickable**: clicking an empty cell
  opens a small popover with three buttons (Introduced,
  Practiced, Assessed) to add coverage directly
- Add a **"Show only gaps"** filter toggle that hides
  fully-covered skills, leaving only partial/uncovered
- Add a **"Show only at-risk"** filter that shows skills
  affected by any canceled sessions (uses the what-if
  infrastructure from Phase 2A)

---

### B) Priority 2: In-App Content Views

These are the views that make the app a workspace instead
of a database. Each should feel like reading a living
document, not viewing a database record.

**B1. Term Dashboard (enhance existing term detail)**

The existing `/terms/[id]` page should become a rich
dashboard:
- **Semester health panel**: quick stats (total sessions,
  scheduled/canceled counts, skill coverage health from
  the matrix summary, upcoming due dates)
- **Module cards**: each module as a card showing title,
  session count, skill count, coverage completeness
  percentage, next upcoming session date
- **Assessment timeline**: horizontal bar showing
  assessments by due date, color-coded by type (GAIE,
  exam, project, assignment)
- **Recent changes**: if any sessions were canceled or
  coverage was redistributed, show a brief activity log
- Links to: Calendar, Coverage Matrix, Flow View,
  Import, and each Module detail

**B2. Module Detail View**

New page: `/terms/[id]/modules/[moduleId]`

This should read like the `lm-03-overview.md` exemplar
file but be live and editable:
- **Header**: module title, sequence number, code
- **Learning objectives**: editable list
- **Sessions list**: all sessions in this module, ordered
  by date, each showing:
  - Title, date, type badge (lecture/lab), status badge
  - Description (editable inline — click to edit, save
    on blur or enter)
  - Coverage badges: which skills at which levels
  - Linked assessments
  - Canceled sessions shown with strikethrough but still
    visible, with redistribution notes
- **Skills in this module**: table showing all skills
  associated with this module, their coverage progression
  (where they're I'd, P'd, A'd), and whether they're
  assessed
- **Notes/planning section**: free-form editable text
  area for instructor notes about the module

**B3. Session Detail View**

New page: `/terms/[id]/sessions/[sessionId]` (or a rich
panel/modal from the calendar):
- Full session description (editable)
- Coverage entries with skill details
- Linked assessments
- Prior art references (sessions from other terms that
  covered similar content — from the `priorArt` field)
- Status indicator (scheduled/canceled/moved)
- If canceled: show reason, when, and what happened to
  the coverage (redistribution audit trail)
- Notes field (editable)
- "What if I cancel this?" button that opens the what-if
  panel from Phase 2A

**B4. Skill Detail View**

New page: `/skills/[id]` (or expand the existing skills
browser):
- Skill description and metadata
- **Coverage timeline**: a horizontal bar showing where
  this skill appears across the semester — which sessions
  introduce, practice, and assess it, in date order
- **Assessment links**: which assessments test this skill
- **Cross-term history** (stretch): if this skill exists
  in other terms, show how it was covered there
- **Dependency chain**: which other skills are
  prerequisites, which depend on this one

---

### C) Priority 3: Skill Flow Visualization

New page: `/terms/[id]/flow`

This is the view that makes dependency chains visible at
a glance. It answers: "if I remove this session, what
breaks downstream?"

**Layout — horizontal swimlane:**
- **Columns** = modules, arranged left to right in
  sequence order
- Within each column, **sessions** are listed vertically
  in date order (top to bottom)
- **Skills** are represented as horizontal
  lines/edges/bars flowing left to right through the
  sessions where they're covered

**Visual encoding:**
- Each skill-line changes color as coverage progresses:
  - Yellow = Introduced
  - Blue = Practiced
  - Green = Assessed
  - Gray dashed = no coverage (gap between sessions)
- Canceled sessions: their skill-lines become **dashed
  red**, showing the break in the chain
- Skills with no coverage at all: show as a thin gray
  line at the bottom with a "not covered" label

**Interactions:**
- **Hover** a skill-line: highlight all sessions and
  assessments connected to that skill
- **Hover** a session: highlight all skill-lines that
  pass through it
- **Click** a session: open session detail panel
- **Click** a skill-line: open skill detail view

**What-if integration:**
- The flow view should respond to the what-if panel's
  simulated state. When the instructor is exploring
  "what if I cancel Lec 14?", the flow view should
  show that session's skill-lines turning dashed red
  in real time, before anything is committed.
- Comparing two scenarios should be possible: "show me
  the flow with Lec 14 canceled" vs. "show me the flow
  with Lec 15 canceled" (could be toggle buttons or
  side-by-side, whichever is simpler)

**Implementation guidance:**
- Start with HTML/CSS (flexbox columns, colored divs
  for skill bars). This doesn't need D3 or canvas.
- If more than ~20 skills, add vertical scrolling with
  sticky column headers
- Module columns should have a fixed width; skill bars
  stretch across columns based on where coverage exists
- Consider a simplified "compact" mode that just shows
  dots (I/P/A) in a grid rather than flowing lines, as
  a fallback if the full visualization is too complex

---

### D) Priority 4: External-System Exports (minimal)

Only build exports for things that MUST leave the app to
feed another system. Everything else should be an in-app
view.

**D1. Blackboard module overview export**

Study `docs/ds100-exemplar/extract_blackboard.py` to
understand the format. Build:
- Button on the module detail view: "Export for Blackboard"
- Generates a `.docx` file for the module overview in the
  format Blackboard Ultra expects
- Content: module title, learning objectives, session list
  with dates and descriptions (date-agnostic where noted
  in the exemplar — the Blackboard section should work
  across semesters)
- Wire through the `ArtifactExporter` service interface

**D2. Term summary (reference export)**

One concession to "useful download":
- Button on the term dashboard: "Export term summary"
- Generates a markdown file with: all modules, their
  sessions (dates, titles), skill coverage summary,
  assessment schedule
- This is a reference document for the instructor's own
  records, not for import into another system

**D3. Session/lecture prompt export**

Button on the session detail view: "Export as prompt"
- Generates a structured text prompt that an instructor
  can paste into a GenAI tool (Claude, ChatGPT, etc.) to
  help build the actual lecture content, assignment, or
  lab outside the system
- Include: session title, description, module context,
  skills to cover (with levels), related assessment info,
  prior art references, any relevant pedagogical notes
- This is the "hand off to GenAI for content creation"
  bridge until the app itself can do content authoring

---

### E) Technical Polish

- **Loading states**: add skeleton/spinner states for all
  data-fetching views (currently pages crash or show
  nothing while loading)
- **Toast notifications**: add a simple toast system for
  confirmations ("Session canceled", "Coverage added",
  "Import complete") and errors
- **Responsive basics**: the calendar and flow views
  should not break on smaller screens (horizontal scroll
  is fine, but don't clip content)
- **Navigation breadcrumbs**: Term > Module > Session
  hierarchy visible on detail pages for easy back-
  navigation
- **Empty states**: all list views should have helpful
  empty states ("No sessions yet. Import your course
  structure or create sessions manually.")

---

## TDD requirements

Minimum test coverage for this phase:

**Domain logic tests:**
- Coverage matrix data assembly: ensure all skills appear
  including uncovered ones
- Coverage health calculation (fully/partially/uncovered
  counts)

**API route tests:**
- Module detail endpoint returns sessions with coverage
- Skill detail endpoint returns coverage timeline
- Blackboard export generates valid output

**Component tests (if feasible):**
- Coverage matrix renders uncovered skills
- Flow view renders skill lines through correct sessions

**Playwright E2E (at least one):**
- Navigate from term dashboard → module detail → session
  detail → verify content is consistent and editable

If you need to reduce scope, reduce export polish first,
then UI polish. Do not cut the flow view or content views.

---

## Constraints

- **Mock AI is fine.** Keep `MockAiPlanner`. No real AI
  integration yet.
- No authentication yet.
- **Generic app** — nothing course-specific in the
  codebase.
- The flow visualization should start simple (HTML/CSS).
  Do not spend time on a complex D3/canvas
  implementation. Get the layout and data flow right;
  visual polish comes later.
- Extend existing pages where possible (e.g., enhance
  term detail rather than building a separate dashboard
  page).

---

## Definition of done

A reviewer can:
- View the coverage matrix with ALL skills visible
  (including uncovered ones showing as gaps)
- Use the coverage health summary to see at a glance
  how complete coverage is
- Click empty cells to add coverage directly
- Navigate to a module detail view that reads like a
  living document (objectives, sessions, skills, notes)
- Edit session descriptions inline on the module detail
  page
- View a skill's coverage timeline across the semester
- Open the flow view and visually trace a skill's
  progression through sessions
- See canceled sessions' broken skill-lines in the flow
  view
- Use what-if simulation and see the flow view update
  to reflect the simulated state
- Export a module overview as `.docx` for Blackboard
- Export a session as a GenAI prompt
- Run `npm test` successfully
- Run `npm run e2e` (if included) successfully

---

## Operating rules
- Do not ask for permission to create files; just do it.
- Avoid overengineering. Prefer simple, readable solutions.
- Prefer small PR-sized commits with clear messages.
- If you hit ambiguity, choose a default, record it in
  `ASSUMPTIONS.md`, proceed.
- Append to existing docs — don't overwrite prior phase
  content.
- The flow visualization does NOT need to be beautiful.
  Correct data and readable layout matter more than
  visual polish in this phase.

---

## Start now
Begin by:
1) Confirming Phase 2A features are present and working.
2) Summarizing the scope you will deliver (1 paragraph).
3) Asking the kickoff questions.
4) After answers (or defaults), start implementing.
