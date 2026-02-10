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

**To read an issue:** use `gh issue view <number> --comments`
to get the issue body and all comments. If `gh` is not
available, install it or fall back to the GitHub API:

```bash
# Option 1: install gh (preferred)
(type -p gh > /dev/null) || \
  (curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && sudo apt update && sudo apt install gh -y)

# Option 2: curl fallback (if gh install fails)
# Read issue body:
curl -s -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/langd0n-classes/course-planner/issues/4 \
  | jq -r .body
# Read comments (first comment = build prompt):
curl -s -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/langd0n-classes/course-planner/issues/4/comments \
  | jq -r '.[0].body'
```

**To find the build prompt:** look for the most recent
comment that starts with `## BUILD PROMPT`. Every prompt
comment uses this header. If there are multiple (prompt
was revised), use the LAST one — it supersedes earlier
versions. You can find it programmatically:

```bash
# With gh:
gh issue view <number> --comments --json comments \
  --jq '.comments | map(select(.body | startswith("## BUILD PROMPT"))) | last | .body'

# With curl:
curl -s -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/langd0n-classes/course-planner/issues/<number>/comments \
  | jq -r '[.[] | select(.body | startswith("## BUILD PROMPT"))] | last | .body'
```

Follow the prompt as your task specification. Link the
resulting PR back to the issue.

**To revise a prompt:** add a NEW comment on the issue
starting with `## BUILD PROMPT` (with an optional version
like `## BUILD PROMPT v2`). Don't edit the original —
keep the history. Add a brief note at the top of the new
comment explaining what changed from the prior version.

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
