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
it as the task specification. The prompts are sequential:

1. `claude_code_web_mvp_build_prompt.md` — Phase 1 (done)
2. `phase2a_import_calendar_whatif.md` — Phase 2A (next)
3. `phase2b_views_flow_workspace.md` — Phase 2B (after 2A)

## Conventions

- Commit messages: imperative mood, concise, explain why
- Append to `ASSUMPTIONS.md` when making design decisions
- Append to `ARCHITECTURE.md` when adding new subsystems
- Keep `docs/phase-roadmap.md` updated as phases complete
