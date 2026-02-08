# phase2a_import_calendar_whatif.md

## Prompt Name
Course Planner — Phase 2A: Import, Calendar, What-If
(Sequential prerequisite for Phase 2B)

## How to use
1) Open the course-planner repo in Claude Code Web.
2) Ensure PR #1 (MVP) is merged to main.
3) Paste this entire prompt into Claude Code Web.
4) Answer the kickoff questions, then let it run.

## Prerequisite
Phase 1 (MVP) must be merged. The app should have working
CRUD for Terms, Modules, Sessions, Skills, Coverage, and
Assessments, plus domain validation logic and mock services.

---

## Role
You are a senior full-stack engineer continuing work on an
existing codebase. You are extending a working MVP into a
usable planning workspace.

Your job is to make this app usable for real course planning.
If something is underspecified, make a reasonable default,
document it in `ASSUMPTIONS.md` (append, don't overwrite),
and proceed.

Work test-first (TDD). Keep external integrations behind
pluggable interfaces with mocks.

---

## Inputs (already in the repo)

Study these before writing any code:

**Exemplar course data** (`docs/ds100-exemplar/`):
Read `docs/ds100-exemplar/README.md` first. Then study:
- `ds100_skills_canonical.md` — 46+ skills organized by
  learning module with codes, categories, descriptions
- `ds100_schedule_instructor.md` — 27 lectures + 13 labs
  with dates, module alignment. Note: some lectures are
  already marked canceled with consolidation notes
- `lm-03-overview.md`, `lm-05-overview.md` — module
  overviews showing structure and detail level
- `lec-05-programming-basics.md`,
  `lab-05-histogram-interpretation.md` — session
  descriptions showing lecture/lab detail level
- `gaie-adaptation-index.md` — 15 assessments with
  progression stages (copy-paste/modify/write-own)
- `academic-calendar-2025-2027.md` — machine-readable
  academic calendar with class days, holidays, finals
- `extract_blackboard.py` — example external-system export

**Existing requirements and architecture:**
- `docs/course-planner-requirements.md`
- `ARCHITECTURE.md`, `ASSUMPTIONS.md`
- `prisma/schema.prisma` (current data model)
- `src/domain/coverage-rules.ts` (current domain logic)
- `src/services/interfaces/` (current service contracts)

---

## Design principle (IMPORTANT — read carefully)

**The app IS the workspace, not a data entry form.**

Everything an instructor needs should be visible in the UI:
term summaries, skill coverage, session details, module
overviews. The instructor should plan, analyze, and reason
about their course inside this app.

**Exports are NOT a goal.** They are a fallback for when
we haven't built the in-app experience yet. The only true
exports are artifacts that feed external systems that we
cannot replace (e.g., a `.docx` for Blackboard import, a
formatted prompt for GenAI content generation outside the
system). Do not build "download as markdown" features for
things that should just be visible in the UI.

Eventually this tool should be where instructors build
assignments, write lecture plans, reference past semesters,
and reason about course structure. We're not there yet, but
every decision should move toward that vision, not away
from it.

---

## Kickoff questions (ask once, then continue)

Ask these in a single message. After I answer, do not ask
more unless you are blocked.

1) The exemplar files are from a real course. Have you read
   them and do you understand the data structures (skills
   taxonomy, schedule format, module overview format)?

2) For the calendar view, the term's `meetingPattern` field
   currently stores which days of the week the class meets.
   Is that sufficient, or should we also model the time of
   day (e.g., "TTh 2:00-3:15")? (default: days only, no
   time of day for MVP)

3) For the what-if panel, should it be a side drawer that
   overlays the calendar view, or a separate page?
   (default: collapsible side drawer on calendar + term
   detail views)

If I don't answer within a reasonable time, proceed with
defaults.

---

## What to build (in this order)

### A) Schema Extensions

Extend the Prisma schema. Do not restructure existing
models that are working.

**Session model — add:**
- `status` enum: `scheduled | canceled | moved`
  (default: `scheduled`)
- `canceledAt` (DateTime, nullable)
- `canceledReason` (String, nullable)

**Coverage model — add:**
- `redistributedFrom` (UUID, nullable) — points to the
  canceled Session this coverage was moved from
- `redistributedAt` (DateTime, nullable)

**New model — CalendarSlot:**
- `id` (UUID)
- `termId` (FK)
- `date` (Date)
- `dayOfWeek` (String — "Monday", "Tuesday", etc.)
- `slotType` enum: `class_day | holiday | finals | break`
- `label` (String, nullable — e.g., "Presidents' Day",
  "Spring Break")
- Unique constraint: `(termId, date)`

This separates the calendar container (when you COULD have
class) from the sessions (what you actually planned).

---

### B) Priority 1: Data Import

**B1. Academic calendar import**

Endpoint: `POST /api/terms/[id]/import-calendar`

Accepts a JSON payload:
```json
{
  "slots": [
    {
      "date": "2026-01-20",
      "dayOfWeek": "Tuesday",
      "slotType": "class_day"
    },
    {
      "date": "2026-01-21",
      "dayOfWeek": "Wednesday",
      "slotType": "holiday",
      "label": "MLK Day (observed)"
    }
  ]
}
```

- Validates all dates fall within term start/end range
- Upserts (safe to re-import)
- Returns count of slots created/updated

**B2. Course structure import**

Endpoint: `POST /api/terms/[id]/import-structure`

Accepts a JSON payload representing a full term. Design the
schema by studying the exemplar files. At minimum:

```json
{
  "modules": [
    {
      "code": "LM-03",
      "sequence": 3,
      "title": "Seeing Patterns in Data",
      "learningObjectives": ["..."],
      "sessions": [
        {
          "code": "lec-07",
          "sessionType": "lecture",
          "title": "Data Manipulation",
          "date": "2026-02-10",
          "description": "..."
        }
      ]
    }
  ],
  "skills": [
    {
      "code": "LM03-C01",
      "category": "Data Manipulation",
      "description": "Filter rows using Boolean conditions"
    }
  ],
  "coverages": [
    {
      "sessionCode": "lec-07",
      "skillCode": "LM03-C01",
      "level": "introduced"
    }
  ],
  "assessments": [
    {
      "code": "GAIE-04",
      "assessmentType": "gaie",
      "title": "Data Manipulation Exploration",
      "progressionStage": "copy-paste",
      "skillCodes": ["LM03-C01", "LM03-C02"]
    }
  ]
}
```

Requirements:
- Transactional (all or nothing)
- Validates referential integrity (session codes in
  coverages must match sessions in modules, etc.)
- Returns a summary of what was created
- Does NOT delete existing data — additive only (warn on
  code conflicts)

**B3. Import UI**

Page: `/terms/[id]/import`

- Two tabs: "Academic Calendar" and "Course Structure"
- Each tab: file upload or textarea for JSON
- On paste/upload: show a **validation preview** (counts
  of each entity type, any warnings/errors)
- Confirm button (disabled until validation passes)
- Success screen showing what was created

**B4. DS-100 exemplar seed script**

Create `scripts/generate-ds100-exemplar.ts`:
- Reads the files in `docs/ds100-exemplar/`
- Generates two JSON files:
  - `ds100-calendar.json` (Spring 2026 calendar slots)
  - `ds100-structure.json` (modules, sessions, skills,
    coverages, assessments)
- These files serve as test data AND as a reference
  showing other instructors the import format
- This is a standalone script, not part of the app build

**B5. CSV import for skills**

Endpoint: `POST /api/terms/[id]/import-skills-csv`

Accepts CSV with columns: code, category, description,
module_code (optional).

Add a CSV upload option to the import page's Course
Structure tab (or its own small section).

---

### C) Priority 2: Calendar View

Page: `/terms/[id]/calendar`

**Layout:**
- Rows = weeks of the semester (derived from CalendarSlots)
- Columns = days that the term meets (from meetingPattern)
- Each cell corresponds to a CalendarSlot date

**Cell contents:**
- **Class day with session assigned**: Session card showing
  title, module color-code badge, session type badge
  (lecture/lab), and coverage count (e.g., "4 skills")
- **Class day with no session assigned**: Visually distinct
  empty cell (e.g., dashed border, muted "Unplanned" label)
  — this is a planning gap the instructor needs to fill
- **Holiday/break**: Grayed out with the holiday label
  (e.g., "Spring Break", "Presidents' Day")
- **Canceled session**: Session card with strikethrough
  styling and a "Canceled" badge. Remains visible — NOT
  removed from the UI

**Interactions:**
- Click a session card → open edit panel (sidebar or modal)
- Click an empty class day → offer to create a new session
  or assign an existing unscheduled session
- Click a canceled session → show cancellation details and
  any redistribution that happened

**Data flow:**
- Calendar reads from CalendarSlots (the container) and
  Sessions (the content placed into slots)
- Sessions are matched to slots by date
- Unscheduled sessions (date is null) should appear in a
  separate "Unscheduled" section below the calendar

---

### D) Priority 3: What-If Panel & Cancellation Workflow

**D1. What-If Simulation (no persistence)**

Add a collapsible side panel (drawer) accessible from the
calendar view and term detail view. This is a sandbox.

**Flow:**
1. Instructor selects a session and clicks "What if I
   cancel this?"
2. Panel shows:
   - All coverage entries for that session (skill + level)
   - **At-risk skills**: those with no other coverage at
     the same level elsewhere in the term. Highlight these.
   - **Coverage health diff**: before vs. after cancellation
     (e.g., "Fully covered skills: 38 → 35")
3. Instructor can **compare scenarios**: select a second
   session ("What if I cancel this one instead?") and see
   both impacts side by side
4. Nothing is persisted. This is exploration only.

**Scripted test scenarios:**
While AI is mocked, include a dropdown in the what-if panel:
"Load demo scenario" with 2-3 pre-built scenarios (e.g.,
"Cancel Lec 09 — redistributes 3 skills", "Cancel Lec 14 —
breaks GAIE dependency"). These run against the actual
term data but use scripted redistribution suggestions. This
lets us test the full UX flow without real AI.

**D2. Apply Cancellation (persists)**

When the instructor decides to proceed:

1. Click "Apply cancellation" in the what-if panel
2. Session status changes to `canceled`, `canceledAt` is
   set, optional `canceledReason` text field
3. Show **redistribution panel**: at-risk skills listed
   with a dropdown/selector for each, showing remaining
   scheduled sessions (filterable by module) where the
   coverage could be reassigned
4. A **"Suggest redistribution" button** calls the mock
   AI service (`MockAiPlanner.suggestRedistribution`).
   The mock should return a reasonable-looking stub
   (e.g., assign to sessions in the same module, prefer
   sessions close in sequence). Wire the UX now — the
   real AI comes later.
5. After redistribution choices are made, **validate
   coverage ordering** (I before P before A) and show
   warnings before confirming
6. On confirm: create new Coverage entries on target
   sessions with `redistributedFrom` pointing to the
   canceled session. Do NOT delete the original coverage
   entries — they stay on the canceled session as a
   historical record.

**D3. Domain logic for what-if**

Add to `src/domain/coverage-rules.ts` (or a new file
`src/domain/whatif.ts`):

- `simulateCancellation(termData, sessionId)` — pure
  function that returns the impact analysis (at-risk
  skills, coverage health diff) without mutating anything
- `compareScenarios(termData, sessionIdA, sessionIdB)` —
  runs `simulateCancellation` for both and returns a
  side-by-side comparison
- `validateRedistribution(termData, redistribution[])` —
  checks that proposed redistribution maintains coverage
  ordering

Write tests for all of these FIRST.

---

### E) Technical Debt (fix during this phase)

- Add `output: "standalone"` to `next.config.ts`
- Add try/catch error handling to all `fetch()` calls in
  page components. Show inline error messages instead of
  crashing.
- Fix the API client (`src/lib/api-client.ts`) to use
  TypeScript generics:
  `fetchTerms(): Promise<Term[]>` not `Promise<unknown>`
- Scope the skills GET endpoint to filter by term when a
  `termId` query param is provided (currently loads all
  coverages for all skills)

---

## TDD requirements

Minimum test coverage for this phase:

**Domain logic tests:**
- `simulateCancellation` — canceling a session with unique
  coverage vs. redundant coverage
- `compareScenarios` — two sessions with different impacts
- `validateRedistribution` — valid redistribution,
  redistribution that breaks ordering

**API route tests:**
- `POST /api/terms/[id]/import-calendar` — valid import,
  date out of range, duplicate dates
- `POST /api/terms/[id]/import-structure` — valid import,
  referential integrity violation, code conflict
- `PATCH /api/sessions/[id]` with status change to
  `canceled`

**Playwright E2E (at least one):**
- Import calendar → import structure → view calendar →
  see sessions on correct dates

If you need to reduce scope, reduce UI polish first, not
tests.

---

## Constraints

- **Mock AI is fine.** Keep `MockAiPlanner`. Do not add
  real AI integration. It costs money and the workflows
  aren't stable enough yet.
- No authentication yet.
- **Generic app** — nothing course-specific in the
  codebase. The DS-100 data lives only in the exemplar
  seed script and `docs/ds100-exemplar/`.
- Extend the Prisma schema as described. Do not
  restructure existing models that are working.
- All new features should work with both fresh databases
  and databases with existing MVP seed data.

---

## Definition of done

A reviewer can:
- Run the exemplar seed script to generate DS-100 JSON
- Import the calendar JSON on the import page
- Import the structure JSON on the import page
- See the semester laid out on the calendar view with
  sessions in correct date slots, holidays blocked out,
  and planning gaps visible
- Open the what-if panel, select a session, see impact
- Compare canceling two different sessions side by side
- Apply a cancellation and redistribute skills to other
  sessions
- See the canceled session on the calendar with
  strikethrough styling
- Run `npm test` successfully
- Run `npm run e2e` (if included) successfully

---

## Operating rules
- Do not ask for permission to create files; just do it.
- Avoid overengineering. Prefer simple, readable solutions.
- Prefer small PR-sized commits with clear messages.
- If you hit ambiguity, choose a default, record it in
  `ASSUMPTIONS.md`, proceed.
- Append to existing docs (ASSUMPTIONS.md, ROADMAP.md,
  ARCHITECTURE.md) — don't overwrite Phase 1 content.

---

## Start now
Begin by:
1) Confirming you have read the exemplar files and
   understand the data structures.
2) Summarizing the scope you will deliver (1 paragraph).
3) Asking the kickoff questions.
4) After answers (or defaults), start implementing.
