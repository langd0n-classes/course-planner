# Course/LM/Topic architecture redesign — gpt-5.6-sol

Read-only design pass (`gpt-5.6-sol`, 2026-07-11T15:33:22-04:00), not implementation. Absorbs
issue #17 (Skill -> Topic rename). No migration path was requested --
this proposes a clean schema rewrite for a wipe-and-reseed. Review the
"Decisions requiring operator sign-off" section at the end before
converting this into a build prompt.

---

# Architecture redesign proposal

No workspace files were changed. The required trace was written to `/tmp/TRACE_LOG.codex-sol-course-redesign-2026-07-11T15_05_15-0400`.

One requested lookup remains unresolved: the actual GitHub issue number for `Skill → Topic`. Both configured GitHub tokens were invalid, and the fallback could not resolve `api.github.com`. The implementation plan should not invent the number; rerun `gh issue list --repo langd0n-classes/course-planner` before creating the build prompt.

The referenced `docs/plans/issue-6-phase-2c-exports-plan.md` is absent from this checkout, but it exists on `origin/explore/sol-issue6-plan`; its chunk structure informed the plan below.

## Recommended model

```text
Instructor
└── Course
    ├── Topic
    ├── LearningModule
    │   └── LearningModuleTopic ── Topic
    └── Term
        ├── TermLearningModule ── LearningModule
        │   └── Session
        │       └── Coverage ── Topic
        ├── Assessment
        │   └── AssessmentTopic ── Topic
        └── CalendarSlot
```

The central decision is an explicit `TermLearningModule` offering record.

- `LearningModule` is reusable curriculum structure owned by a `Course`.
- `TermLearningModule` says that a particular `Term` adopts a particular LM.
- Per-term ordering belongs on `TermLearningModule`, not on `LearningModule`.
- `Session` belongs to `TermLearningModule`; its term is therefore explicit and structurally consistent.
- A term can omit an LM or order its adopted LMs differently without copying the curriculum definition.
- Deleting a term deletes its offerings and sessions. Deleting an adopted LM should be restricted.

## Proposed Prisma schema

The following is the proposed replacement for the relevant models. It intentionally assumes a wipe and reseed.

```prisma
enum SessionType {
  lecture
  lab
}

enum CoverageLevel {
  introduced
  practiced
  assessed
}

enum AssessmentType {
  gaie
  assignment
  exam
  project
}

enum SessionStatus {
  scheduled
  canceled
  moved
}

enum SlotType {
  class_day
  holiday
  finals
  break_day
}

enum ArtifactType {
  notebook
  handout
  slides
  ta_key
  other
}

enum ParentType {
  session
  assessment
  learning_module
}

model Instructor {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  email     String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  courses Course[]

  @@map("instructors")
}

model Course {
  id           String    @id @default(uuid()) @db.Uuid
  instructorId String    @map("instructor_id") @db.Uuid
  code         String
  title        String
  description  String?   @db.Text
  archivedAt   DateTime? @map("archived_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  instructor     Instructor       @relation(fields: [instructorId], references: [id], onDelete: Cascade)
  terms          Term[]
  learningModules LearningModule[]
  topics         Topic[]

  @@unique([instructorId, code])
  @@map("courses")
}

model Term {
  id             String   @id @default(uuid()) @db.Uuid
  courseId       String   @map("course_id") @db.Uuid
  code           String
  name           String
  startDate      DateTime @map("start_date") @db.Date
  endDate        DateTime @map("end_date") @db.Date
  meetingPattern Json?    @map("meeting_pattern") @db.JsonB
  holidays       Json?    @db.JsonB
  clonedFromId   String?  @map("cloned_from_id") @db.Uuid
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  course              Course               @relation(fields: [courseId], references: [id], onDelete: Cascade)
  clonedFrom          Term?                @relation("TermClone", fields: [clonedFromId, courseId], references: [id, courseId])
  clones              Term[]               @relation("TermClone")
  learningModules     TermLearningModule[]
  sessions            Session[]
  assessments         Assessment[]
  calendarSlots       CalendarSlot[]

  @@unique([courseId, code])
  @@unique([id, courseId])
  @@map("terms")
}

model LearningModule {
  id                 String    @id @default(uuid()) @db.Uuid
  courseId           String    @map("course_id") @db.Uuid
  code               String
  title              String
  description        String?   @db.Text
  learningObjectives String[]  @map("learning_objectives")
  notes              String?   @db.Text
  defaultSequence    Int?      @map("default_sequence")
  archivedAt         DateTime? @map("archived_at")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")

  course              Course                  @relation(fields: [courseId], references: [id], onDelete: Cascade)
  topics              LearningModuleTopic[]
  termLearningModules TermLearningModule[]
  artifacts           Artifact[]

  @@unique([courseId, code])
  @@unique([id, courseId])
  @@map("learning_modules")
}

model Topic {
  id          String    @id @default(uuid()) @db.Uuid
  courseId    String    @map("course_id") @db.Uuid
  code        String
  category    String?
  title       String
  description String?   @db.Text
  archivedAt  DateTime? @map("archived_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  course                Course                  @relation(fields: [courseId], references: [id], onDelete: Cascade)
  learningModules       LearningModuleTopic[]
  prerequisiteFor       TopicPrerequisite[]     @relation("PrerequisiteTopic")
  prerequisites         TopicPrerequisite[]     @relation("DependentTopic")
  coverages             Coverage[]
  assessmentTopics      AssessmentTopic[]

  @@unique([courseId, code])
  @@unique([id, courseId])
  @@map("topics")
}

model LearningModuleTopic {
  learningModuleId String @map("learning_module_id") @db.Uuid
  topicId          String @map("topic_id") @db.Uuid
  courseId         String @map("course_id") @db.Uuid
  sequence         Int?
  createdAt        DateTime @default(now()) @map("created_at")

  learningModule LearningModule @relation(
    fields: [learningModuleId, courseId],
    references: [id, courseId],
    onDelete: Cascade
  )
  topic Topic @relation(
    fields: [topicId, courseId],
    references: [id, courseId],
    onDelete: Cascade
  )

  @@id([learningModuleId, topicId])
  @@index([topicId])
  @@map("learning_module_topics")
}

model TopicPrerequisite {
  topicId             String @map("topic_id") @db.Uuid
  prerequisiteTopicId String @map("prerequisite_topic_id") @db.Uuid
  courseId            String @map("course_id") @db.Uuid

  topic Topic @relation(
    "DependentTopic",
    fields: [topicId, courseId],
    references: [id, courseId],
    onDelete: Cascade
  )
  prerequisiteTopic Topic @relation(
    "PrerequisiteTopic",
    fields: [prerequisiteTopicId, courseId],
    references: [id, courseId],
    onDelete: Restrict
  )

  @@id([topicId, prerequisiteTopicId])
  @@map("topic_prerequisites")
}

model TermLearningModule {
  id               String   @id @default(uuid()) @db.Uuid
  termId           String   @map("term_id") @db.Uuid
  learningModuleId String   @map("learning_module_id") @db.Uuid
  courseId         String   @map("course_id") @db.Uuid
  sequence         Int
  notes            String?  @db.Text
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  term Term @relation(
    fields: [termId, courseId],
    references: [id, courseId],
    onDelete: Cascade
  )
  learningModule LearningModule @relation(
    fields: [learningModuleId, courseId],
    references: [id, courseId],
    onDelete: Restrict
  )
  sessions Session[]

  @@unique([termId, learningModuleId])
  @@unique([termId, sequence])
  @@unique([id, termId])
  @@map("term_learning_modules")
}

model Session {
  id                   String        @id @default(uuid()) @db.Uuid
  termId               String        @map("term_id") @db.Uuid
  termLearningModuleId String        @map("term_learning_module_id") @db.Uuid
  sequence             Int
  sessionType          SessionType   @map("session_type")
  code                 String
  title                String
  date                 DateTime?     @db.Date
  description          String?       @db.Text
  format               String?
  priorArt             String[]      @map("prior_art") @db.Uuid
  notes                String?       @db.Text
  status               SessionStatus @default(scheduled)
  canceledAt           DateTime?     @map("canceled_at")
  canceledReason       String?       @map("canceled_reason") @db.Text
  createdAt            DateTime      @default(now()) @map("created_at")
  updatedAt            DateTime      @updatedAt @map("updated_at")

  term Term @relation(fields: [termId], references: [id], onDelete: Cascade)
  termLearningModule TermLearningModule @relation(
    fields: [termLearningModuleId, termId],
    references: [id, termId],
    onDelete: Cascade
  )
  coverages  Coverage[]
  assessments Assessment[]
  artifacts  Artifact[]

  @@unique([termId, code])
  @@unique([termLearningModuleId, sequence])
  @@map("sessions")
}

model Coverage {
  id                String        @id @default(uuid()) @db.Uuid
  sessionId         String        @map("session_id") @db.Uuid
  topicId           String        @map("topic_id") @db.Uuid
  level             CoverageLevel
  notes             String?       @db.Text
  redistributedFrom String?       @map("redistributed_from") @db.Uuid
  redistributedAt   DateTime?     @map("redistributed_at")
  createdAt         DateTime      @default(now()) @map("created_at")
  updatedAt         DateTime      @updatedAt @map("updated_at")

  session Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  topic   Topic   @relation(fields: [topicId], references: [id], onDelete: Restrict)

  @@unique([sessionId, topicId, level])
  @@map("coverages")
}

model Assessment {
  id               String         @id @default(uuid()) @db.Uuid
  termId           String         @map("term_id") @db.Uuid
  code             String
  title            String
  assessmentType   AssessmentType @map("assessment_type")
  description      String?        @db.Text
  sessionId        String?        @map("session_id") @db.Uuid
  dueDate          DateTime?      @map("due_date") @db.Date
  rubric           Json?          @db.JsonB
  progressionStage String?        @map("progression_stage")
  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @updatedAt @map("updated_at")

  term             Term              @relation(fields: [termId], references: [id], onDelete: Cascade)
  session          Session?          @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  topics           AssessmentTopic[]
  artifacts        Artifact[]

  @@unique([termId, code])
  @@map("assessments")
}

model AssessmentTopic {
  assessmentId String @map("assessment_id") @db.Uuid
  topicId      String @map("topic_id") @db.Uuid

  assessment Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  topic      Topic      @relation(fields: [topicId], references: [id], onDelete: Restrict)

  @@id([assessmentId, topicId])
  @@map("assessment_topics")
}

model CalendarSlot {
  id        String   @id @default(uuid()) @db.Uuid
  termId    String   @map("term_id") @db.Uuid
  date      DateTime @db.Date
  dayOfWeek String   @map("day_of_week")
  slotType  SlotType @map("slot_type")
  label     String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  term Term @relation(fields: [termId], references: [id], onDelete: Cascade)

  @@unique([termId, date])
  @@map("calendar_slots")
}

model Artifact {
  id               String       @id @default(uuid()) @db.Uuid
  parentType       ParentType   @map("parent_type")
  sessionId        String?      @map("session_id") @db.Uuid
  assessmentId     String?      @map("assessment_id") @db.Uuid
  learningModuleId String?      @map("learning_module_id") @db.Uuid
  artifactType     ArtifactType @map("artifact_type")
  filename         String
  template         String?
  generatedAt      DateTime?    @map("generated_at")
  metadata         Json?        @db.JsonB
  createdAt        DateTime     @default(now()) @map("created_at")
  updatedAt        DateTime     @updatedAt @map("updated_at")

  session        Session?        @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  assessment     Assessment?     @relation(fields: [assessmentId], references: [id], onDelete: SetNull)
  learningModule LearningModule? @relation(fields: [learningModuleId], references: [id], onDelete: SetNull)

  @@map("artifacts")
}
```

### Required service invariants

Some same-course constraints are intentionally enforced by composite foreign keys above. The API/domain layer must additionally reject:

- Coverage whose Topic is not owned by the Session’s Course.
- Assessment–Topic links crossing Course boundaries.
- A Session–Assessment link where the Session is not in the Assessment’s Term.
- A `LearningModuleTopic` self-inconsistent with its Course.
- Topic prerequisite cycles and cross-course prerequisites.
- Term cloning into a different Course.
- Duplicate Topic association or duplicate offering sequence.

These checks should be centralized rather than repeated independently across routes.

## Topic cardinality

Use many-to-many between `LearningModule` and `Topic`, represented by `LearningModuleTopic`.

A one-to-many relationship is too restrictive:

- Recursion, writing, modeling, debugging, or data ethics can recur in several LMs.
- Principle #5 says Topics flow through a semester. Requiring each Topic to have one structural parent would make that flow look artificially confined.
- Principle #7 requires a generic design. Courses organize recurring subjects differently; the schema should not impose a single pedagogical hierarchy.

The association has optional `sequence` for presentation within each LM. `Topic` remains a Course-owned identity, so one Topic has one coverage thread even when it appears in several LMs.

Coverage stays Session↔Topic. `LearningModuleTopic` expresses intended curriculum placement; Coverage expresses actual per-term treatment. This distinction lets the UI show:

- A Topic associated with an adopted LM but never scheduled: a gap.
- A Topic covered under a different adopted LM: cross-LM flow, not lost identity.
- Coverage of a Course Topic absent from any adopted LM: a validation warning, not silent disappearance.

## Why `TermLearningModule` is preferable

### Selected shape

`TermLearningModule` is the per-semester adoption of a stable LM. It owns:

- Term-specific sequence.
- Optional semester-specific planning notes.
- Sessions for that particular offering.

This resolves the lifecycle mismatch cleanly:

- Curriculum identity and reusable prose live on `LearningModule`.
- Semester selection and ordering live on `TermLearningModule`.
- Dates, cancellation, movement, and coverage live below the offering on `Session`.

### Compared with direct Session→LearningModule

A direct reference is simpler by one table, but it cannot represent an adopted LM that has no Sessions yet. That is exactly the kind of planning gap principle #4 says must remain visible.

It also leaves no natural home for:

- Per-term LM order.
- Omitting an LM during one semester.
- Semester-specific LM planning notes.
- Validating that an LM has actually been adopted before Sessions use it.

Adding both `termId` and `learningModuleId` directly to Session would push these rules into repeated query logic and make malformed cross-course combinations easier to create.

### Compared with copying LMs into every Term

Copying preserves historical text automatically, but recreates the current problem:

- Stable curriculum identity disappears.
- Cross-term comparison must guess which copied records correspond.
- Editing reusable curriculum requires repeated updates.
- Cloning continues to duplicate slow-changing structure.

### Historical-edit trade-off

The proposed schema treats edits to LM and Topic definitions as Course-wide edits. Prior Terms continue pointing at those identities, while their actual Sessions, Coverage, and Assessments remain unchanged.

If exact historical prose is required, the right extension is explicit curriculum revisioning or offering snapshots—not silent duplication during cloning. This requires operator sign-off before implementation; see the final section.

## Cloning behavior

Term cloning changes meaning under this design:

- Create the new `Term`.
- Copy `TermLearningModule` adoptions and their ordering.
- Copy Sessions, Coverage, Assessments, and CalendarSlots according to existing rules.
- Reuse the same Course-owned LMs and Topics.
- Clear Session dates and Assessment due dates.
- Preserve `priorArt` links to source Sessions.
- Do not create new LMs or Topics.

This makes cloning a semester-plan operation rather than curriculum duplication.

# Chunked implementation plan

## Chunk 1 — Clean schema rewrite and seed

### Scope

- Replace the existing ownership structure with Course ownership.
- Introduce `Course`, `LearningModule`, `Topic`, `LearningModuleTopic`, `TopicPrerequisite`, `TermLearningModule`, and `AssessmentTopic`.
- Replace `courseCode` with `courseId`.
- Remove `isGlobal` and term-scoped Topic behavior.
- Rewrite the seed and exemplar generator.
- Generate one clean initial migration or reset baseline.
- Add schema validation tests for composite ownership constraints.

### Likely files

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/migrations/`
- `scripts/generate-ds100-exemplar.ts`
- `src/lib/schemas.ts`
- `src/lib/schemas.test.ts`
- `package.json` scripts if reset/seeding commands need adjustment

### Acceptance criteria

- Prisma validation and client generation succeed.
- Every Term belongs to exactly one Course.
- Every LM and Topic belongs to exactly one Course.
- Every Session belongs to exactly one `TermLearningModule`.
- A Term cannot adopt an LM from another Course.
- `isGlobal`, term-level Topic ownership, and the old names no longer exist in generated application types.
- Seed data creates an Instructor, at least two Courses where useful, Terms, reusable LMs, Topics, offerings, Sessions, Coverage, and Assessments.
- Cloning-relevant composite constraints are exercised.
- No migration compatibility code is added.

### Open questions

- Should curriculum definitions be historically versioned or treated as Course-wide live records?
- Should `archivedAt` ship immediately, or should deletion simply be restricted?
- Confirm whether `Course.title` is required in addition to `Course.code`.

## Chunk 2 — Domain logic, imports, cloning, and shared types

### Scope

- Rename all domain-facing Skill concepts to Topic.
- Update coverage ordering, health, what-if, redistribution, and flow assembly.
- Add centralized ownership validation.
- Rewrite term loading and cloning for offerings.
- Change structure/CSV import so curriculum import targets a Course and schedule import targets a Term.
- Decide whether one combined import may atomically create missing Course curriculum plus a Term plan.
- Update typed API contracts and mocks.

### Likely files

- `src/domain/coverage-rules.ts` and tests
- `src/domain/coverage-matrix.ts` and tests
- `src/domain/whatif.ts` and tests
- `src/app/terms/[id]/flow/flow-utils.ts` and tests
- `src/lib/api-client.ts`
- `src/lib/term-data.ts`
- `src/lib/schemas.ts`
- `src/app/api/terms/[id]/clone/route.ts`
- `src/app/api/terms/[id]/import-structure/route.ts`
- `src/app/api/terms/[id]/import-skills-csv/route.ts`
- `src/services/interfaces/ai-planner.ts`
- `src/services/mocks/mock-ai-planner.ts` and tests

### Acceptance criteria

- Domain APIs use `Topic`, `topicId`, `topics`, `LearningModule`, and `termLearningModule`.
- Coverage health still excludes canceled Sessions.
- I→P→A ordering is term-specific and follows offering sequence then Session sequence.
- Topic flow remains one thread across multiple LMs.
- Redistribution cannot target a Session outside the same Term.
- Imports cannot attach curriculum owned by another Instructor or Course.
- Term cloning reuses Course curriculum and creates fresh offerings and semester records.
- Existing what-if and gap behavior remains covered by renamed tests.

### Open questions

- Should Course curriculum import and Term scheduling import become two explicit formats?
- If a Topic is covered in a Session whose LM lacks an association to that Topic, should the action warn or fail? Recommendation: warn, because cross-LM flow is legitimate and generic.

## Chunk 3 — REST routes

### Scope

Introduce and rename CRUD endpoints:

- `/api/courses`
- `/api/courses/[id]`
- `/api/courses/[id]/learning-modules`
- `/api/learning-modules/[id]`
- `/api/courses/[id]/topics`
- `/api/topics/[id]`
- `/api/terms/[id]/learning-modules`
- `/api/term-learning-modules/[id]`
- Existing Session, Coverage, Assessment, import, clone, impact, and what-if endpoints updated to the new identifiers.

Remove the old LM and Skill endpoint paths rather than retaining aliases.

### Likely files

- `src/app/api/courses/**`
- `src/app/api/learning-modules/**`
- `src/app/api/topics/**`
- `src/app/api/term-learning-modules/**`
- `src/app/api/terms/**`
- `src/app/api/sessions/**`
- `src/app/api/coverages/**`
- `src/app/api/assessments/**`
- `src/app/api/ai/suggest-redistribution/route.ts`
- `src/lib/api-helpers.ts`
- Route tests throughout those directories

### Acceptance criteria

- Every route derives the authenticated Instructor and verifies the full ownership chain.
- Cross-course identifiers return 404 or the repository-standard authorization response.
- Creating a Session requires an offering identifier, not a Course-level LM identifier alone.
- Creating Coverage accepts `topicId`.
- Assessment payloads accept `topicIds`.
- No compatibility aliases for old endpoint names remain.
- Route tests cover cross-course rejection, omitted-LM terms, and an adopted LM with no Sessions.
- Zod schema → handler → API client parameters are wired end to end.

### Open questions

- Whether nested create routes should be canonical while top-level detail routes remain available. Recommendation: nested collection routes plus top-level item routes.
- Whether removing an adopted LM containing Sessions should fail or require an explicit destructive confirmation. Recommendation: fail until Sessions are moved or deleted.

## Chunk 4 — Course workspace and term UI

### Scope

- Add Course listing, creation, detail, LM management, and Topic management.
- Make the homepage Course-first, with Terms grouped below each Course.
- Update Term creation to select a Course.
- Add an LM adoption/reordering surface on Term pages.
- Update breadcrumbs and all content views.
- Rename the flow view and coverage matrix language from Skills to Topics.
- Ensure gaps include adopted curriculum structure with no scheduled Sessions.

### Likely files

- `src/app/page.tsx`
- `src/app/courses/**`
- `src/app/topics/**`
- `src/app/terms/**`
- `src/components/Breadcrumbs.tsx`
- `src/components/WhatIfPanel.tsx`
- `src/components/CoverageBadge.tsx`
- `src/components/flow/**`
- `src/lib/api-client.ts`
- E2E navigation and planning tests

Suggested page paths:

- `/courses/[courseId]`
- `/courses/[courseId]/learning-modules/[learningModuleId]`
- `/courses/[courseId]/topics/[topicId]`
- `/terms/[termId]/learning-modules/[termLearningModuleId]`
- `/terms/[termId]/sessions/[sessionId]`

### Acceptance criteria

- An instructor can define curriculum before creating a Term.
- A Term can adopt any subset of its Course’s LMs.
- An adopted LM with zero Sessions is visibly identified as a planning gap.
- A Topic associated with multiple LMs appears as one flow row.
- Flow columns are grouped by term offering, ordered by offering sequence.
- Coverage matrix contains Course Topics relevant to the adopted curriculum, including uncovered Topics.
- Course and Term contexts are visually distinct.
- UI types come from the shared API client; pages do not add duplicate local domain interfaces.
- The old browser, labels, paths, and filters are absent.

### Open questions

- Should the coverage matrix show every Course Topic or only Topics associated with adopted LMs? Recommendation: adopted-LM Topics by default, with an “all Course Topics” filter.
- Should semester-specific offering notes be exposed in the first UI pass? Recommendation: yes, as lightweight planning notes.

## Chunk 5 — Exports, artifacts, documentation, and integrated verification

### Scope

- Update all export data loading and public wording.
- Update artifact parenting to `learningModuleId`.
- Refresh architecture and design documentation.
- Update examples, README material, historical roadmap language where it describes current architecture, and future roadmap entries.
- Run unit, route, type, lint, build, and E2E verification.

### Likely files

On the current branch:

- `src/services/interfaces/artifact-exporter.ts`
- `src/services/mocks/mock-artifact-exporter.ts` and tests
- `src/app/api/artifacts/**`
- `ARCHITECTURE.md`
- `ASSUMPTIONS.md`
- `docs/design-principles.md`
- `docs/phase-roadmap.md`
- `README.md`
- `ROADMAP.md`
- `docs/prompts/**` only where still treated as live guidance

After reconciling `feat/6-external-exports`:

- `src/services/export-data.ts`
- `src/services/exporters.ts`
- Export route tests and UI controls
- Learning Module overview exporter
- Term summary exporter
- Session prompt exporter

### Acceptance criteria

- Term summary identifies `Course.code` and `Course.title`; it does not read `Term.courseCode`.
- Learning Module overview loads Course-owned curriculum and, when invoked from a Term, the selected offering’s Sessions.
- Session prompt includes Course, Term, LM offering, Topic coverage, and adjacent per-term Sessions.
- Topic codes/descriptions replace Skill fields throughout exports.
- Artifact parent validation accepts exactly one valid parent and uses `learningModuleId`.
- Principle #5 uses Topic wording and preserves the horizontal-flow mental model.
- Architecture diagrams show Course ownership and the offering boundary.
- Assumptions supersede global/term-scoped Skill decisions explicitly.
- The phase roadmap records the restructure and the sharing roadmap note below.
- Search checks find no stale old route segments, old type names, `isGlobal`, `courseCode`, or legacy database table references in live code.
- Full verification passes against a newly seeded database.

### Open questions

- Whether Learning Module overview export is Course-level, Term-level, or supports both. Recommendation: Course-level curriculum plus an optional offering context; a term-specific download should always identify the Term.
- Whether historical prompt files should be rewritten. Recommendation: preserve them as historical records with a short “superseded terminology” notice, while all live docs use the new terminology.

# Breakage inventory

## Database and seed

- Instructor currently owns Terms directly.
- `Term.courseCode` disappears.
- The existing LM record changes ownership and table name.
- Skill records, global visibility, term scoping, and raw UUID prerequisite arrays disappear.
- Session ownership changes to `TermLearningModule`.
- Coverage and Assessment joins change to Topic.
- Artifact’s unresolved LM foreign key becomes a real relation.
- All seed and exemplar identifiers must be rebuilt.

## Domain logic

- Coverage ordering currently uses `moduleSequence`; it must use offering sequence.
- Coverage matrix row types and health helpers use Skill names.
- What-if results, violations, redistribution inputs, and mock messages use Skill names.
- Flow data structures, filters, summaries, CSS labels, tests, and links use Skill names.
- `term-data.ts` expects Terms to contain copied LMs and globally/locally selected Skills.

## Imports and cloning

- Structure import currently creates LMs inside a Term.
- CSV import currently creates term-scoped Skills.
- Term cloning currently deep-copies LMs.
- Clone source/target validation currently permits instructor overrides inconsistent with the new ownership chain.
- Import payload examples and validation messages use the old vocabulary.

## Routes and client contracts

- `/api/modules/**` becomes `/api/learning-modules/**`.
- `/api/skills/**` becomes `/api/topics/**`.
- Course CRUD and offering CRUD are new.
- All `moduleId`, `skillId`, `modules`, and `skills` DTO fields change.
- Term create/update schemas and client types replace `courseCode` with `courseId`.
- Assessment payloads replace `skillIds` with `topicIds`.
- Artifact payloads replace `moduleId` with `learningModuleId`.

## UI

- Homepage and Term list currently treat each Term as an independent course-like object.
- Term dashboard LM cards currently read copied Term children.
- Calendar color grouping currently derives from LM sequence instead of offering sequence.
- LM detail currently mixes reusable curriculum and semester Sessions.
- Coverage, flow, assessment, import, impact, and detail pages use old labels and types.
- Breadcrumbs currently assume `Term > LM > Session`; the UI needs both Course curriculum and Term offering paths.
- Topic browser must be Course-scoped, never application-wide.
- Empty-cell and redistribution controls need offering-aware Session targets.

## Exports

The active checkout contains the mock exporter; the export implementation exists on `feat/6-external-exports` and must be reconciled before this work ships.

- Term summary reads `courseCode`.
- Learning Module overview assumes the LM owns Sessions directly.
- Session prompt assumes the Session’s LM is Term-owned.
- All three use Skill terminology and fields.
- Filenames and route names contain old path terminology.
- Export DTOs and tests encode old ownership.
- Learning Module artifacts must distinguish reusable curriculum content from a term-specific offering export.

## Documentation

At minimum:

- `ARCHITECTURE.md`: directory tree, relationship diagram, ownership, domain rules, routes, and content-view descriptions.
- `ASSUMPTIONS.md`: supersede Instructor→Term ownership, global Skills, term-scoped imports, cloning behavior, ordering rules, LM notes, and flow terminology.
- `docs/design-principles.md`: update principles #1, #4, #5, and #7 where old terminology appears.
- `docs/phase-roadmap.md`: delivered model descriptions, 2A imports, 2B views, 2C exports, history/search wording, and roadmap note.
- `README.md` and `ROADMAP.md`: current capabilities and entity list.
- Historical prompts: mark terminology as superseded rather than silently presenting them as current instructions.
- DS-100 reference prose and helper scripts: update live generated labels where they feed the application.

Suggested replacement for principle #5:

> **Topics flow through the semester.** A Course is not a flat list of Sessions. Topics are introduced, practiced, and assessed across Sessions in a specific order. A Topic may recur across several Learning Modules; its flow remains one continuous thread across the Term. Sessions are the dated nodes through which that thread passes, and Coverage levels show its I → P → A progression. When a Session is canceled, the workspace should show exactly which Topic threads lose unique coverage and where.

# Roadmap note

> ## Intentional curriculum sharing — future
>
> Course, Topic, and Learning Module records are private to the Instructor who creates them. A future phase may add explicit, opt-in sharing of selected curriculum with another Instructor. Sharing must never imply application-wide visibility or automatic access across instructors or courses. The permission, copy/reference, revocation, and collaborative-editing mechanisms are intentionally outside the current redesign.

# Decisions ready to document without further sign-off

- `Course` owns Terms, LMs, and Topics.
- `Term.courseCode` is replaced by `courseId`.
- `isGlobal` is removed with no replacement visibility tier.
- `TermLearningModule` is the semester adoption boundary.
- Sessions belong to `TermLearningModule`.
- Per-term LM ordering lives on `TermLearningModule`.
- Topic↔LM is many-to-many.
- Coverage remains Session↔Topic.
- Assessment↔Topic remains many-to-many under the new name.
- Topic prerequisites use a self-referential join rather than an unvalidated UUID array.
- Term cloning reuses Course curriculum and copies semester-specific records.
- Cross-instructor sharing and a future action/competency `Skill` entity remain outside scope.
- Old route aliases and compatibility shims should not be retained.
- The database should be wiped and reseeded.

# Decisions requiring operator sign-off

1. **Historical curriculum semantics.** Recommended initial rule: editing LM or Topic prose updates that Course curriculum everywhere, including prior Terms; Sessions, Coverage, and Assessments remain historical. If exact past wording is required, add explicit curriculum revisions or offering snapshots before implementation.

2. **Deletion versus archiving.** Recommended: ship `archivedAt` for Course, LM, and Topic; restrict deletion once curriculum has been adopted or used. Confirm whether hard deletion should remain available for never-used records.

3. **Coverage-matrix Topic population.** Recommended: default to Topics associated with adopted LMs, with an “all Course Topics” option. Showing every Course Topic unconditionally could make intentionally omitted curriculum look like a semester gap.

4. **Out-of-association Coverage.** Recommended: allow a Course Topic to be covered in any Session from that Course, but display a warning when it is not associated with that Session’s LM. Failing the write would conflict with cross-LM flow and generic course design.

5. **Import boundary.** Recommended: separate reusable Course curriculum import from Term schedule import, while permitting a transactional “create curriculum and first offering” workflow for initial setup.

6. **Learning Module export context.** Recommended: Course-level curriculum is the base document; invoking it from a Term adds offering-specific Sessions and clearly labels the Term.

7. **Issue tracking identifier.** The actual GitHub issue number for `Skill → Topic` must be verified before the implementation prompt is published. It could not be retrieved during this run, and no number should be assumed.
