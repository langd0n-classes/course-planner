# phase2a3_redistribution_and_polish.md

## Prompt Name
Course Planner — Phase 2A.3: Redistribution Workflow and
Polish (Sequential follow-up to Phase 2A)

## How to use
1) Open the course-planner repo in Claude Code Web (or
   another AI coding tool).
2) Ensure PR #2 (Phase 2A) is merged to main.
3) Paste this entire prompt.
4) Let it run. No kickoff questions needed — the scope is
   focused and well-defined.

## Prerequisite
Phase 2A (PR #2) must be merged. The app should have:
- CalendarSlot model, SessionStatus enum, Coverage
  redistribution tracking
- Import pipeline (calendar, structure, CSV)
- Calendar view with weekly grid
- What-if panel (side drawer) with impact analysis and
  scenario comparison
- Cancel endpoint with `validateRedistribution` call
- `src/domain/whatif.ts` with pure functions:
  `simulateCancellation`, `compareScenarios`,
  `validateRedistribution`, `computeCoverageHealth`
- `src/lib/term-data.ts` with shared `loadTermData`

---

## Role
You are a senior full-stack engineer completing the final
piece of Phase 2A. The infrastructure is done — you are
adding the UI workflow that makes cancellation actionable
and fixing quality issues identified in code review.

Read `CLAUDE.md` and `docs/design-principles.md` first.

---

## Context: What's missing

The what-if panel currently shows the impact of canceling
a session (at-risk skills, health diff, scenario
comparison) but when the instructor clicks "Apply
Cancellation," it just cancels the session and closes the
drawer. There is no way to redistribute at-risk skills to
other sessions. The domain logic for redistribution
exists and is tested — it's the UI that's missing.

Additionally, code review identified several quality
issues that should be fixed in this pass.

---

## What to build

### 1. Redistribution UI (the main deliverable)

Extend the what-if panel's cancellation flow. Currently
the flow is:

```
Click "What if?" → See impact → "Apply Cancellation" →
Session canceled, drawer closes
```

Change it to:

```
Click "What if?" → See impact → "Apply Cancellation" →
REDISTRIBUTION STEP → Validate → Confirm → Done
```

**The redistribution step:**

After the instructor clicks "Apply Cancellation" (or a
new "Cancel & Redistribute" button), show a
redistribution panel INSTEAD of immediately canceling.
This panel should:

a) List each **at-risk skill** from the impact analysis
   (skills with `uniqueCoverage: true`). For each:
   - Show the skill code, description, and coverage level
     that will be lost (I, P, or A)
   - Show a **dropdown/select** of eligible target
     sessions: remaining scheduled sessions in the same
     term, sorted by module sequence then session
     sequence. Show session code + title in the dropdown.
     Prefer sessions in the same module (show those
     first, separated from other-module sessions).
   - The instructor selects where each skill's coverage
     should go.

b) Show a **"Suggest Redistribution" button** that calls
   `MockAiPlanner.suggestRedistribution()`. The mock
   should return a reasonable-looking stub response that
   pre-fills the dropdowns. Make the mock smarter than
   the current implementation:
   - Prefer sessions in the same module as the canceled
     session
   - Prefer sessions that already cover related skills
     (same category)
   - If no good match, pick the next session in sequence
   Wire the mock response into the UI by auto-selecting
   the suggested target session for each at-risk skill.
   The instructor can still override any suggestion.

c) Once target sessions are selected for all at-risk
   skills, show a **"Validate" button** that calls
   `validateRedistribution` (can be done client-side
   using the domain function, or via the cancel endpoint
   with a `dryRun` flag). Show results:
   - Green: "No ordering violations. Safe to proceed."
   - Yellow/Red: list each violation (e.g., "Skill
     LM04-C01 would be practiced before introduced").
     Let the instructor fix selections or proceed with
     warnings.

d) A **"Confirm Cancellation"** button that:
   - Sends `POST /api/sessions/[id]/cancel` with the
     `redistributions` array populated from the
     dropdowns
   - Shows success feedback (which session was canceled,
     how many skills were redistributed)
   - Refreshes the calendar view to show the canceled
     session with strikethrough
   - Closes the drawer

e) Allow the instructor to **skip redistribution** — a
   "Cancel Without Redistributing" link/button that
   cancels the session with an empty `redistributions`
   array. Some skills may be intentionally dropped.

f) Non-at-risk skills (those with `uniqueCoverage:
   false`) should be shown in a collapsed section labeled
   "Also covered elsewhere (no action needed)" for
   reference. They don't need redistribution.

### 2. Empty calendar cell interactions

On the calendar view, empty class-day cells currently
show "Unplanned" with a dashed border but aren't
interactive. Make them clickable:

- Click an empty cell → show a small popover or modal
  with two options:
  a) "Create new session" — opens a session creation
     form pre-filled with the date from the clicked cell
  b) "Assign existing session" — shows a dropdown of
     unscheduled sessions (sessions with null date) that
     the instructor can place into this slot

This connects the calendar view to the session management
workflow.

### 3. What-if panel on term detail page

The what-if panel currently only appears on the calendar
view. Add it to the term detail page (`/terms/[id]`) as
well:

- Add a "What if I cancel this?" link/button on each
  session in the term detail's module/session list
- Opens the same side drawer panel with the same
  functionality
- Reuse the same component — extract the what-if panel
  into a shared component if it isn't already

### 4. Calendar meeting pattern from data

The calendar view hardcodes `["Tuesday", "Thursday",
"Friday"]` as day columns. Fix this:

- Derive columns from the term's `meetingPattern` field
  (which stores JSON describing which days the class
  meets)
- Fall back to the current hardcoded pattern if
  `meetingPattern` is null or empty
- This ensures the calendar works for MWF courses, TTh
  courses, daily courses, etc.

### 5. Typed API client cleanup

The Phase 2A typed client fix was only half-applied.
Pages still define local duplicate interfaces and
double-cast: `as unknown as LocalType`.

- Remove duplicate interface definitions from page
  components
- Import types from `src/lib/api-client.ts` instead
- Remove all `as unknown as X` casts — the typed client
  should make these unnecessary
- The calendar page uses raw `fetch()` — switch it to
  use the `api` client for consistency

### 6. next.config.ts standalone output

Add `output: "standalone"` to `next.config.ts`. The
Dockerfile expects this for production builds. Without
it, `docker compose up` fails for the app container.

```typescript
const nextConfig = {
  output: "standalone",
};
export default nextConfig;
```

### 7. Tests

**API route tests (at minimum):**
- `POST /api/sessions/[id]/cancel` with valid
  redistributions → 200, coverage entries created
- `POST /api/sessions/[id]/cancel` with redistributions
  that break ordering → 400 with violations
- `POST /api/sessions/[id]/cancel` with no
  redistributions → 200, session canceled, no new
  coverage

**Playwright E2E (at least one):**
- Import DS-100 calendar JSON → import structure JSON →
  navigate to calendar → verify sessions appear on
  correct dates → open what-if on a session → see
  at-risk skills

If you need to reduce scope, the E2E test is highest
priority (it was requested in Phase 2A and not
delivered). API route tests are second priority.

---

## Constraints

- **Mock AI only.** Improve the mock to be smarter (same-
  module preference, related-skill preference) but do NOT
  add real AI.
- **Generic app.** No course-specific code.
- **Reuse existing domain logic.** The what-if functions
  in `whatif.ts` already handle the computation. The work
  here is UI + wiring, not new domain logic.
- **TDD for API route tests.** Write the cancel endpoint
  tests before making changes to the cancel route (if
  any changes are needed).
- Extend, don't restructure.

---

## Definition of done

A reviewer can:
- Open the calendar, click "What if?" on a session with
  unique coverage
- See at-risk skills listed with target session dropdowns
- Click "Suggest Redistribution" and see dropdowns auto-
  filled with reasonable mock suggestions
- Override a suggestion manually
- Click "Validate" and see green (safe) or red
  (violations)
- Click "Confirm Cancellation" and see the session
  canceled on the calendar with redistributed coverage
  on target sessions
- Alternatively, click "Cancel Without Redistributing"
- Click an empty calendar cell and create a new session
  or assign an unscheduled one
- Open what-if from the term detail page (not just
  calendar)
- See the calendar display correct columns for a course
  that doesn't meet TTh/F
- Run `npm test` with all tests passing (including new
  cancel route tests)
- Run `npm run e2e` with the Playwright smoke test
  passing
- Run `docker compose up` and have the app container
  build successfully

---

## Operating rules
- Read `CLAUDE.md` first.
- Avoid overengineering. The redistribution UI should be
  functional, not beautiful.
- If you hit ambiguity, choose a default, record it in
  `ASSUMPTIONS.md`, proceed.
- Append to existing docs — don't overwrite.
- Prefer extracting shared components over duplicating
  code between the calendar and term detail pages.
