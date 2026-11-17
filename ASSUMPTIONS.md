# Assumptions

Decisions made where the requirements were underspecified. Each can be revisited.

## Data Model

- **Instructor entity added**: The requirements didn't specify an Instructor table but multi-tenancy was requested. Added `Instructor` with `name` and `email`, linked to `Term` via `instructor_id`.

- **Skills are global by default**: Skills with `is_global=true` are shared across all terms. Term-specific skills use `is_global=false` with a `term_id`. Clone copies references to global skills (not duplicates).

- **Assessment-Skill is a join table**: Rather than using a `UUID[]` column for `skills_assessed` on Assessment (as in the requirements doc), we use a proper `AssessmentSkill` join table for referential integrity.

- **Coverage unique constraint**: `(session_id, skill_id, level)` is unique — a skill can't have the same coverage level twice in the same session, but CAN have different levels (e.g., both introduced and practiced in one session).

- **Artifact parent resolution**: Artifacts use `parent_type` enum + nullable FKs (`session_id`, `assessment_id`, `module_id`) rather than a single polymorphic `parent_id`, for type safety.

## Authentication

- **No auth for MVP**: Single-user local dev. Data is scoped by instructor but there's no login/password system. The UI lets you switch instructors implicitly via term ownership.

- **Multi-tenant ready**: The data model supports multiple instructors. Auth can be layered on without schema changes.

- **Single allowed Google account**: Google OAuth access is restricted by the `ALLOWED_EMAIL` environment variable, which may contain one or more comma-separated email addresses for local and deployed environments.

- **JWT sessions only**: Auth.js uses its default stateless JWT session strategy. No Prisma adapter or auth-related schema changes are added.

- **Identity routes are additive, not contract rewrites**: Learning Module and Topic detail routes use small additive update DTOs that only cover identity/archive state (`stableCode`, `learningModuleId` for Topic, and `archivedAt`). Version prose still changes only through `/versions`, which preserves the immutable published-revision rule.

## Calendar / Schedule

- **Calendar is display-only**: The requirements mentioned iCal but the user clarified the calendar is for display (showing lecture/lab numbers and dates), not for integration with external calendar apps.

- **Calendar display deferred**: A full calendar view (weekly grid with sessions) is deferred to a future phase. The MVP shows sessions as a sorted list within modules, with dates visible.

- **Session dates are optional**: Sessions can be created without dates (useful during planning). The impact report flags undated sessions as info items.

## AI Integration

- **Mock only for MVP**: The `AiPlanner` interface is implemented with `MockAiPlanner` that returns canned responses. Designed for future OpenAI and Anthropic adapters.

- **Two provider slots**: The interface anticipates both ChatGPT (OpenAI) and Claude (Anthropic) as real implementations, with env vars `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`.

## Export

- **Artifact export stubs**: The `ArtifactExporter` interface returns mock content. The notebook skeleton generator creates a valid `.ipynb` structure but with placeholder content.

- **No iCal export**: Per user preference, we implemented artifact export stubs instead of iCal. iCal can be added later behind the same interface pattern.

## Coverage Rules

- **Ordering by sequence, not just date**: Coverage ordering is determined by `module_sequence` first, then `session_sequence`, then `date` as tiebreaker. This handles cases where dates are null or sessions are on the same day.

- **Same-session multi-level allowed**: A skill can be both "introduced" and "practiced" in the same session (common for labs).

## Term Cloning

- **Dates are cleared on clone**: When cloning a term, all session dates and assessment due dates are set to null. The instructor must set new dates for the new term.

- **Prior art linking**: Cloned sessions automatically reference their source sessions in the `prior_art` array, enabling "what did I do last time?" queries.

- **Same instructor by default**: Clone defaults to the same instructor but accepts an optional `instructorId` override.

## UI

- **Server components for homepage**: The homepage uses server-side rendering. All interactive pages (terms, modules, etc.) are client components.

- **No drag-and-drop**: Session reordering uses form-based sequence numbers, not drag-and-drop. Drag-and-drop is a future polish item.

- **Inline coverage in session list**: Coverage entries are shown inline on the session list (e.g., `[A01:I, A02:P]`) for quick scanning.

## Phase 2A — Calendar & Import

### Calendar Model

- **CalendarSlot separates container from content**: CalendarSlots define when a class COULD meet (holidays, class days, breaks, finals). Sessions define what is planned for a given date. They are matched by date, not by foreign key, to allow importing calendars independently from course structure.

- **SlotType `break_day` instead of `break`**: The enum uses `break_day` because `break` is a reserved word in most languages and could cause issues in code generation.

- **Calendar days only, no time of day**: The calendar models days (Tue/Thu/Fri) but not specific time slots. Time-of-day scheduling is deferred.

- **Substitute schedules remain a follow-up**: Alternate "Monday-on-Tuesday" or other substitute-day schedules are not modeled as a new slot/event enum in this packet. Current heuristics use only explicit break-day proximity plus instructor overrides; substitute-schedule semantics need a separate, designed follow-up.

### Import

- **Imports are additive only**: Import endpoints do not delete or overwrite existing data. If imported codes conflict with existing data, the import is rejected with a warning. This prevents accidental data loss from re-imports.

- **Skills created as term-scoped on import**: Imported skills use `isGlobal: false` and are linked to the importing term. Global skills can still be created manually.

- **Session sequences auto-assigned**: When importing sessions within a module, sequences are assigned based on array order if not explicitly provided.

- **Coverage redistribution is historical**: When a session is canceled and skills are redistributed, the original coverage entries remain on the canceled session. New entries are created on target sessions with `redistributedFrom` pointing back to the canceled session. This maintains a full audit trail.

### What-If

- **What-if is read-only until Apply**: The what-if panel runs pure simulation functions without touching the database. Only the "Apply cancellation" action persists changes.

- **New violations only**: The what-if simulation reports only NEW ordering violations caused by a cancellation, filtering out pre-existing violations.

- **Demo scenarios use live data**: The what-if panel's demo scenarios select sessions from the actual term data rather than using canned mock data. This ensures the demo reflects the current state of the course.

### Calendar View

- **Meeting pattern is data-driven**: The calendar view derives day columns from (1) the term's `meetingPattern.days` field if present, (2) unique `dayOfWeek` values from class_day CalendarSlots, or (3) a fallback of Tue/Thu/Fri. This handles MWF, TTh, daily, or any other pattern.

- **Module color coding by sequence**: Each module gets a distinct color based on its sequence number (cycling through 8 colors). This provides visual grouping on the calendar without requiring instructor configuration.

## Phase 2A.3 — Redistribution & Polish

### Redistribution UI

- **Redistribution step is optional**: After choosing to cancel a session, the instructor sees at-risk skills (unique coverage) with dropdowns to pick target sessions. They can redistribute, skip redistribution, or partially redistribute.

- **dryRun validation via cancel endpoint**: The cancel endpoint accepts a `dryRun: true` parameter that runs all validation (including ordering checks) without persisting the cancellation. This avoids duplicating validation logic in a separate endpoint.

- **AI suggestion is mock-only**: The "Suggest Redistribution" button calls a mock AI service that uses same-module preference, related-category preference, and round-robin distribution. No real AI provider is integrated.

- **Empty cell interactions use a modal**: Clicking an empty calendar cell (class_day with no session) opens a modal with "Create new session" and "Assign existing session" options, rather than inline editing.

- **WhatIfPanel is a shared component**: The what-if panel was extracted from the calendar page into `src/components/WhatIfPanel.tsx` and is reused on both the calendar view and the term detail page.

- **Non-at-risk skills shown collapsed**: Skills with `uniqueCoverage: false` are shown in a collapsed "Also covered elsewhere" section rather than the main at-risk list, to reduce noise.

### API Client Cleanup

- **Typed API client is the source of truth for UI types**: Page components import types from `src/lib/api-client.ts` rather than defining local duplicates. The `as unknown as X` pattern is removed in favor of direct typed returns.

- **Coverage and assessment pages retain local types**: Some pages define extended local interfaces (e.g., `CoverageRow`) that add fields not in the api-client types. These were left as-is to avoid scope creep.

## Phase 2B.1 — Coverage Matrix + Content Views

### Coverage Matrix

- **Matrix shows ALL skills**: The coverage matrix now shows every skill registered for the term, including those with zero coverage. Previously only skills with at least one coverage entry were visible, hiding gaps.

- **Health summary uses three-state model**: Skills are classified as "fully covered" (I + P + A), "partially covered" (at least one level but not all three), or "uncovered" (no coverage at all). The health bar shows all three states.

- **Canceled sessions excluded from health tracking**: Coverage entries on canceled sessions don't count toward a skill's coverage levels. The coverage entries are still visible in the matrix (for audit trail) but are not considered for the health summary.

- **Empty cell click-to-add via popover**: Clicking an empty matrix cell opens a small popover with I/P/A buttons rather than a modal or inline form. This minimizes disruption to the matrix view.

### Content Views

- **Module.notes field added**: A free-text `notes` field was added to the Module model for planning notes. This supports the "workspace" design principle — instructors can annotate modules with planning thoughts without it being formal content.

- **Session detail shows redistribution audit trail**: Redistributed coverage entries (those with `redistributedFrom` set) are shown in a separate section with orange styling to distinguish them from original coverage.

- **Skill detail uses timeline visualization**: Coverage entries for a skill are displayed as a vertical timeline sorted by session date/sequence, showing the progression through I → P → A.

- **Content views use shared components**: Breadcrumbs, CoverageBadge, StatusBadge, EditableText, LoadingSkeleton, and Toast are extracted to `src/components/` for reuse across all content views.

### Tech Debt Cleanup

- **Import page uses api-client**: The import page was the last holdout using raw `fetch()`. A new `importSkillsCsv` method with `requestRaw` helper was added to api-client to handle the text/csv content type.

- **Impact and assessment pages use shared types**: Local duplicate type definitions in the impact and assessments pages were removed in favor of types imported from `api-client.ts`. New `ImpactReport` and `ValidationItem` types were added to the api-client.

## Phase 2B.2 — Skill Flow Visualization

- **Thread lines are CSS borders, not SVG**: The skill "thread" (design
  principle #5) is drawn with absolutely-positioned half-width border
  divs inside each table cell between a skill's first and last coverage.
  This honors the phase constraint (HTML/CSS only, no SVG/canvas) while
  still reading as a continuous line. Canceled or simulated-canceled
  sessions render their thread segment as a dashed red border — the
  "broken line".

- **Thread span is display-relative**: The line spans first→last coverage
  among *visible* columns. If a module/canceled filter hides a skill's
  outermost coverage, the thread shortens accordingly rather than pointing
  at hidden columns.

- **Flow rows are grouped by category, then code**: The grid sorts skills
  by category and inserts category divider rows. Skill codes sort
  lexicographically within a category.

- **What-if overlay is client-side and read-only**: The flow page's
  "Simulate cancellation" select calls the pure `simulateCancellation`
  from `src/domain/whatif.ts` on already-fetched data. Nothing persists;
  no API call is made (design principle #3).

- **Placeholder module groups sort last**: Sessions whose module isn't in
  the modules list (shouldn't happen, but defensive) get a placeholder
  group with MAX_SAFE_INTEGER sequence so they appear at the far right.

### Skill Flow Review Fixes

- **A broken flow thread represents lost unique coverage**: A canceled or
  simulated-canceled column is dashed red only when that cell contains a
  coverage level with no other available coverage for the same skill. Showing
  a break merely because an unrelated canceled session lies between two
  badges incorrectly implies the skill depended on that session; showing a
  break for duplicated coverage would likewise overstate cancellation impact.
  This aligns the line with the what-if unique-coverage signal while retaining
  normal lines for safely backed-up coverage.

- **Flow health borders use coverage-matrix status**: Flow's legacy
  `complete`/`partial`/`none` remains for its existing filters and labels,
  while the border color is driven by the canonical
  `fully_covered`/`partially_covered`/`uncovered` status calculated through
  `getSkillHealthStatus`. The models are equivalent for the I/P/A health
  rule, so no separate visual status mapping is needed.

- **Badge strike-through vs. thread-line breakage are different signals**:
  A coverage badge dims/strikes whenever its own session is
  canceled/simulated, regardless of whether the skill has backup coverage
  elsewhere -- it means "this entry no longer counts." The connecting
  thread *line* only renders broken/red when the skill's flow is genuinely
  at risk (its sole coverage at that level), via `doesThreadBreakAtCell`.
  A skill with redundant coverage on a canceled session now shows a
  struck-through badge on a still-unbroken thread line -- the badge tells
  you "this specific entry is gone," the line tells you "the skill is
  fine." Previously both used the same (too-lenient) signal.

- **Filtered-view summary reuses the full term's cancellation stats**:
  `summarizeFilteredFlowData` recomputes only the skill-health counts
  (fully/partially/uncovered) from the currently-visible rows -- each row's
  `healthStatus` was already computed against the full term in
  `buildFlowData`, so filtering which cells are *displayed* doesn't change
  it. `canceledSessions`, `skillsAtRiskFromCancellations`, and the other
  session-scope numbers come from the unfiltered summary unchanged:
  toggling "hide canceled sessions" is a display preference, not a claim
  that the term has fewer cancellations. Previously these were re-derived
  from the filtered session list, so hiding canceled sessions zeroed them.

## Redesign Phase A.1 refreeze (Gate 0)

- **Seed uses Path A (split write), not a simplified compound key**: The
  nested `Term.learningModules.create` failure under `Term.create` is a
  Prisma nested-write ordering limitation, not a schema defect — the
  `TermLearningModule` FK to `Term` is intentionally the compound
  `[termId, courseId] -> [id, courseId]` per v2's Course-scoping design. The
  seed now creates the `Term`, then the `TermLearningModule`, as two
  top-level calls sharing the resolved `term.id`.

- **`assessmentType` is a string, not an enum, everywhere in the stack**:
  Prisma schema, the frozen contract (`redesign-contract.ts`), and the
  legacy `api-client.ts` all use `string`. GAIE is real seed/UI data for the
  ds100 exemplar, not app vocabulary — enumerating it in the schema would
  hardcode one course's structure into a generic tool (OPS.md's generic-app
  rule).

- **Term lifecycle is a tri-state enum plus `closedAt`, not derived from
  dates**: `startDate`/`endDate` describe the academic calendar, not
  instructor intent. An instructor may want a Term marked `closed`
  (read-only) before its end date, or reopen a past-dated Term to fix a
  mistake. `status` + `closedAt` make that intent explicit and queryable.

- **Calendar capacity and Session instructional mode are advisory-only,
  not enforced anywhere in Phase A.1**: They're informational fields with
  defaults (`normal`/`baseline`, `standard`) that nothing currently reads.
  The heuristic that would set them automatically from academic calendar
  proximity is explicitly Phase B+ work; Phase A.1 only proves the fields
  round-trip through the seed.

- **Delivered-pointer mutation is a command, not a field**: Removed
  `deliveredLearningModuleVersionId` from `UpdateTermLearningModuleRequest`
  and added a typed `CreateDeliveredRevisionRequest`/`Response` command
  instead (types + 501 stub only). Advancing the delivered pointer without
  creating an immutable revision would let a client silently repoint a
  Term's delivered curriculum at an unrelated version, breaking the
  planned-vs-delivered diff's invariant that the delivered pointer always
  names a revision that was actually created during that Term's delivery.

- **Legacy Module/Skill routes are retired (410), not reimplemented as
  stubs**: `/api/modules*`, `/api/skills*`, the old JSON/CSV import routes,
  and the old artifact export route have no place in `CanonicalRoute` — they
  addressed a data model (`Module`, `Skill`, `AssessmentSkill`) that no
  longer exists in the schema. A typed 501 stub implies "not yet built
  against this contract"; 410 with `legacy_route_retired` says "this
  contract is gone," which is the true state. The ad-hoc calendar import
  route is retired for the same reason: Institution/AcademicCalendar
  materialization (`/api/academic-calendars`) supersedes it.

- **Bare `/api/sessions`, `/api/coverages`, `/api/assessments` are retired,
  not promoted to canonical**: The Phase A.1 canonical route list only adds
  the Term/Session-nested forms (`/api/terms/[id]/sessions`,
  `/api/sessions/[id]/coverages`, `/api/terms/[id]/assessments`). The old
  bare list routes were Module/Skill-scoped by construction (their `where`
  clauses filtered on `termId`/`moduleId`/`skillId` against removed
  models) and have no schema-compatible meaning as global collections.

- **`src/app/page.tsx` is a placeholder shell, not deleted**: It was the
  only server-rendered page directly querying Prisma fields removed by the
  redesign (`Term.instructor`, `Term.courseCode`). Deleting it would break
  the root route; rewriting it is Lane C's job. A minimal static shell lets
  the branch build without pre-empting Lane C's UI decisions.

- **The Artifact API exposes generator provenance and metadata**: Phase B
  found that the frozen `ArtifactDto` omitted `generatorKey`, `generatedAt`,
  and `metadata` even though the accepted schema and lossless package design
  require them. The DTO correction is additive and keeps those create fields
  optional. Without it, generated material could be stored and exported but
  not faithfully read back through the canonical API.

- **The B.1 cockpit adds three read-only canonical query routes**: Real UI
  wiring exposed mock-only lookup gaps for the current authenticated Instructor,
  all Topic prerequisite edges in a Course, and a referenced Topic Version by
  ID. `/api/instructors/me`, `/api/courses/[id]/topic-prerequisites`, and
  `/api/topic-versions/[id]` are additive read surfaces with ownership checks;
  they do not weaken the frozen mutation contracts or authorization boundary.

## Redesign Phase B.1B — invariant recovery

- **Legacy single-pattern Term forms normalize to one lecture role**: The
  recovery seam expects explicit meeting-role patterns, but existing callers
  and seed data may still think in one `days[]` list. The materialization
  service normalizes that legacy shape into a single `lecture` role rather
  than rejecting it internally.

- **Session override evidence is one required label, not a richer workflow**:
  For this packet, a dated Session that does not use a materialized class-day
  slot must provide `scheduleOverrideLabel`. No separate override-reason model
  or approval record is introduced here.

- **Clone role mapping falls back to `sessionType` when source role evidence is
  ambiguous**: Existing redesign data does not yet persist a first-class
  meeting-role key per Session. Clone therefore resolves role mapping from the
  source Term meeting pattern first and falls back to `sessionType` when that
  is the only stable evidence available.

- **Lossless packages refuse export when uploaded/generated payload bytes cannot
  be resolved**: The truthful behavior for the `course-planner-lossless`
  profile is to fail the export with unresolved-payload details rather than
  emit a metadata-only package under a lossless name.

## Redesign Phase B.2 — protected preview access

- **The UX review deployment may use one-click preview authentication only
  behind Vercel Deployment Protection**: The provider is available only when
  Vercel itself reports `VERCEL_ENV=preview` and the branch-scoped
  `COURSE_PLANNER_PREVIEW_AUTH` flag is exactly `true`. It signs in as the
  explicitly configured, already-seeded Instructor email so ownership checks
  remain active. Production continues to expose only configured OAuth
  providers; this is a review seam, not an alternative production auth mode.

## Issue #15 — non-destructive default seed

- The default demo reserves deterministic UUIDs for its direct rows. Natural-key collisions fail instead of adopting user rows. Existing demo rows keep instructor edits; version pointers are set only when absent.
- The exemplar importer runs when its demo course is first created (or has no imported modules). Its stable course-scoped codes and version revisions identify the imported rows. Later default seed runs leave that course untouched.
- `--force` is the only path that clears every application table; migration history remains. Operator decision 2026-10-04, relayed by AICP.

## Authenticated demo loading

- **First data request creates the Instructor**: A signed-in email is used to create or find an Instructor when an authenticated route first needs it. A unique-key conflict from concurrent creation resolves to the winning row. The session name is used only for the initial row; later sign-ins do not overwrite a name the instructor may have edited.
- **The in-app demo creates one Course per Instructor**: The action imports the generic exemplar course structure into a new Course identified by the unique `(instructorId, demoKey)` pair. Repeating the action returns that Course without importing again. It does not create a Term because the generic exemplar snapshot has no institution or academic-calendar context for a usable Term.

- **The in-app demo now creates a Term as well (2026-10-04 operator decision)**: A dedicated demo Institution and Academic Calendar supply the missing context. The load creates the current or next Spring or Fall Term with weekly meetings and adopted Activities in the same transaction as the Course. Repeating the load makes no changes.

## Learning Module and Topic workspace editing (#66)

- Course workspace edits create a new draft version through the existing revision
  routes. Published versions and existing Activity/Term pins remain unchanged.
- Learning Module membership edits preserve the selected Activity version and its
  placement notes. New members use the Activity's current version; removing and
  adding an Activity explicitly can adopt its newer version. Membership order is
  saved as contiguous zero-based sequence values.
- Topic descriptions and change summaries belong to new Topic versions. Stable
  codes and prerequisites continue through their existing identity and DAG APIs.
- Publishing acts on the current saved Learning Module draft. It sets that
  version's publication time without creating another revision; unsaved editor
  changes must be saved first.

## Activity-led Course workspace (#71)

- The Activity board is the first design surface below the Course header.
  Learning Module editing, Term setup, and revision history remain available.
- Topic browsing is a secondary, collapsible Course-wide list. Legacy
  `Topic.learningModuleId` values do not define list groups or planning gaps.
- Topic content and prerequisites use a dedicated
  `/courses/[courseId]/topics/[topicId]` page because no existing Topic page
  route exists. The page uses the existing identity, DAG, and revision APIs.
  Topic creation remains available in the browser; coverage edits remain on
  Activity cards. Learning Outcome features are outside this change.
- A failed Topic save refreshes the displayed server revision and prerequisite
  chain while retaining the unsaved form values. The displayed revision shows
  which part of a partial save succeeded before the instructor retries.

## Past-dated Term onboarding (#75)

- **Open question — should elapsed meetings arrive planned or delivered?**
  Current adoption pins an initial planned revision, leaves the delivered
  pointer and lifecycle state null, and creates meeting detail with null dates,
  calendar slot, and status. A past Term start or end does not infer delivery.
  Scheduling is a separate operation. Adoption has no date input and reads
  neither the clock nor Term dates; the onboarding policy remains undecided.
- **Open question — what does changed-from-plan mean without an earlier plan?**
  Initial adoption establishes the baseline and produces no changed-from-plan
  signal. The daily driver also reports no change for a delivered-only record
  with no planned revision to compare. Whether onboarding should explain the
  absence of an earlier plan remains undecided.
- **Open question — how should missing past coverage affect health?**
  Current impact health reports tracked Topics with no recorded coverage as
  uncovered, including when all associated meetings are past. There is no
  date-based exemption or distinction between unrecorded history and a known
  coverage gap. How much historical reconstruction to request, and how to
  present that uncertainty, remain undecided. Reconstruction is outside #75.
- **Open question — do delivered Activity Topic actions count toward workspace health?**
  Delivered Topic actions on Term Activity revisions do not count toward the
  workspace coverage health. The Term workspace uses `computeTermImpact`,
  which reads Session Coverage records. Recording delivery through Activity
  revisions can therefore leave every tracked Topic uncovered in that health.
  Which source should drive workspace health remains undecided.
- **Open question — how do adopted meetings get dates for a past-dated Term?**
  Creation materializes calendar slots, but adoption creates 40 undated
  planned meeting revisions in both characterization scenarios. The daily
  driver reports `nextMeeting: null` for that output. The scheduled fixture's
  Meeting 20 of 40 result is correct only after each meeting is scheduled.
  Current scheduling requires editing individual Activity revisions; the
  onboarding scheduling workflow remains undecided.
- **Open question — should completedClassDays include today's meeting?**
  Current calendar progress counts today as completed. At noon before meeting
  20, it reports 20 of 40 completed while the scheduled daily driver still
  identifies meeting 20 as next. The meaning of completedClassDays and its
  agreement with the next-meeting display remain undecided.

## Demo data carries the current and next Term (#70)

- **The demo data rolls with the date.** The in-app demo load and the default
  seed both give the exemplar course two Terms: the Spring or Fall semester
  that is in progress (or the next to begin when none is), and the semester
  after it. Issue #70 offered two paths: rolling demo data, or more calendars
  entered once through the calendar editor. Entered-once calendars go stale
  again each semester, so the demo data computes its Terms from the date.
- **Demo dates come from weekday rules, not from a registrar.** Spring classes
  begin on the Tuesday after the third Monday of January. Fall classes begin on
  the first Wednesday of September. Classes end on the Friday of the fifteenth
  calendar week. The Demo Institution and Example University are not real, and
  the generic-app rule excludes one institution's calendar from app data. The
  earlier fixed dates (January 15, September 1) could fall on a weekend. The
  rules give 2026-09-02 and 2027-01-19, which are also real start dates at the
  exemplar's source institution; that agreement is a check on plausibility, not
  a requirement.
- **The current Term is populated; the next Term has its calendar only.**
  Pacing views need an active Term with adopted Activities. The next Term keeps
  adoption undone so the instructor can run the adoption preview and apply
  themselves. This also keeps the load transaction near its earlier size.
- **One Academic Calendar per academic year.** `(institutionId, academicYear,
  version)` is unique, so a Fall Term and the following Spring Term share one
  calendar. A Spring Term and the following Fall Term use two.
- **A repeat load or seed run adds missing Terms and changes nothing else.** A
  Term is matched by its code within the Course. An existing Term, calendar, or
  calendar version is reused as it is. When a repeat run adds the current Term
  to an existing Course, it adopts the modules that have a current version and
  skips the instructor's draft-only modules. A new demo Course still fails when
  a module has no current version, because that is an importer defect.
- **A demo Course without its demo Institution link is left alone.** The link
  identifies where the calendars belong. If the instructor removed it, a repeat
  load returns the Course and adds nothing.
- **The seeded foundation course keeps its fixed Spring 2026 Term.** That Term
  has hand-placed slots, sessions, and differing planned and delivered pins that
  tests depend on. It now serves as the past-Term example.
- **The demo calendars carry no holidays or recesses.** Adding rule-based
  events is a possible follow-up; it is outside #70.

## Term date-order checks (#98)

- The checker requires `topicVersions`, `calendarSlots`, and `prerequisites`
  alongside the daily driver's Activity/revision DTO inputs. Topic versions
  resolve actions to stable Topic IDs so different revisions compare together;
  slots supply meeting-date fallbacks. Prerequisites already reach the client
  through `redesignApi.listTopicPrerequisites(courseId)`; no route is added.
- A date-only value is compared as written. An instant is compared by its
  local date: a milestone's valid time zone first, else the valid `timeZone`
  argument (the Term's zone), else UTC. Valid instants without a valid zone use
  `new Date(value).toISOString().slice(0, 10)`; invalid instants use their first
  ten characters. Values of ten characters or fewer are returned as written.
  Zoned dates use `formatToParts` year, month, and day to build `YYYY-MM-DD`.
  The host time zone is never used. A meeting uses the local date of `startsAt`
  when present and its Calendar Slot date only when `startsAt` is absent,
  matching `buildTermDailyDriver` even when a delivered revision keeps an old slot.
- Sentences name a Topic from the optional `topicLabels` argument. A Topic with
  no label is "A Topic", never an id.
- Known limit: a coursework item's Introduce and Practice actions are dated by
  its due date, the same as its Assess actions. Work that students start before
  the Topic is introduced is not reported when the due date is after the
  introduction.
- `never_introduced` produces one finding per Topic using its earliest dated
  Practice or Assess action. Its absent introduction Activity and date are null.
  An undated introduction still exists, so it prevents a false absence finding.
  Any undated Introduce also suppresses Practice/Assess-before-Introduce findings
  for that Topic and prerequisite comparisons involving that Topic.
- A linked-due finding has a null Topic ID because a milestone need not have a
  Topic action. Findings sort by later date (`dates[1] ?? dates[0]`), then Topic ID (null
  first), kind, first Activity ID, and second Activity ID. String comparisons
  use `<`, independent of locale and input array order.
- Each undated Activity and each undated milestone is a separate undated item;
  an Activity without an effective revision is also undated. This makes the
  incomplete-check count explicit even when one Activity has several gaps.
  The panel uses singular wording for one item and lists each undated Activity
  once by label (else ID), with its number of undated milestones.
- For coursework and assessment actions, use the due milestone date, or the
  latest dated milestone when no due milestone exists. If there are several due
  milestones, use the latest dated due milestone; an undated due milestone does
  not fall back to another role because the due date is unknown. This same
  Activity date applies to Introduce and Practice actions as well as Assess.
- Cancellation is recognized on the Term Activity lifecycle state and effective
  detail status/lifecycle state, so canceled coursework is ignored as well as
  canceled meetings. Both `canceled` and `cancelled` are recognized without
  regard to letter case. Archived Term Activities are ignored entirely.
  Actions with an unknown Topic-version identity are skipped and each is counted
  in `unmappedActionCount`; the panel reports a positive count in a sentence.
  Equal-date occurrences break ties by Activity ID for stable results independent
  of input order.
- The panel receives Activity labels as a record and falls back to Activity IDs
  when a label is absent. `never_introduced` shows only its existing Activity.
  The panel remains separate from the workspace
  until the later integration step. Lists have `role="list"`; the finding count
  has `role="status"`.
