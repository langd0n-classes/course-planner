# ADR-0001: Recover Phase B through an instructor-approved vertical slice

- **Status:** accepted
- **Date:** 2026-07-13
- **Deciders:** Langdon White, course-planner coordinator (Mimir review)

## Context

Phase B produced three independently validated lanes for planning/domain APIs,
packages/materials, and workspace UI. Their combined branch passed migrations,
seed, typecheck, tests, lint, and build, but product, UX, architecture, and
academic-practice reviews rejected the merge gate. The lanes did not yet form a
real instructor workflow: the UI remained mock-backed, the academic calendar was
metadata rather than the scheduling container, cloning could confuse planned and
delivered history, and archive/package behavior could lose evidence.

This complexity serves a **product outcome** first: Course Planner must become the
operator's dependable course-creation and live-course workspace. The multi-agent
build remains a useful learning and publishing experiment, but that does not excuse
merging components that do not yet solve the instructor's own operational problem.

## Options considered

1. **Merge the three lanes and repair integration later** — preserves visible
   progress but promotes temporary mocks and incomplete invariants into the base.
2. **Discard Phase B and restart as one vertical implementation** — removes
   integration debt but wastes validated domain, package, and UI components.
3. **Keep the lanes draft and add a bounded Phase B.1 recovery slice** — preserves
   the useful work while requiring one real end-to-end instructor path before merge.

For clone and calendar behavior, the recovery slice also considered silently
choosing source versions/materialization versus requiring instructor-visible
preview and choice.

## Decision

Keep PRs #26, #27, and #28 draft and unmerged until a bounded Phase B.1 recovery
slice passes the combined gate.

Phase B.1 will:

- replace the direct mock dependency with a real API adapter and complete the
  Course/Institution/LearningModule/Topic handlers needed by the workspace;
- make Term creation a mandatory calendar preview followed by explicit apply and
  CalendarSlot materialization;
- clone each Learning Module with an explicit planned-versus-delivered choice,
  defaulting to the source delivered version as the new planned pin while always
  starting the new delivered pointer as null;
- restore archive-first historical evidence and make lossless-package claims match
  the payload actually preserved; and
- produce a coded active-Term cockpit spike against realistic data and real handlers.

After B.1, the first operations extension will be a generic linked
action/communication record before specialized grading, accommodation, staffing,
or messaging models.

The eventual Collegium/Pantheon layer is advisory. It may produce evidence-backed
recommendations and proposed commissions, but instructor approval is the boundary
for curriculum mutation, scheduling, communication, grading, and accommodations.

## Why

The parallel lanes proved their local contracts, but local correctness is not the
same thing as product completeness. A walking vertical slice forces the seams to
become executable: real persistence, real calendar materialization, real error and
concurrency behavior, and an interface an instructor can actually use.

The clone default uses delivered content because the prior delivery is normally the
best available evidence of what worked. The per-Learning-Module choice preserves
instructor judgment when a delivered divergence was an emergency workaround rather
than an improvement. Clearing the new delivered pointer preserves the elementary
truth that the new Term has not happened yet.

Mandatory calendar preview is appropriate because holiday, break, meeting-role, and
short-Term conflicts are exactly where silent automation becomes expensive. This is
not a place to save one click by inventing three later cleanup workflows.

The generic action/communication record creates one small operational spine without
prematurely modeling every institutional process. Revisit that choice when two or
more specialized workflows demonstrate materially different lifecycle, privacy, or
authorization needs.

Revisit the recovery-slice decision only if the product ceases to target live-course
operation, or if a future adapter can prove the same end-to-end invariants without a
single integrated workspace path. Revisit clone defaults if instructor usage shows
planned versions are selected more often than delivered versions.

## Consequences

- The Phase B PRs remain reviewable and their work is preserved, but none can be
  presented as a completed product phase yet.
- Phase B.1 is deliberately serial at the integration seam even if bounded pieces
  are delegated in parallel.
- Calendar preview/apply and clone source choice become public product concepts and
  require stable DTOs, tests, and UI states.
- The UX spike happens against executable seams, so visual choices cannot hide
  missing workflows behind static mocks.
- Collegium/Pantheon integration will require an explicit recommendation/approval
  protocol rather than direct database authority.
