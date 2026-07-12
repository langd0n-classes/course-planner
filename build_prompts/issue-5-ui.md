## BUILD PROMPT

## Course Planner — Phase 2B.2: Skill Flow Visualization (UI pass)

The data transformation layer for the flow view is already complete.
Your job is to build the UI on top of it.

Read `CLAUDE.md` first. Then read:
- `src/app/terms/[id]/flow/flow-utils.ts` — the complete data types and
  `buildFlowData()` function you will consume
- `src/app/terms/[id]/flow/flow-utils.test.ts` — to understand the data shape
- `src/components/` — shared components available to you:
  `CoverageBadge`, `Breadcrumbs`, `StatusBadge`, `LoadingSkeleton`, `Toast`
- `src/app/terms/[id]/page.tsx` — to understand how to add a nav link

Do NOT modify `flow-utils.ts` or `flow-utils.test.ts`.

---

## What to build

### 1. Page: `src/app/terms/[id]/flow/page.tsx`

Fetch all data for the term, call `buildFlowData()`, render the grid.

```ts
// Data fetching (client component, use api.* methods):
const [modules, sessions, skills, coverages] = await Promise.all([
  api.getModules(termId),
  api.getSessions({ termId }),
  api.getSkills(termId),
  api.getCoverages({ termId }),
]);
const flowData = buildFlowData({ modules, sessions, skills, coverages });
```

Show `<LoadingSkeleton />` while loading.

### 2. Grid: `src/components/flow/FlowGrid.tsx`

Props: `{ data: FlowData, onAddCoverage, onRemoveCoverage }`

Layout — HTML table or CSS grid (Tailwind only, no libraries):
- **Column group headers** (row 1): module code+title spanning all sessions in that module
- **Column headers** (row 2): session code, type badge, date if available. Canceled columns get pink/red tint.
- **Row headers**: skill code + name. Left border color = coverageStatus: green=complete, yellow=partial, red=none. Uncovered rows show "NOT COVERED" in small red text.
- **Cells**: coverage level badges (I/P/A) where covered. Empty cells are light gray. Canceled column cells are dimmed.

Sticky row headers (skill names) so they stay visible on horizontal scroll.

**Hover behavior (CSS only — no JS state needed):**
- `hover:bg-yellow-50` on rows via Tailwind group/peer
- `hover:bg-blue-50` on columns via CSS (use `group` on `<col>` or column class)

**Click — empty cell:** small popover with I / P / A buttons → calls `onAddCoverage(skillId, sessionId, level)`

**Click — filled cell:** tooltip showing skill+level+session. "Remove" button → calls `onRemoveCoverage(coverageId)`

Use `api.createCoverage()` and `api.deleteCoverage()` for mutations. Refetch after mutation.

### 3. Summary bar: `src/components/flow/FlowSummary.tsx`

Props: `{ summary: FlowSummary }`

One line above the grid:
```
12 skills: 8 fully covered · 3 partial · 1 uncovered   |   18 sessions: 16 scheduled · 2 canceled   |   2 skills at risk
```

### 4. Filters: `src/components/flow/FlowFilters.tsx`

Props: `{ categories, modules, onChange }`

Filter state (local React state in page):
- Category dropdown (all / per category)
- Module dropdown (all / per module)
- "Gaps only" toggle — hides complete rows
- "Show canceled" toggle (default: on) — hides canceled columns

Pass filtered data into `<FlowGrid />`. Filter client-side from the full `FlowData`.

### 5. Nav link

Add a "Flow View" link to the term detail page (`src/app/terms/[id]/page.tsx`) alongside existing tabs/links.

---

## Definition of done

- `/terms/[id]/flow` renders: summary bar, filters, grid with all skills as rows and sessions grouped by module as columns
- Coverage level badges appear in correct cells
- Uncovered skill rows have red left border + "NOT COVERED" label
- Canceled session columns are visually tinted
- Category/module/gaps-only/show-canceled filters work
- Click empty cell → add coverage (persists on refetch)
- Click filled cell → remove coverage (persists on refetch)
- Nav link from term detail page works
- `npm test` passes (do not break existing tests)
- Commit, push to `feat/5-skill-flow-visualization`, open PR against `main` referencing issue #5
- Post a comment on issue #5 with the PR URL

---

## Constraints
- Tailwind CSS only. No D3, SVG, canvas, charting libraries.
- No new API routes — all data via existing `api.*` methods.
- Desktop-first. Horizontal scroll is expected and fine.
- If scope must be cut: cut hover CSS polish first, then click-to-remove, then click-to-add. Do NOT cut the grid rendering, filters, or summary bar.
- Generic app — nothing course-specific.
