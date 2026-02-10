# Claude Code Instructions

Read these files before doing any work in this repo:

## Required reading (in order)

1. `docs/design-principles.md` — Core design philosophy.
   This is the most important document. Every feature
   decision should be checked against these principles.

2. `docs/phase-roadmap.md` — What's been built, what's
   next, and why that order.

3. `ARCHITECTURE.md` — System design and directory
   structure.

4. `ASSUMPTIONS.md` — Decisions made where requirements
   were underspecified. Append to this file when making
   new assumptions; do not overwrite prior entries.

## Key rules

- **Generic app.** This is a course planning tool for any
  course at any institution. Nothing course-specific or
  institution-specific should be hardcoded. The files in
  `docs/ds100-exemplar/` are reference data showing the
  complexity level the app must handle — they are NOT the
  app's content.

- **Workspace, not data entry.** The app is the
  instructor's primary workspace, not a form that produces
  downloads. See `docs/design-principles.md` for details.

- **Mock AI is intentional.** The `MockAiPlanner` service
  is the current AI implementation. Do not add real AI
  provider integrations unless explicitly asked. Mock
  responses should look realistic so the UX can be
  designed properly.

- **TDD.** Write tests first for domain logic and API
  routes. If scope must be cut, cut UI polish before
  tests.

- **Extend, don't restructure.** Add fields and models to
  the Prisma schema as needed. Do not rename or remove
  existing models/fields that are working unless there is
  a clear reason.

## Build prompts

When working from a build prompt in `docs/prompts/`, treat
it as the task specification.

**Completed:**
1. `claude_code_web_mvp_build_prompt.md` — Phase 1
2. `phase2a_import_calendar_whatif.md` — Phase 2A pass 1
3. `phase2a3_redistribution_and_polish.md` — Phase 2A pass 2

**Current (run in parallel):**
4. `phase2b1_matrix_and_views.md` — Coverage matrix +
   content views
5. `phase2b2_flow_visualization.md` — Skill flow grid

**Planned:**
6. Exports prompt (Phase 2C) — not yet written

**Archived:**
- `phase2b_views_flow_workspace.md` — original monolithic
  2B prompt, superseded by the 2B.1/2B.2 split

## Lessons from prior phases

These patterns caused bugs and rework. Follow them:

- **Always use `src/lib/api-client.ts`** for API calls.
  Never raw `fetch()` in page/component files.
- **Import types from `api-client.ts`**. Never define
  local interface duplicates in page files.
- **Wire parameters end-to-end**: Zod schema → handler →
  api-client.ts → UI component. Don't leave gaps.
- **E2E tests must import real data** before testing UI.
- **Extract shared UI into `src/components/`** instead of
  duplicating across pages.

## Conventions

- Commit messages: imperative mood, concise, explain why
- Append to `ASSUMPTIONS.md` when making design decisions
- Append to `ARCHITECTURE.md` when adding new subsystems
- Keep `docs/phase-roadmap.md` updated as phases complete
