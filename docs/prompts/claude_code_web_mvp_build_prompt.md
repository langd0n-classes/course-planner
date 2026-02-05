# claude_code_web_mvp_build_prompt.md

## Prompt Name
Course Planner — Claude Code Web “Build the MVP” (TDD + Pluggable APIs)

## How to use
1) Create a fresh repo (or open your target repo).
2) Upload / attach the provided project files (the brief + requirements + any other context docs).
3) Paste this entire prompt into Claude Code Web.
4) Answer the initial kickoff questions, then let it run.

---

## Role
You are a senior full‑stack engineer acting as a delivery-focused implementer.

Your job is to produce a working MVP that satisfies the spirit of the requirements. If something is underspecified, make a reasonable default, document it in an `ASSUMPTIONS.md`, and proceed.

You must work test-first (TDD) and design external integrations behind pluggable interfaces with test mocks.

---

## Inputs (already attached)
- `course-planner-research-brief.md`
- `course-planner-requirements.md`
- (optional) any viability/landscape PDF(s) attached for context only

Treat these as the source of truth. Do not invent extra “requirements” that aren’t implied.

---

## Primary outcome
A runnable web application MVP that models:
- Terms
- Modules
- Skills
- Sessions
- Coverage (introduced / practiced / assessed)
- Assessments
- Basic “change impact” views (at least: when a session changes, show impacted skills and coverage rows)

MVP means:
- CRUD works
- Core views exist
- Tests exist and run in CI
- External services are abstracted and mocked

Missing polish is acceptable. Missing core capabilities is not.

---

## Kickoff questions (ask once, then continue)
Ask me these questions at the start in a single message. After I answer, do not ask more unless you are blocked.

1) Repo/setup
- Should this be a monorepo (single app) or separate frontend/backend? (default: monorepo)
- Preferred license text? (default: AGPL-3.0-or-later)

2) Storage
- Postgres OK? (default: yes, via Docker)
- OK to ship with a simple seed dataset for demo? (default: yes)

3) Auth
- Is authentication required for MVP? (default: no auth; single-user local dev)

4) AI integration
- Which AI provider should be wired first behind an adapter? (default: “none wired”, just stub + mock + interface)
- If provider is desired, ask for: API name (OpenAI/Anthropic/etc.) and env var key.

5) Export pipelines
- Which single export should we implement first? (default: iCal export of sessions)
  Options: iCal | CSV export of coverage matrix | “artifact export stubs only”

If I don’t answer within a reasonable time, proceed with defaults listed above.

---

## Technical choices (defaults unless user overrides)
- App: Next.js (App Router) + TypeScript
- UI: simple component library or minimal Tailwind (no design bikeshedding)
- DB: Postgres
- ORM/migrations: Prisma
- Validation: zod
- Unit/integration tests: Vitest
- E2E smoke tests: Playwright (minimal, 1–2 flows)
- Local dev orchestration: Docker Compose
- Lint/format: eslint + prettier
- CI: GitHub Actions running typecheck + unit tests (+ optional e2e)

If you prefer a different stack, propose it briefly with tradeoffs, but do not stall.

---

## Architecture constraints (important)
1) External services must be behind interfaces
Create `src/services/` with “ports and adapters” style boundaries:
- `AiPlanner` interface (mocked in tests)
- `CalendarExporter` interface
- Any future “ArtifactGenerator” interface (stub only)

2) Mock-first for services
Provide:
- `src/services/mocks/*` mock implementations used in tests and local dev
- `src/services/real/*` real implementations (optional for MVP; at least stubs)

3) Keep domain rules testable
Implement invariants from the requirements as pure functions where possible:
- introduced before practiced before assessed
- assessed after practiced
- GAIE progression ordering (only if GAIEs are included in seeded assessment types)
Write unit tests for these rules.

---

## What to build (MVP scope)
### A) Data model (must match requirements doc closely)
Implement Prisma schema for:
- Term
- Module
- Skill
- Session
- Coverage
- Assessment
- Artifact (can be stubbed if you need to keep scope tight, but include table + minimal CRUD if feasible)

Use enums for:
- SessionType: lecture | lab
- CoverageLevel: introduced | practiced | assessed
- AssessmentType: gaie | assignment | exam | project (as per requirements)
- ArtifactType: notebook | handout | slides | ta-key | other
- ParentType for Artifact: session | assessment | module

### B) Core screens / user flows
1) Term list + “Create term”
2) Term detail page with:
- Modules list + create/edit
- Sessions list (sortable) + create/edit
- Calendar-ish view (MVP): a weekly list grouped by date is OK
- “Move session date” action (form-based is fine; drag/drop optional)
3) Coverage matrix view:
- Filter by module and/or session type
- Table: skills as rows, sessions as columns (MVP can be simplified: show coverage rows in a list with filters if full matrix is too heavy)
4) Impact view:
- When a session date/module changes: show impacted coverage + skills (simple diff view is fine)
5) Assessment list + create/edit:
- Link to skills assessed
- Due date

### C) Import/clone features (MVP-lite)
- “Clone term” action:
  - Clone modules/sessions/coverage/assessments into a new term
  - Keep skills either global or term-scoped per `is_global`
  - Document your approach clearly

### D) Export (pick one)
Default: iCal export of sessions for a term (download `.ics`).
Keep behind `CalendarExporter` interface with a mock.

---

## TDD workflow requirement
You must use a red-green-refactor cadence.

Minimum test coverage expectations:
- Domain rules unit tests (invariants)
- Repository/service tests for clone term
- API route tests for at least: creating term, moving session date, creating coverage
- One Playwright smoke test: create term → add module → add session → add skill + coverage → verify appears in coverage view

If you need to reduce scope, reduce UI polish first, not tests.

---

## Implementation plan (follow this order)
1) Repo scaffolding + tooling
- nextjs + ts + lint + prettier
- docker compose for postgres
- prisma migrations
- vitest config

2) Domain model + invariants
- prisma schema
- pure functions enforcing rules + tests

3) Basic CRUD pages + API routes
- Terms, Modules, Skills, Sessions, Coverage, Assessments

4) Coverage view + impact view
- Focus on correctness over UI aesthetics

5) Term cloning
- Implement + tests

6) Export
- iCal export behind interface + tests

7) Polish
- minimal empty states, helpful error messages, seed data

---

## Definition of done
A reviewer can:
- `docker compose up` (db) then `npm install && npm run dev`
- create a term, add modules/sessions/skills/coverage/assessments
- move a session and see a clear “impact” readout
- clone a term and see copied structure
- run `npm test` successfully
- run `npm run e2e` (if included) successfully
- export (e.g., iCal) for a term

---

## Documentation deliverables
Create these files:
- `README.md` (setup, dev commands, env vars)
- `ASSUMPTIONS.md` (explicit defaults taken where underspecified)
- `ARCHITECTURE.md` (high-level diagram in text + services/interfaces)
- `TESTING.md` (how tests are organized, how to run)
- `ROADMAP.md` (next features beyond MVP)

---

## Operating rules
- Do not ask for permission to create files; just do it.
- Avoid overengineering. Prefer simple, readable solutions.
- Prefer small PR-sized commits with clear messages.
- If you hit ambiguity, choose a default, record it in `ASSUMPTIONS.md`, proceed.
- If a requirement conflicts with your chosen stack, explain briefly and implement the closest equivalent.

---

## Start now
Begin by:
1) Summarizing the MVP scope you will deliver (1 short paragraph).
2) Listing the defaults you will assume (bullet list).
3) Asking the kickoff questions.
4) After answers (or defaults), start implementing immediately.
