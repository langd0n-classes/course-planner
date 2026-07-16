# Course Planner B.4 kickoff handoff

Date: 2026-07-15
Prepared by: AICP orchestrator session, for a dedicated course-planner session.

## Why this exists

B.3 is complete, accepted, and promoted. B.4 (#34) is now unblocked. This handoff
lets a fresh course-planner session start B.4 warm instead of re-deriving the B.3
state. Run that session **in `~/loc-projects/course-planner` on Sonnet** to keep
context lean and conserve Opus.

## Current state (verified 2026-07-15)

- `redesign` is at `39d1e15` ("Record B.3 checkpoint acceptance"), having absorbed
  all of B.2, B.2R, and B.3 in one gate promotion. It had previously sat at the B.1
  gate (`703ecdf`).
- B.3 checkpoint: `docs/plans/course-planner-b3-checkpoint-2026-07-15.md`, status
  accepted. All B.3 handlers exist and are green under the container gate (51 test
  files / 522 tests, `tsc` + `next build` clean).
- `redesign-b3-integration` currently equals `redesign` and can be retired.
- Branch **B.4 work off `redesign`**, not off `redesign-b3-integration`.

## What B.4 is (issue #34)

Replace the transitional Topic-led workspace with a dense Activity-first **Course
design studio** plus a first-viewport **active-Term daily driver**, on the real B.3
handlers (no mock-only path where a real handler exists). #34 already carries a
`## BUILD PROMPT` comment and a full acceptance-task + quality-criteria spec — start
there; do not re-invent it.

## Read first (in order)

1. Issue #34 body + its `## BUILD PROMPT` comment.
2. `docs/design-principles.md` (workspace-not-data-entry; the UI quality bar).
3. `docs/decisions/0002-*` and `0003-*` (activity-first graph; pin-design/revise-delivery).
4. `docs/plans/course-planner-b2r-checkpoint-2026-07-14.md` — the accepted interaction
   hierarchy: **Course design first → Term planning → active-Term Run daily driver**;
   the design board moves Activity cards among Learning Modules; Topic flow is edited
   on those Activities, not by dropping Topic cards into modules.
5. The accepted coded prototype on branch `redesign-b2r-ux-prototype` (dense studio +
   active-Term task prototype) — prior art to build on, not to ship verbatim.

## Reconcile these three B.3 design notes as you build the UI

From the B.3 checkpoint (non-blocking, but the studio/daily-driver touch them):
1. Term Activity routes use the canonical frozen names (`terms/[id]/adoption-preview`
   / `-apply`, `term-activities/[id]/revision-preview` / `-apply`).
2. Calendar events/periods are created through the calendar version, not standalone
   collection routes.
3. Activity LM-scope is served at `activity-versions/[id]/lm-scope`; confirm whether
   it should be identity-scoped when you wire the design board's module assignment.

## Suggested slicing (confirm before firing)

#34's 8 acceptance tasks cluster into reviewable packets, e.g.:
- **Studio shell + Course/Topic authoring** (tasks 1–2): arrive-in-workspace, dense
  ~150-Topic editor, keyboard Topic-code suggestions.
- **Activity Types + design board** (tasks 3–4): Instructor Activity Types, label-vs-
  behavior-family, pointer+keyboard move among LM / Unassigned / Cross-cutting.
- **Topic actions + cross-cutting projects** (tasks 5–6): I/P/A with repeat-warning
  navigation; multi-milestone project with meeting links + exact due time.
- **Term calendar UX** (task 7): create Term from Institution calendar, inspect
  breaks/finals, Term-only exception via preview/apply.
- **Active-Term daily driver** (task 8): first-viewport "what's next / prepare /
  covering / changed-from-plan," usable at a narrow (~430px) width.

## Execution conventions (unchanged from B.3)

- Worktree per packet off `redesign`: `../wt/<slug>` sibling pattern.
- **Host Prisma segfaults** (glibc 2.42) — run the toolchain (prisma generate,
  migrate, seed, DB tests) in a `node:22-bookworm` Podman container, repo bind-mounted.
  Definitive gate = container `prisma generate` + `tsc --noEmit` + `vitest run` +
  `next build`.
- Delegate builds to **Codex** (`launch_codex_bg.sh --local`, `--sandbox
  workspace-write`, no network, `--prompt-file`) to conserve Claude/Opus usage.
  Model per job: `gpt-5.4` for straightforward UI packets, `gpt-5.5` for the
  judgment-heavy studio/daily-driver design work. Hardlink `node_modules`
  (`cp -al`) from an existing worktree at the same commit to skip host install.
- Browser gate: B.4 quality criteria require real-browser (Playwright) tests on the
  sanitized exemplar fixture — this is new vs. B.3's mocked-DB unit tests.
- Coordinator commits with the bot gitconfig + AI-attribution trailers; integrate
  into a B.4 integration branch; clean up worktrees/branches after each packet.
- B.4 is the **last redesign phase before the redesign→main cutover**, which is
  explicitly out of scope for #34.
