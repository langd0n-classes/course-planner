# phase2b2_flow_visualization.md

## Prompt Name
Course Planner — Phase 2B.2: Skill Flow Visualization
(Runs in PARALLEL with Phase 2B.1)

## How to use
1) Open the course-planner repo in Claude Code Web.
2) Ensure Phase 2A is fully merged (PRs #2 and #3).
3) Paste this entire prompt.
4) Let it run. No kickoff questions — defaults are below.

## Prerequisite

Phase 2A (PRs #2 and #3) must be merged. Key files you
will READ but not modify:

- `src/lib/api-client.ts` — typed client with these
  methods you'll use:
  - `api.getModules(termId)` — returns modules
  - `api.getSessions({ termId })` — returns sessions
    with module info
  - `api.getSkills(termId)` — returns all skills
  - `api.getCoverages({ termId })` — returns all
    coverage entries with skill and session info
  - `api.getTerm(id)` — returns term with modules
- `src/domain/whatif.ts` — pure functions:
  `simulateCancellation`, `computeCoverageHealth`
- `src/lib/term-data.ts` — `loadTermData` function
- `docs/design-principles.md` — especially principle #5
  ("Skills flow through the semester")

---

## Role
You are a senior full-stack engineer building the
signature visualization for a course planning tool. This
view makes skill dependencies visible at a glance.

Read `CLAUDE.md` and `docs/design-principles.md` first.
Principle #5 is the north star for this feature.

If something is underspecified, make a reasonable default,
document it in `ASSUMPTIONS.md` (append), and proceed.

---

## Defaults (no kickoff questions)

- HTML/CSS implementation (flexbox/grid, colored divs).
  No D3, canvas, or SVG.
- Static view first. What-if integration is a stretch
  goal.
- Desktop-only layout. Horizontal scroll is fine.
- Proceed immediately after confirming prerequisites.

---

## PARALLEL SESSION NOTICE

This prompt runs in parallel with Phase 2B.1 (Coverage
Matrix and Content Views). To avoid merge conflicts:

**You own these files** — create and modify freely:
- `src/app/terms/[id]/flow/` (everything under this path)
- `src/components/flow/` (everything under this path)
- Any test files for your flow code

**Do NOT modify these files** — the parallel session owns
them:
- `src/lib/api-client.ts` (use existing methods only)
- `src/app/terms/[id]/page.tsx`
- `src/app/terms/[id]/coverage/page.tsx`
- `src/app/terms/[id]/assessments/page.tsx`
- `src/app/terms/[id]/impact/page.tsx`
- `src/app/terms/[id]/import/page.tsx`
- `src/components/WhatIfPanel.tsx`
- Any other existing files

**Using the API client:** Use the existing methods in
`api-client.ts` as-is. They already have everything you
need (modules, sessions, skills, coverages). Do NOT add
new methods to api-client.ts — if you need data shaped
differently, transform it in your own code after fetching.

**Nav link:** Do NOT add a "Flow View" link to the term
detail page. The parallel session will handle navigation.
Your page is directly accessible at `/terms/[id]/flow`.

---

## Context: What this view solves

Design principle #5: "A course is not a flat list of
sessions. It is a directed graph where skills are
introduced, practiced, and assessed across sessions in a
specific order."

The coverage matrix shows WHAT is covered but not HOW
skills progress. The calendar shows WHEN sessions happen
but not which skills flow between them. The flow view
bridges both — it shows skills as horizontal threads
weaving through sessions across the semester.

When a session is canceled, the instructor needs to see
at a glance: which threads break? This is the "visual/
flowchart feeling" the app is missing.

---

## Rules from prior phases (READ CAREFULLY)

a) **Use existing `api-client.ts` methods** — do NOT use
   raw `fetch()`. The typed client already has getModules,
   getSessions, getSkills, getCoverages. Import `api` from
   `@/lib/api-client`.

b) **Import types from `src/lib/api-client.ts`** — do NOT
   define local interface duplicates. Import `Module`,
   `Session`, `Skill`, `Coverage` from `@/lib/api-client`.

c) **Keep your code self-contained.** All flow-specific
   logic, components, and utilities go under your owned
   paths (`src/app/terms/[id]/flow/` and
   `src/components/flow/`). This is critical for clean
   parallel merges.

---

## What to build

### The Flow View

New page: `/terms/[id]/flow`

**Data model (derive from existing data):**

Fetch modules, sessions, skills, and coverages for the
term. Transform into a flow grid:

```
type FlowCell = {
  skillId: string;
  moduleId: string;
  sessionId: string | null;
  level: "introduced" | "practiced" | "assessed" | null;
  isCanceled: boolean;
};

type FlowRow = {
  skill: Skill;
  cells: FlowCell[]; // one per session column
};
```

This is a data transformation, not a new API. Do it
client-side after fetching.

**Layout — horizontal grid:**

- **Columns** = sessions, grouped by module. Modules flow
  left to right in sequence order. Within each module,
  sessions are ordered by sequence number (or date if
  available).
- **Column group headers** = module code + title, spanning
  all sessions in that module
- **Column headers** = session code (e.g., "Lec-05"),
  with type badge (lecture/lab) and date if available
- **Rows** = skills, grouped by category. Each row is one
  skill flowing across all sessions.
- **Row headers** = skill code (e.g., "LM04-C01") with
  category grouping labels
- **Cells** = coverage level indicator where that skill
  is covered in that session

**Cell visual encoding:**

- **Introduced**: yellow dot or small "I" badge
- **Practiced**: blue dot or "P" badge
- **Assessed**: green dot or "A" badge
- **No coverage**: empty cell (light gray background)
- **Canceled session column**: entire column gets a subtle
  red/pink background tint. Any coverage dots in that
  column get a strikethrough or dimmed treatment.

**Row visual encoding:**

- Skills with complete coverage (has at least I + P + A
  somewhere): subtle green left border on the row
- Skills with partial coverage: yellow left border
- Skills with NO coverage at all: red left border, and
  the row header shows "NOT COVERED" in small red text
- The gap rows (uncovered or partially covered) should be
  visually prominent — this is the primary information
  the view communicates.

**Column group visual encoding:**

- Module groups separated by a slightly thicker border or
  different background shade
- Module header row spans all columns in that module

**Interactions:**

- **Hover a row** (skill): highlight the entire row to
  trace that skill's journey across all sessions
- **Hover a column** (session): highlight the entire
  column to see all skills covered in that session
- **Click a cell with coverage**: show a small tooltip
  with skill name, level, session title. Include a
  "Remove" action to delete the coverage entry.
- **Click an empty cell**: show a small popover with
  three buttons (Introduced, Practiced, Assessed) to add
  coverage. Use `api.createCoverage()` for this.
- **Click a session header**: navigate to
  `/terms/[id]/sessions/[sessionId]` (or calendar view
  focused on that session). The page may not exist yet
  if 2B.1 hasn't been merged — that's fine, just set the
  href.
- **Click a skill row header**: navigate to the skills
  page filtered to that skill.

**Filtering:**

- **Category filter**: dropdown to show only skills in a
  specific category (reduces rows)
- **Module filter**: dropdown to show only columns from
  a specific module
- **"Show gaps only"** toggle: hide skills that have
  complete I+P+A coverage, leaving only partially or
  uncovered skills visible
- **"Show canceled"** toggle (default: on): when off,
  hide columns for canceled sessions

**Summary bar (above the grid):**

- Total skills / fully covered / partial / uncovered
  (same as coverage health, but here for context)
- Total sessions / scheduled / canceled
- "X skills at risk from cancellations" (skills that
  lost coverage due to canceled sessions)

---

### Stretch Goal: What-If Integration

Only build this if the core grid is working well and you
have time. This is NOT required for this phase.

If you do build it:
- Add a "Simulate" toggle/button
- When active, show a dropdown to pick a session to
  hypothetically cancel
- Use `simulateCancellation` from `src/domain/whatif.ts`
  (import the pure function) to compute impact
- Visually mark the simulated-canceled session's column
  with dashed red border (not solid — it's hypothetical)
- Show affected skill rows with a warning indicator
- Add a "Clear simulation" button to reset

The key constraint: simulation is READ-ONLY. It does not
persist anything. It's a visual overlay on the existing
grid.

---

## TDD requirements

**Domain/utility tests:**
- Flow data transformation: given modules, sessions,
  skills, and coverages, verify the FlowRow/FlowCell
  grid is assembled correctly
- Verify canceled sessions are flagged
- Verify skills with no coverage appear as empty rows
- Verify module grouping and ordering

Put test files alongside your code:
- `src/app/terms/[id]/flow/flow-utils.test.ts` or
  `src/components/flow/flow-data.test.ts`

**Component tests (if feasible):**
- Flow grid renders correct number of rows (all skills)
- Flow grid renders correct number of column groups
  (modules)
- Canceled session column has visual indicator
- Uncovered skill row has visual indicator

If scope must be cut: cut the stretch goal (what-if
integration) first, then interactions (hover/click).
Do NOT cut the core grid rendering or the data
transformation tests.

---

## Constraints

- **HTML/CSS only.** Use Tailwind CSS with flexbox or CSS
  grid. No D3, no SVG, no canvas, no charting library.
  The grid is a styled HTML table or CSS grid — that's
  fine. Get the data and layout right; visual polish
  comes later.
- **No new API routes.** All data is available via
  existing endpoints. Transform client-side.
- **No modifications to shared files.** Stay within your
  owned file paths.
- **Desktop-first.** Horizontal scroll for many sessions
  is expected and fine. Sticky row headers (skill names)
  so they're visible while scrolling.
- **Generic app** — nothing course-specific.
- **Mock AI only** — no real AI.

---

## Performance note

A term might have 40+ sessions and 60+ skills = 2400+
cells. The grid should:
- Use CSS grid or table layout (not individual positioned
  divs)
- Virtualize rows if rendering becomes slow (but try
  without first — 60 rows is usually fine)
- Memoize the data transformation (useMemo on the
  FlowRow array)
- Fetch data once on page load, not per-cell

---

## Definition of done

A reviewer can:
- Navigate to `/terms/[id]/flow` and see a grid with all
  skills as rows and all sessions (grouped by module) as
  columns
- See coverage level dots (I/P/A) in the correct cells
- See uncovered skills as prominent empty rows with red
  indicators
- See canceled sessions' columns visually marked
- Hover a row to highlight a skill's journey
- Hover a column to see all skills in a session
- Click an empty cell to add coverage
- Filter by category, module, or "gaps only"
- See the summary bar with health stats
- Run `npm test` with flow data transformation tests
  passing

---

## Operating rules
- Read `CLAUDE.md` first.
- Do not ask for permission to create files; just do it.
- Keep ALL your code under `src/app/terms/[id]/flow/` and
  `src/components/flow/`. This is non-negotiable for the
  parallel merge.
- Avoid overengineering. The grid does NOT need to be
  beautiful. Correct data and readable layout matter.
- Prefer small, focused commits with clear messages.
- If you hit ambiguity, choose a default, record it in
  `ASSUMPTIONS.md`, proceed.
- Append to existing docs — don't overwrite.
- Update `docs/phase-roadmap.md` when done (append a
  "Phase 2B.2" section, do not modify 2B.1's section).

---

## Start now
Begin by:
1) Confirming Phase 2A features and data are present.
2) Summarizing the scope you will deliver (1 paragraph).
3) Writing the flow data transformation function and its
   tests FIRST, before any UI code.
