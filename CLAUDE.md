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

Build prompts live as comments on GitHub issues, not as
files in the repo. Each issue tracks one unit of work:
the issue body has scope and acceptance criteria, the
first comment has the full CCW build prompt, and
subsequent comments capture prompt revisions, review
notes, and lessons learned. The issue is closed when
the work ships.

**To read an issue and its build prompt**, run this first:

```bash
source scripts/gh-access-remote.sh
```

This handles everything: installs `gh` without sudo if
needed, authenticates using `GH_TOKEN`, and provides a
`gh-issue` helper. Then:

```bash
gh-issue <number>              # issue body
gh-issue <number> --prompt     # latest BUILD PROMPT comment
gh-issue <number> --comments   # all comments
```

**Requires:** `GH_TOKEN` env var set in Claude Code
project environment variables. The script checks both
`GH_TOKEN` and `GITHUB_TOKEN`.

**IMPORTANT:** Do NOT use `gh issue view` — it has a
known GraphQL bug with GitHub Projects Classic that causes
failures. The script uses `gh api` (REST) which works
reliably, with a `curl` + `python3` fallback if `gh`
install fails.

**To find the build prompt:** look for the most recent
comment that starts with `## BUILD PROMPT`. Every prompt
comment uses this header. If there are multiple (prompt
was revised), use the LAST one — it supersedes earlier
versions. `gh-issue <number> --prompt` does this
automatically.

Follow the prompt as your task specification. Link the
resulting PR back to the issue.

**To revise a prompt:** add a NEW comment on the issue
starting with `## BUILD PROMPT` (with an optional version
like `## BUILD PROMPT v2`). Don't edit the original —
keep the history. Add a brief note at the top of the new
comment explaining what changed from the prior version.

**Updating long comments via `gh api`:** The `--input`
and `-F body=@file` flags URL-encode the body, which hits
HTTP 414 (Request-URL Too Long) on prompt-sized comments.
Use a shell variable instead:

```bash
BODY=$(cat prompt.md)
gh api repos/langd0n-classes/course-planner/issues/comments/<id> \
  -X PATCH -f body="$BODY"
```

**Historical prompts** from earlier phases are in
`docs/prompts/` for reference. New work should use
issues, not new prompt files.

**Current issues:**
- #4 — Phase 2B.1: Coverage Matrix + Content Views
- #5 — Phase 2B.2: Skill Flow Visualization
- #6 — Phase 2C: External-System Exports (planned)

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
