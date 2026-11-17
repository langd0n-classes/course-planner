# Architecture

## High-Level Overview

`main` is the product branch. It runs the Course, Learning Module, Topic,
and Activity model. Next.js App Router pages use the typed HTTP client in
`src/lib/redesign-api-client.ts`. API handlers in `src/app/api/` validate
requests, resolve the authenticated Instructor, and call services in
`src/services/redesign/`. Services enforce ownership and domain rules in
Prisma transactions. `prisma/schema.prisma` defines the PostgreSQL model.

The homepage lists Courses. Course workspaces organize versioned curriculum.
Term workspaces adopt that curriculum and record planned and delivered work.
The Module and Skill pages remain as legacy UI.

## Directory Structure

| Path | Role |
|---|---|
| `src/app/page.tsx` | Course index entry point |
| `src/app/courses/` | Course and Topic page entry points |
| `src/app/terms/` | Term workspace and retained legacy pages |
| `src/app/api/` | REST handlers, authentication, and retired legacy routes |
| `src/components/redesign/` | Course board, Topic editors, Term workspace, and daily driver |
| `src/services/redesign/` | Curriculum revisions, adoption, calendars, placement, lifecycle, packages, and imports |
| `src/lib/redesign-api-client.ts` | Typed HTTP client for the current workspace |
| `src/lib/redesign-contract.ts` | Request, response, and DTO contracts |
| `src/lib/redesign-schemas.ts` | Request validation |
| `src/lib/redesign-serializers.ts` | Model-to-DTO serialization |
| `src/lib/redesign-workspace.ts` | Course summaries and Term daily-driver calculations |
| `src/lib/redesign-auth.ts` | Authenticated Instructor resolution |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/lib/term-order-checks.ts` | Advisory date-order checks |
| `src/domain/` | Retained coverage and what-if functions |
| `prisma/schema.prisma` | Database models |
| `prisma/seed.ts` | Default seed |
| `e2e/` | Playwright tests |

## Data Model

Course curriculum separates stable identities from content versions.
`LearningModule`, `Topic`, and `Activity` belong to a `Course`. Each identity
has a current-version pointer and a version history: `LearningModuleVersion`,
`TopicVersion`, and `ActivityVersion`. Published curriculum remains pinned
when a later version is created.

An `ActivityType` belongs to an `Instructor`. Its `ActivityTypeVersion` supplies
the label used by an Activity version. `CourseActivityTypeVersion` enables
those type versions for a Course. `ActivityBehaviorFamily` has three values:
`meeting`, `coursework`, and `assessment`. Version detail lives in
`MeetingActivityVersion`, `CourseworkActivityVersion`, or
`AssessmentActivityVersion`.

`LearningModuleVersionActivity` orders Activity versions within a Learning
Module version. `ActivityVersionLearningModuleScope` records broader module
scope. `LearningModuleVersionTopic` snapshots Topic versions. Topics are
Course-owned and can serve several modules; the nullable
`Topic.learningModuleId` column remains in the schema but application code
does not use it for ownership.

`ActivityVersionTopicAction` links an Activity version to a Topic version.
`CoverageLevel` records `introduced`, `practiced`, or `assessed` actions.
`ActivityTopicScope` records identity-level Topic scope.
`TopicPrerequisite` links stable Topic identities within the same Course.

`Term` belongs to a Course and selects an Institution and Academic Calendar.
`TermLearningModule` pins a planned Learning Module version and an optional
separate delivered version. `TermActivity` adopts an Activity and its type
version. Its `plannedRevisionId` and `deliveredRevisionId` point to
`TermActivityRevision` snapshots. Each snapshot retains its base Activity
version, content, Topic actions, milestones, and behavior detail.

`TermMeetingActivityRevision` holds meeting times, status, and Calendar Slot.
`TermCourseworkActivityRevision` and `TermAssessmentActivityRevision` hold
lifecycle and delivery details. `TermActivityRevisionTopicAction` records the
Topic-version actions for that snapshot.

`ActivityVersionMilestoneTemplate` stores Course-level milestone templates.
`TermActivityMilestone` belongs to a Term Activity revision and records a role,
label, optional date, source template, and anchor policy. A linked milestone
can follow another Term Activity. Adoption creates a milestone only when it
can follow a valid Term Activity. An unlinked, absent, archived, or self-linked
anchor creates no milestone; a standalone milestone requires a date.

`AcademicCalendar` belongs to an `Institution`. `AcademicCalendarVersion`
contains `AcademicCalendarEvent` rows and `AcademicCalendarPeriod` ranges.
`CalendarSlot` materializes a date within a Term and can retain its source event.
`InstructorCalendarOverride` records instructor overrides. `TermMeetingPattern`
stores type-specific weekdays, local times, time zone, and date bounds.
`TermCalendarException` records Term-only changes and can target a type, slot,
or date.

`Session`, `Coverage`, `Assessment`, and `AssessmentTopic` remain in the schema
and canonical services. Session coverage references Topic versions. `Artifact`
can attach to curriculum versions, Term Activity revisions, Sessions, or
Assessments. These retained records support scheduling, coverage health,
materials, and package workflows alongside Term Activities.

### Key Relationships

- `Instructor` owns Courses and Activity Types. Term ownership follows Course.
- `Course` owns Learning Modules, Topics, Activities, and Terms.
- `LearningModuleVersionActivity` connects module and Activity versions in order.
- `ActivityVersionTopicAction` connects Activity and Topic versions through I/P/A.
- `TopicPrerequisite` connects Topic identities independently of their versions.
- `TermLearningModule` pins planned and delivered curriculum versions.
- `TermActivity` optionally belongs to a Term Learning Module and points to
  planned and delivered revision snapshots.
- `TermActivityRevision` owns behavior detail, Topic actions, and milestones.
- `TermActivityMilestone` can follow another `TermActivity` and retain a source
  `ActivityVersionMilestoneTemplate`.
- `Term` owns Calendar Slots, meeting patterns, and calendar exceptions.
  Meeting revisions can reference those slots.

## Authentication


- Auth.js (`next-auth` v5) provides Google OAuth for the
  single-user instructor workflow.
- Root config lives in `auth.ts`, exporting `auth`,
  `handlers`, `signIn`, and `signOut`.
- `src/app/api/auth/[...nextauth]/route.ts` exposes the
  Auth.js route handlers.
- `src/proxy.ts` protects app routes and redirects
  unauthenticated requests to the built-in sign-in page.
- Sessions use the default JWT strategy; no Prisma auth
  adapter or extra database tables are required.

## Authenticated Instructor and demo Course


Authenticated routes normalize the session email and resolve it through an Instructor upsert, reading the winning row after concurrent unique-key conflicts. `POST /api/instructors/me/demo-course` loads the generic exemplar into a Course owned by that Instructor, with two Terms: the Spring or Fall semester that is current (or next to begin), and the semester after it. The service locks the Instructor row and creates the Course, imported content, dedicated demo Institution, one Academic Calendar per academic year, both Term calendars, and the current Term's adopted Activities in one transaction. A unique `(instructorId, demoKey)` key identifies an existing demo on repeat requests; a repeat request adds the Terms that are then current and next and are missing. `demoSemesters` computes the dates from weekday rules. `ensureDemoTerms` is shared with the default seed, which applies it to the seeded exemplar course. The workspace homepage exposes the action through the typed redesign API client.

## Redesign recovery seams


The accepted B.1B recovery work tightens four invariant boundaries without
pulling in the sibling CRUD or cockpit packets:

- **Term creation is preview/apply**. `POST /api/terms` first previews
  materialized `CalendarSlot` candidates from academic-calendar events,
  instructor overrides, meeting-role patterns, and the requested date range;
  only `mode: "apply"` creates the `Term` plus `CalendarSlot` rows.
- **Calendar materialization is shared**. `src/services/redesign/calendar-materialization-service.ts`
  is the single source for meeting-role normalization, override application,
  calendar-fit checks, provenance, and warning/conflict reporting. Term clone
  reuses the same service for target-slot generation.
- **Meeting placement**. `src/services/redesign/meeting-placement.ts` pairs
  undated meeting activities with eligible class days without database access.
  `meeting-placement-service.ts` loads owned Term inputs, hashes preview
  placements, and applies immutable revision snapshots with planned-pointer
  compare-and-swap checks in one transaction. `POST /api/terms/[id]/placement-preview`
  returns labeled placements, unplaced meetings, and empty class days;
  `POST /api/terms/[id]/placement-apply` validates that preview and returns the
  number placed and `storedMeetingPatternCount`. In the same transaction,
  apply saves the fallback time as a `TermMeetingPattern` for each placed type
  with no existing pattern, using the Term's class-day weekdays and date bounds.
  Later previews reuse these times. A later `applyTermCalendar` replaces all
  pattern rows, removing any saved time omitted from its input.
  The typed redesign client connects both routes to
  `PlaceMeetingsPanel`, the Term workspace notice, and the daily-driver action.
- **Session scheduling records its evidence**. A scheduled Session now either
  points at a materialized `CalendarSlot` (`calendarSlotId`) or carries an
  explicit `scheduleOverrideLabel`; closed-Term Session/Assessment Artifacts
  remain read-only.
- **Artifact/package history is guarded**. Ordinary Artifact removal archives;
  hard removal is a separate impact-preview path. Lossless package export now
  packages uploaded/generated payload bytes through a bounded resolver with
  hashes and restore hooks instead of claiming a metadata-only round trip.
## Activity-led Course design (#71)


`CourseWorkspacePage` leads with `ActivityBoard`; Learning Modules group Activity
versions. The secondary `TopicBrowser` links to
`/courses/[courseId]/topics/[topicId]`, where `TopicWorkspacePage` loads Course
Topics and prerequisites and `TopicEditor` edits the selected Topic. Identity,
prerequisite, and content revision calls retain their existing contracts.

## Adoption milestone templates (#87)

Adoption creates a milestone only when it can follow a Term Activity. A
missing link, absent or archived target, or self link creates no milestone.
Preview reports each skipped template and its reason. `milestoneCount` counts
only the milestones that apply creates. The instructor can add a standalone
milestone by hand with a date. Adoption does not copy relative offsets into
dates.

`term-activity-service.ts` loads ordered Activity Version milestone templates for adoption. Preview excludes already-adopted Activities and reports each candidate's milestone count and missing-anchor warnings. Apply creates all Term Activity identities first, then creates the first planned revisions with undated milestones, resolving anchors against both existing and newly created Term Activities. Existing transaction timeouts and stale-preview checks remain in force.

`POST /api/terms/[id]/adoption-preview` serializes the extended response through `toTermAdoptionPreviewDto` in `redesign-serializers.ts`. `redesign-contract.ts` defines the milestone count and standalone warning fields, and `redesign-api-client.ts` exposes those types to UI callers. `ActivityAdoptionPanel`, rendered by `TermWorkspacePage`, previews the planned Learning Module selections and shows milestone counts and missing-link reasons before applying.

The generic snapshot in `exemplar-import-service.ts` includes two coursework template sets and same-module meeting anchors. Its importer resolves stable Activity codes to template links after creating Activity identities. `demo-course-service.ts` uses this imported content in its existing current-Term adoption transaction; its next Term remains unadopted. The database smoke script checks four undated Term milestones and repeat-load stability. No schema or migration changes are required.

## Topic and module independence (#91)

`revision-service` creates Course-owned Topics without module ownership writes
and validates module Topic snapshots by Course. `exemplar-import-service` accepts
Topics without `learningModuleCode` and omits the legacy ownership column on
insert; the seed and demo services use these same paths. `redesign-mock-backend`
creates the same Topic shape. Topic contracts and `redesign-serializers` omit
`learningModuleId`; Topic routes continue to use those serializers.

`archive-removal-service` blocks module removal when version snapshots link
Topics, counting distinct Topic identities across revisions. Snapshot foreign
keys restrict deletion, and removal does not delete the links.
`planning-service` emits no out-of-offering Topic warning.
The unused `buildTopicBrowserBuckets` helper and its unused bucket type are deleted.
The Course workspace's secondary `TopicBrowser` remains Course-wide.
Topic forms and code suggestions retain their existing behavior. The nullable
Prisma column remains until its separate removal migration.

## Term date-order checks (#98)

- `src/lib/term-order-checks.ts` exports the pure advisory `checkTermOrder`
  function and input/result types. It uses the daily driver's Term Activity and
  planned/delivered revision DTOs, stable Topic-version identity mappings,
  Calendar Slots, and prerequisite pairs. Optional `timeZone` supplies the Term's
  local date zone; optional `topicLabels` supplies names for finding sentences.
  It reports five order findings and counts undated Activities/milestones and
  unmapped Topic actions without mutating data. The existing
  `redesignApi.listTopicPrerequisites(courseId)` call supplies prerequisite data;
  no new service route is needed.
- `src/components/redesign/TermOrderFindingsPanel.tsx` renders a labelled section
  and list with finding sentences, Activity labels, dates, finding count, and
  undated count. Its result and labels are props; loading and Term workspace
  integration belong to a later step.

## Demo-mode guard (#78)


Demo mode requires two keys: the server variable `COURSE_PLANNER_DEMO=true`
and the marker table `public._demo_marker`.

The flag together with a configured sign-in variable raises
`DemoModeConfigError`. The error names the variables without exposing their
values.

`assertDemoDatabase` in `src/lib/demo-mode.ts` checks the flag and the marker
table. A test in `src/services/no-model-sdk.test.ts` fails when a model SDK
or a model API key name enters the build.

## E2E Testing

Playwright E2E tests live in `e2e/`. Config: `playwright.config.ts`. Run with `npm run e2e`.

## Legacy Module and Skill product

The Module and Skill pages are legacy. `src/app/skills/` and the Module,
Session, Skill, coverage, flow, impact, import, calendar, and assessment pages
under `src/app/terms/` still use `src/lib/api-client.ts`. The Term root page
uses `TermWorkspacePage` instead. Old Module/Skill CRUD and JSON/CSV import
routes return `410 legacy_route_retired` through `src/app/api/redesign-stub.ts`.
Some shared canonical routes still serve Session, coverage, and assessment
records against the current schema. The descriptions below retain the legacy
workflows; they do not describe the current Course workspace.

### Service Interfaces

#### AiPlanner
- `suggestRedistribution()` — When a session is canceled/moved
- `analyzeCoverage()` — Identify gaps in the coverage matrix
- `chat()` — Contextual pedagogy consultation

#### ArtifactExporter
- `exportModuleOverview()` — Markdown module summary
- `exportSessionDescription()` — Markdown session details
- `exportTermSummary()` — Full term markdown export
- `generateNotebookSkeleton()` — Jupyter notebook for assessments
- `exportSkillsList()` — Skills by category

Both interfaces have mock implementations for development/testing and are registered in `src/services/index.ts`.

### Domain Rules (Invariants)

Implemented as pure functions in `src/domain/coverage-rules.ts` and `src/domain/whatif.ts`:

#### Coverage Rules (`coverage-rules.ts`)
1. **Coverage ordering**: Introduced before Practiced before Assessed
2. **GAIE progression**: copy-paste → modify → write-own
3. **Orphan detection**: Skills with no coverage
4. **Unassessed detection**: Skills with no assessment
5. **Impact analysis**: Compute affected skills when a session moves

#### What-If Simulation (`whatif.ts`)
1. **simulateCancellation**: Pure function returning impact (at-risk skills, health diff, new violations)
2. **compareScenarios**: Side-by-side comparison of canceling two sessions
3. **validateRedistribution**: Check that redistributed coverages maintain I→P→A ordering
4. **computeCoverageHealth**: Summary of coverage state (introduced/practiced/assessed/fully covered counts)

### Import Subsystem

API routes for importing course data:
- `POST /api/terms/[id]/import-calendar` — Upsert CalendarSlots with date range validation
- `POST /api/terms/[id]/import-structure` — Transactional import of modules, sessions, skills, coverages, assessments
- `POST /api/terms/[id]/import-skills-csv` — CSV upload for skills (code, category, description)
- `GET /api/terms/[id]/calendar-slots` — Fetch calendar slots ordered by date

Seed script: `scripts/generate-ds100-exemplar.ts` generates `ds100-calendar.json` and `ds100-structure.json` from the exemplar files.

### Cancellation Workflow

- `POST /api/sessions/[id]/cancel` — Cancel session with optional redistribution; supports `dryRun: true` for validation without persistence
- `GET /api/sessions/[id]/whatif` — Simulate cancellation impact (read-only)
- `GET /api/terms/[id]/whatif-compare` — Compare two cancellation scenarios
- `POST /api/ai/suggest-redistribution` — Mock AI suggestions for skill redistribution targets

#### Redistribution Flow (Phase 2A.3)

The what-if panel (`WhatIfPanel.tsx`) now supports a multi-step cancellation workflow:
1. **Impact** — See coverage health diff, at-risk skills, ordering violations
2. **Redistribute** — Assign at-risk skills to other sessions via dropdowns; optionally use AI suggestions
3. **Validate** — Dry-run validation against coverage ordering rules
4. **Confirm** — Apply cancellation with redistributions, or skip redistribution

The panel is shared between the calendar view and the term detail page.

### Content Views (Phase 2B.1)

#### Coverage Matrix (`/terms/[id]/coverage`)
Uses domain logic from `coverage-matrix.ts` for matrix assembly, health computation, and gap filtering. Shows ALL skills as rows with session columns. Health summary bar at top with visual progress. Clickable empty cells for adding coverage.

#### Module Detail (`/terms/[id]/modules/[moduleId]`)
Full module view with editable learning objectives, planning notes, session list with inline-editable descriptions, and skills summary table. Uses `EditableText` component for inline editing.

#### Session Detail (`/terms/[id]/sessions/[sessionId]`)
Session view with editable description/notes, coverage entries, redistribution audit trail, linked assessments, and what-if panel integration. Shows canceled session info prominently.

#### Skill Detail (`/terms/[id]/skills/[skillId]`)
Skill view with coverage status (I/P/A indicators), timeline visualization showing all coverage entries chronologically, and linked assessments.

#### Domain Logic (`coverage-matrix.ts`)
Pure functions for matrix assembly:
- `assembleCoverageMatrix()` — build full matrix from skills, sessions, coverages
- `computeHealthBar()` — count fully/partially/uncovered skills
- `filterMatrixRows()` — filter by "all", "gaps", or "at_risk"
