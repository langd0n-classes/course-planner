# Course Planner — Operating Guidance (OPS)

This is the canonical instruction file for the repo. `CLAUDE.md` and `AGENTS.md`
are thin entrypoints that both redirect here — edit rules in **this** file.

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

## Local environment & known issues

- **Containers: use `podman`, not `docker`.** The operator's machines run
  `podman` / `podman-compose` (there is no `docker` binary). Use `podman`,
  `podman-compose`, or `podman run` to bring up the Postgres dev container.
  `docker` / `docker compose` fail with "command not found." The compose file's
  `DATABASE_URL` uses host `db` (container-to-container); when running the
  toolchain from the host, connect via `localhost:5432` instead.

- **`prisma` segfaults on the host — run it in a container (KNOWN ISSUE).**
  On the current host (Fedora, glibc 2.42 / OpenSSL 3.5.x) prisma's prebuilt
  native engine binaries SIGSEGV — even `prisma -v` core-dumps, in or out of any
  sandbox. **This is the environment, not your bug.** Until the host install is
  fixed, run the prisma/node toolchain (`prisma migrate`, `generate`, `db seed`,
  `prisma format`, tests that touch the DB) **inside a container** with a stable
  base image (e.g. `node:22-bookworm`, glibc 2.36) — repo bind-mounted, networked
  to the Postgres container. Do not spend turns retrying prisma on the host.
  The repo's `db:*` npm scripts (`npm run db:migrate`, `db:seed`, `db:reset`,
  `db:generate`) all shell out to `npx prisma`, so run **those** inside the
  container too, not on the host.

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
  a clear reason. (The redesign effort on the `redesign`
  branch is the deliberate exception — see
  `docs/plans/course-lm-topic-redesign-v2.md`.)

## Build prompts

Build prompts live as comments on GitHub issues, not as
files in the repo. Each issue tracks one unit of work:
the issue body has scope and acceptance criteria, the
first comment has the full CCW build prompt, and
subsequent comments capture prompt revisions, review
notes, and lessons learned. The issue is closed when
the work ships.

**To read an issue and its build prompt:**

First, check if `gh` works: `gh auth status`. If it does,
use `gh api` directly (see commands below). If `gh` is
missing or auth fails (common in remote/sandboxed envs):

```bash
source scripts/gh-access-remote.sh
```

This installs `gh` without sudo, authenticates using
`GH_TOKEN`, and provides a `gh-issue` helper:

```bash
gh-issue <number>              # issue body
gh-issue <number> --prompt     # latest BUILD PROMPT comment
gh-issue <number> --comments   # all comments
```

If `gh` is already working, you can use `gh api` directly:

```bash
gh api repos/langd0n-classes/course-planner/issues/<number> --jq '.body'
gh api repos/langd0n-classes/course-planner/issues/<number>/comments \
  --jq '[.[] | select(.body | startswith("## BUILD PROMPT"))] | last | .body'
```

**IMPORTANT:** Do NOT use `gh issue view` — it has a
known GraphQL bug with GitHub Projects Classic that causes
failures. Always use `gh api` (REST) instead.

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
- #18 — Redesign Phase A: schema + revision subsystem + REST contract freeze

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

## Commit attribution (agent commits)

Agent commits combine three things — all three on every attributable commit:

1. **Author = `langdon-bot`.** Include the bot gitconfig; do NOT set it globally:
   `git -c include.path=~/loc-resources/auth/langdon-bot.gitconfig commit …`
2. **Trailer block** at the end of the commit body:
   ```
   AI-Attribution: <AI-A|AI-E|AI-C|AI-G>  (https://langd0n.com/ai-attribution)
   Co-authored-by: langdon <1832177+langdon@users.noreply.github.com>
   Co-Authored-By: <PARENT-AGENT> / Claude <model> <noreply@anthropic.com>
   ```
   - `<PARENT-AGENT>` = the orchestrator that produced the work (e.g. `AICP`, or
     the parent agent's name). Mandatory so AI commits trace back to their source.
   - `<model>` = the actual model (e.g. `Claude Opus 4.8`).
   - `AI-Attribution` level per the framework — default `AI-G` for autonomous
     runs, `AI-C` for interactive human-directed sessions.
   - **Do NOT append a `Claude-Session:` link** — it leaks an internal session
     identifier into public history for no benefit.
3. Minimal/mechanical edits (typo, format) need no attribution trailers.
- Stage explicit paths; never `git add -A` / `git add .`. Check `git status`
  before committing.
