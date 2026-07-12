# Course/LearningModule/Topic architecture redesign v2 — gpt-5.6-sol

Read-only design pass (`gpt-5.6-sol`, 2026-07-11T20:16:01-04:00), not implementation.
Supersedes docs/plans/course-lm-topic-redesign.md (v1) per operator
feedback (~/tmp/course-planner-redesign-feedback.md). Incorporates real
web research on the Blackboard/Anthology course-package format. Review
section 8 ("Decisions requiring operator sign-off") before converting
this into a build prompt.

---

# Course/Learning Module/Topic architecture redesign — v2

This v2 explicitly supersedes `docs/plans/course-lm-topic-redesign.md`. Where the two designs conflict, v2 governs. No migration path is proposed: the database may be wiped and reseeded.

No repository files were modified. The required trace is at `/tmp/TRACE_LOG.codex-sol-course-redesign-v2-2026-07-11T20_08_26-0400`.

## 1. Summary of changes from v1

- Topic↔Learning Module changes from many-to-many to one-to-many: every current Topic belongs to exactly one Learning Module. `LearningModuleTopic` is removed.
- Learning Modules and Topics gain immutable revisions. Historical Terms pin the exact Learning Module and Topic versions delivered.
- Institution and institution-owned Academic Calendar become first-class concepts. Instructor-specific calendar exceptions layer over shared institutional truth.
- Courses remain Instructor-owned but can be associated with multiple Institutions. Every Term chooses one of those Institutions.
- `Course.code` is removed. Course identity becomes required title, required/displayable number with placeholder support, and a system-generated per-Instructor short ID.
- Artifacts use URIs and storage/source types, supporting Google Slides and other remote material as well as uploaded or generated files.
- Archive and hard removal become distinct actions. Archiving is normal; hard removal is an exceptional guarded operation.
- Learning Modules and Topics can be cloned across Courses as independent forks. Cross-Course Term cloning remains blocked.
- Term cloning reuses pinned curriculum versions and shifts dates through the target Academic Calendar and meeting pattern.
- The vague v1 import boundary is replaced by five separate workflows.
- Blackboard package export is based on researched IMS Content Packaging/Common Cartridge behavior and requires compatibility fixtures rather than invented Blackboard internals.
- Historical docs/prompts get a lightweight version-history index, not merely a terminology banner.

## 2. Updated model

```text
Instructor
├── InstructorInstitution ── Institution
│                            └── AcademicCalendar
│                                ├── AcademicCalendarEvent
│                                └── InstructorCalendarOverride
└── Course
    ├── CourseInstitution ── Institution
    ├── LearningModule
    │   ├── LearningModuleVersion
    │   │   └── LearningModuleVersionTopic ── TopicVersion
    │   └── Topic
    │       └── TopicVersion
    └── Term
        ├── Institution
        ├── AcademicCalendar
        ├── TermLearningModule ── LearningModuleVersion
        │   └── Session
        │       └── Coverage ── TopicVersion
        ├── Assessment
        │   └── AssessmentTopic ── TopicVersion
        └── CalendarSlot
```

### Versioning decision

Use stable identity records plus append-only version records.

- `LearningModule` and `Topic` are stable identities used for URLs, cloning, archive state, and current ownership.
- `LearningModuleVersion` and `TopicVersion` contain editable curriculum prose.
- Editing creates a new version and atomically advances `currentVersionId`; published versions are never updated in place.
- `LearningModuleVersionTopic` snapshots which Topic versions composed a Learning Module version and their order.
- `TermLearningModule.learningModuleVersionId` pins the adopted Learning Module version.
- Coverage and assessment alignment point to `TopicVersion`, not merely the current Topic.
- The pinned Learning Module version exposes uncovered Topic versions even when no Coverage exists.

A Topic’s current `learningModuleId` enforces the requested one-Learning-Module cardinality. Historical placement is preserved by `LearningModuleVersionTopic`, so moving a Topic to another Learning Module creates new versions without rewriting past Terms.

### Proposed Prisma schema

This is the complete proposed shape for the redesigned and directly affected models. Existing authentication infrastructure remains separate.

```prisma
enum MembershipStatus {
  active
  inactive
}

enum CalendarEventType {
  term_start
  term_end
  holiday
  break_day
  reading_day
  finals_start
  finals_end
  other
}

enum CalendarOverrideAction {
  add
  replace
  suppress
}

enum SessionType {
  lecture
  lab
}

enum SessionStatus {
  scheduled
  canceled
  moved
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
  instructions
  dataset
  reading
  video
  link
  ta_key
  other
}

enum ArtifactSourceType {
  external_uri
  uploaded_file
  generated_file
}

enum ArtifactParentType {
  learning_module_version
  topic_version
  session
  assessment
}

model Instructor {
  id                  String   @id @default(uuid()) @db.Uuid
  name                String
  email               String   @unique
  nextCourseSerial    Int      @default(1) @map("next_course_serial")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  courses             Course[]
  institutions        InstructorInstitution[]
  calendarOverrides   InstructorCalendarOverride[]

  @@map("instructors")
}

model Institution {
  id                String   @id @default(uuid()) @db.Uuid
  name              String
  shortName         String?  @map("short_name")
  canonicalUri      String?  @map("canonical_uri")
  archivedAt        DateTime? @map("archived_at")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  instructors       InstructorInstitution[]
  courses           CourseInstitution[]
  terms             Term[]
  academicCalendars AcademicCalendar[]

  @@unique([name])
  @@map("institutions")
}

model InstructorInstitution {
  instructorId String           @map("instructor_id") @db.Uuid
  institutionId String          @map("institution_id") @db.Uuid
  status        MembershipStatus @default(active)
  isDefault     Boolean          @default(false) @map("is_default")
  createdAt     DateTime         @default(now()) @map("created_at")
  updatedAt     DateTime         @updatedAt @map("updated_at")

  instructor  Instructor  @relation(fields: [instructorId], references: [id], onDelete: Cascade)
  institution Institution @relation(fields: [institutionId], references: [id], onDelete: Restrict)

  @@id([instructorId, institutionId])
  @@map("instructor_institutions")
}

model AcademicCalendar {
  id            String    @id @default(uuid()) @db.Uuid
  institutionId String    @map("institution_id") @db.Uuid
  name          String
  academicYear  String    @map("academic_year")
  version       Int       @default(1)
  sourceUri     String?   @map("source_uri")
  publishedAt   DateTime? @map("published_at")
  archivedAt    DateTime? @map("archived_at")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  institution Institution                 @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  events      AcademicCalendarEvent[]
  overrides   InstructorCalendarOverride[]
  terms       Term[]

  @@unique([institutionId, academicYear, version])
  @@unique([id, institutionId])
  @@map("academic_calendars")
}

model AcademicCalendarEvent {
  id                 String            @id @default(uuid()) @db.Uuid
  academicCalendarId String            @map("academic_calendar_id") @db.Uuid
  eventType          CalendarEventType @map("event_type")
  startsOn           DateTime          @map("starts_on") @db.Date
  endsOn             DateTime          @map("ends_on") @db.Date
  label              String
  sourceUri          String?           @map("source_uri")
  createdAt          DateTime          @default(now()) @map("created_at")
  updatedAt          DateTime          @updatedAt @map("updated_at")

  academicCalendar AcademicCalendar @relation(fields: [academicCalendarId], references: [id], onDelete: Cascade)
  overrides        InstructorCalendarOverride[]
  calendarSlots    CalendarSlot[]

  @@index([academicCalendarId, startsOn])
  @@map("academic_calendar_events")
}

model InstructorCalendarOverride {
  id                      String                 @id @default(uuid()) @db.Uuid
  instructorId            String                 @map("instructor_id") @db.Uuid
  academicCalendarId      String                 @map("academic_calendar_id") @db.Uuid
  academicCalendarEventId String?                @map("academic_calendar_event_id") @db.Uuid
  action                  CalendarOverrideAction
  eventType               CalendarEventType?     @map("event_type")
  startsOn                DateTime?              @map("starts_on") @db.Date
  endsOn                  DateTime?              @map("ends_on") @db.Date
  label                   String?
  reason                  String?                @db.Text
  archivedAt              DateTime?              @map("archived_at")
  createdAt               DateTime               @default(now()) @map("created_at")
  updatedAt               DateTime               @updatedAt @map("updated_at")

  instructor            Instructor             @relation(fields: [instructorId], references: [id], onDelete: Cascade)
  academicCalendar      AcademicCalendar       @relation(fields: [academicCalendarId], references: [id], onDelete: Cascade)
  academicCalendarEvent AcademicCalendarEvent? @relation(fields: [academicCalendarEventId], references: [id], onDelete: Cascade)

  @@index([instructorId, academicCalendarId])
  @@map("instructor_calendar_overrides")
}

model Course {
  id                  String    @id @default(uuid()) @db.Uuid
  instructorId        String    @map("instructor_id") @db.Uuid
  shortId             String    @map("short_id")
  title               String
  titleIsPlaceholder  Boolean   @default(false) @map("title_is_placeholder")
  number              String
  numberIsPlaceholder Boolean   @default(false) @map("number_is_placeholder")
  description         String?   @db.Text
  archivedAt          DateTime? @map("archived_at")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  instructor      Instructor          @relation(fields: [instructorId], references: [id], onDelete: Restrict)
  institutions   CourseInstitution[]
  terms          Term[]
  learningModules LearningModule[]
  topics         Topic[]

  @@unique([instructorId, shortId])
  @@unique([id, instructorId])
  @@map("courses")
}

model CourseInstitution {
  courseId      String   @map("course_id") @db.Uuid
  institutionId String   @map("institution_id") @db.Uuid
  createdAt     DateTime @default(now()) @map("created_at")

  course      Course      @relation(fields: [courseId], references: [id], onDelete: Cascade)
  institution Institution @relation(fields: [institutionId], references: [id], onDelete: Restrict)

  @@id([courseId, institutionId])
  @@map("course_institutions")
}

model LearningModule {
  id               String    @id @default(uuid()) @db.Uuid
  courseId         String    @map("course_id") @db.Uuid
  currentVersionId String?   @unique @map("current_version_id") @db.Uuid
  stableCode       String    @map("stable_code")
  archivedAt       DateTime? @map("archived_at")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  course              Course                  @relation(fields: [courseId], references: [id], onDelete: Restrict)
  currentVersion      LearningModuleVersion?  @relation("CurrentLearningModuleVersion", fields: [currentVersionId], references: [id], onDelete: Restrict)
  versions            LearningModuleVersion[] @relation("LearningModuleVersions")
  topics              Topic[]
  termLearningModules TermLearningModule[]

  @@unique([courseId, stableCode])
  @@unique([id, courseId])
  @@map("learning_modules")
}

model LearningModuleVersion {
  id                    String   @id @default(uuid()) @db.Uuid
  learningModuleId      String   @map("learning_module_id") @db.Uuid
  revision              Int
  title                 String
  description           String?  @db.Text
  studentDescription    String?  @map("student_description") @db.Text
  learningObjectives    String[] @map("learning_objectives")
  notes                 String?  @db.Text
  defaultSequence       Int?     @map("default_sequence")
  changeSummary         String?  @map("change_summary") @db.Text
  createdByInstructorId String   @map("created_by_instructor_id") @db.Uuid
  publishedAt           DateTime? @map("published_at")
  createdAt             DateTime @default(now()) @map("created_at")

  learningModule   LearningModule @relation("LearningModuleVersions", fields: [learningModuleId], references: [id], onDelete: Restrict)
  currentFor       LearningModule? @relation("CurrentLearningModuleVersion")
  createdBy        Instructor @relation(fields: [createdByInstructorId], references: [id], onDelete: Restrict)
  topics           LearningModuleVersionTopic[]
  termOfferings    TermLearningModule[]
  artifacts        Artifact[]

  @@unique([learningModuleId, revision])
  @@unique([id, learningModuleId])
  @@map("learning_module_versions")
}

model Topic {
  id               String    @id @default(uuid()) @db.Uuid
  courseId         String    @map("course_id") @db.Uuid
  learningModuleId String    @map("learning_module_id") @db.Uuid
  currentVersionId String?   @unique @map("current_version_id") @db.Uuid
  stableCode       String    @map("stable_code")
  archivedAt       DateTime? @map("archived_at")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  course         Course        @relation(fields: [courseId], references: [id], onDelete: Restrict)
  learningModule LearningModule @relation(fields: [learningModuleId, courseId], references: [id, courseId], onDelete: Restrict)
  currentVersion TopicVersion? @relation("CurrentTopicVersion", fields: [currentVersionId], references: [id], onDelete: Restrict)
  versions       TopicVersion[] @relation("TopicVersions")
  prerequisiteFor TopicPrerequisite[] @relation("PrerequisiteTopic")
  prerequisites   TopicPrerequisite[] @relation("DependentTopic")

  @@unique([courseId, stableCode])
  @@unique([id, courseId])
  @@map("topics")
}

model TopicVersion {
  id                    String   @id @default(uuid()) @db.Uuid
  topicId               String   @map("topic_id") @db.Uuid
  revision              Int
  title                 String
  category              String?
  description           String?  @db.Text
  changeSummary         String?  @map("change_summary") @db.Text
  createdByInstructorId String   @map("created_by_instructor_id") @db.Uuid
  publishedAt           DateTime? @map("published_at")
  createdAt             DateTime @default(now()) @map("created_at")

  topic             Topic @relation("TopicVersions", fields: [topicId], references: [id], onDelete: Restrict)
  currentFor        Topic? @relation("CurrentTopicVersion")
  createdBy         Instructor @relation(fields: [createdByInstructorId], references: [id], onDelete: Restrict)
  learningModules   LearningModuleVersionTopic[]
  coverages         Coverage[]
  assessmentTopics  AssessmentTopic[]
  artifacts         Artifact[]

  @@unique([topicId, revision])
  @@unique([id, topicId])
  @@map("topic_versions")
}

model LearningModuleVersionTopic {
  learningModuleVersionId String @map("learning_module_version_id") @db.Uuid
  topicVersionId          String @map("topic_version_id") @db.Uuid
  sequence                Int

  learningModuleVersion LearningModuleVersion @relation(fields: [learningModuleVersionId], references: [id], onDelete: Restrict)
  topicVersion         TopicVersion          @relation(fields: [topicVersionId], references: [id], onDelete: Restrict)

  @@id([learningModuleVersionId, topicVersionId])
  @@unique([learningModuleVersionId, sequence])
  @@map("learning_module_version_topics")
}

model TopicPrerequisite {
  topicId             String @map("topic_id") @db.Uuid
  prerequisiteTopicId String @map("prerequisite_topic_id") @db.Uuid
  courseId            String @map("course_id") @db.Uuid

  topic Topic @relation("DependentTopic", fields: [topicId, courseId], references: [id, courseId], onDelete: Restrict)
  prerequisiteTopic Topic @relation("PrerequisiteTopic", fields: [prerequisiteTopicId, courseId], references: [id, courseId], onDelete: Restrict)

  @@id([topicId, prerequisiteTopicId])
  @@map("topic_prerequisites")
}

model Term {
  id                 String    @id @default(uuid()) @db.Uuid
  courseId           String    @map("course_id") @db.Uuid
  institutionId      String    @map("institution_id") @db.Uuid
  academicCalendarId String    @map("academic_calendar_id") @db.Uuid
  code               String
  name               String
  startDate          DateTime  @map("start_date") @db.Date
  endDate            DateTime  @map("end_date") @db.Date
  meetingPattern     Json?     @map("meeting_pattern") @db.JsonB
  clonedFromId       String?   @map("cloned_from_id") @db.Uuid
  archivedAt         DateTime? @map("archived_at")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")

  course           Course            @relation(fields: [courseId], references: [id], onDelete: Restrict)
  institution      Institution       @relation(fields: [institutionId], references: [id], onDelete: Restrict)
  academicCalendar AcademicCalendar  @relation(fields: [academicCalendarId, institutionId], references: [id, institutionId], onDelete: Restrict)
  clonedFrom       Term?              @relation("TermClone", fields: [clonedFromId, courseId], references: [id, courseId], onDelete: Restrict)
  clones           Term[]             @relation("TermClone")
  learningModules  TermLearningModule[]
  sessions         Session[]
  assessments      Assessment[]
  calendarSlots    CalendarSlot[]

  @@unique([courseId, code])
  @@unique([id, courseId])
  @@map("terms")
}

model TermLearningModule {
  id                      String   @id @default(uuid()) @db.Uuid
  termId                  String   @map("term_id") @db.Uuid
  learningModuleId        String   @map("learning_module_id") @db.Uuid
  learningModuleVersionId String   @map("learning_module_version_id") @db.Uuid
  courseId                String   @map("course_id") @db.Uuid
  sequence                Int
  notes                   String?  @db.Text
  createdAt               DateTime @default(now()) @map("created_at")
  updatedAt               DateTime @updatedAt @map("updated_at")

  term Term @relation(fields: [termId, courseId], references: [id, courseId], onDelete: Cascade)
  learningModule LearningModule @relation(fields: [learningModuleId, courseId], references: [id, courseId], onDelete: Restrict)
  learningModuleVersion LearningModuleVersion @relation(
    fields: [learningModuleVersionId, learningModuleId],
    references: [id, learningModuleId],
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
  termLearningModuleId String?       @map("term_learning_module_id") @db.Uuid
  sequence             Int
  sessionType          SessionType   @map("session_type")
  code                 String
  title                String
  date                 DateTime?     @db.Date
  description          String?       @db.Text
  format               String?
  notes                String?       @db.Text
  status               SessionStatus @default(scheduled)
  canceledAt           DateTime?     @map("canceled_at")
  canceledReason       String?       @map("canceled_reason") @db.Text
  archivedAt           DateTime?     @map("archived_at")
  createdAt            DateTime      @default(now()) @map("created_at")
  updatedAt            DateTime      @updatedAt @map("updated_at")

  term Term @relation(fields: [termId], references: [id], onDelete: Cascade)
  termLearningModule TermLearningModule? @relation(
    fields: [termLearningModuleId, termId],
    references: [id, termId],
    onDelete: SetNull
  )
  coverages  Coverage[]
  assessments Assessment[]
  artifacts  Artifact[]
  priorArt   SessionPriorArt[] @relation("DerivedSession")
  reusedBy   SessionPriorArt[] @relation("SourceSession")

  @@unique([termId, code])
  @@index([termLearningModuleId, sequence])
  @@map("sessions")
}

model SessionPriorArt {
  sessionId       String @map("session_id") @db.Uuid
  sourceSessionId String @map("source_session_id") @db.Uuid
  note            String? @db.Text

  session       Session @relation("DerivedSession", fields: [sessionId], references: [id], onDelete: Cascade)
  sourceSession Session @relation("SourceSession", fields: [sourceSessionId], references: [id], onDelete: Restrict)

  @@id([sessionId, sourceSessionId])
  @@map("session_prior_art")
}

model Coverage {
  id                String        @id @default(uuid()) @db.Uuid
  sessionId         String        @map("session_id") @db.Uuid
  topicVersionId    String        @map("topic_version_id") @db.Uuid
  level             CoverageLevel
  notes             String?       @db.Text
  redistributedFrom String?       @map("redistributed_from") @db.Uuid
  redistributedAt   DateTime?     @map("redistributed_at")
  createdAt         DateTime      @default(now()) @map("created_at")
  updatedAt         DateTime      @updatedAt @map("updated_at")

  session      Session      @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  topicVersion TopicVersion @relation(fields: [topicVersionId], references: [id], onDelete: Restrict)

  @@unique([sessionId, topicVersionId, level])
  @@map("coverages")
}

model Assessment {
  id               String         @id @default(uuid()) @db.Uuid
  termId           String         @map("term_id") @db.Uuid
  code             String
  title            String
  assessmentType   AssessmentType @map("assessment_type")
  description      String?        @db.Text
  studentInstructions String?     @map("student_instructions") @db.Text
  sessionId        String?        @map("session_id") @db.Uuid
  dueDate          DateTime?      @map("due_date") @db.Date
  rubric           Json?          @db.JsonB
  progressionStage String?        @map("progression_stage")
  archivedAt       DateTime?      @map("archived_at")
  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @updatedAt @map("updated_at")

  term       Term              @relation(fields: [termId], references: [id], onDelete: Cascade)
  session    Session?          @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  topics     AssessmentTopic[]
  artifacts  Artifact[]

  @@unique([termId, code])
  @@map("assessments")
}

model AssessmentTopic {
  assessmentId  String @map("assessment_id") @db.Uuid
  topicVersionId String @map("topic_version_id") @db.Uuid

  assessment  Assessment   @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  topicVersion TopicVersion @relation(fields: [topicVersionId], references: [id], onDelete: Restrict)

  @@id([assessmentId, topicVersionId])
  @@map("assessment_topics")
}

model CalendarSlot {
  id                      String   @id @default(uuid()) @db.Uuid
  termId                  String   @map("term_id") @db.Uuid
  academicCalendarEventId String?  @map("academic_calendar_event_id") @db.Uuid
  date                    DateTime @db.Date
  slotType                SlotType @map("slot_type")
  label                   String?
  source                  String?
  createdAt               DateTime @default(now()) @map("created_at")
  updatedAt               DateTime @updatedAt @map("updated_at")

  term                  Term                   @relation(fields: [termId], references: [id], onDelete: Cascade)
  academicCalendarEvent AcademicCalendarEvent? @relation(fields: [academicCalendarEventId], references: [id], onDelete: SetNull)

  @@unique([termId, date])
  @@map("calendar_slots")
}

model Artifact {
  id                      String             @id @default(uuid()) @db.Uuid
  parentType              ArtifactParentType @map("parent_type")
  learningModuleVersionId String?            @map("learning_module_version_id") @db.Uuid
  topicVersionId          String?            @map("topic_version_id") @db.Uuid
  sessionId               String?            @map("session_id") @db.Uuid
  assessmentId            String?            @map("assessment_id") @db.Uuid
  artifactType            ArtifactType       @map("artifact_type")
  sourceType              ArtifactSourceType @map("source_type")
  title                   String
  uri                     String
  filename                String?
  mimeType                String?            @map("mime_type")
  generatorKey            String?            @map("generator_key")
  generatedAt             DateTime?          @map("generated_at")
  metadata                Json?              @db.JsonB
  archivedAt              DateTime?          @map("archived_at")
  createdAt               DateTime           @default(now()) @map("created_at")
  updatedAt               DateTime           @updatedAt @map("updated_at")

  learningModuleVersion LearningModuleVersion? @relation(fields: [learningModuleVersionId], references: [id], onDelete: Restrict)
  topicVersion          TopicVersion?          @relation(fields: [topicVersionId], references: [id], onDelete: Restrict)
  session               Session?               @relation(fields: [sessionId], references: [id], onDelete: Restrict)
  assessment            Assessment?            @relation(fields: [assessmentId], references: [id], onDelete: Restrict)

  @@index([learningModuleVersionId])
  @@index([topicVersionId])
  @@index([sessionId])
  @@index([assessmentId])
  @@map("artifacts")
}
```

### Schema/service invariants

Prisma cannot express every required constraint, so the service layer must enforce these transactionally:

- Exactly one Artifact parent foreign key is set and it agrees with `parentType`.
- External Artifact URIs must use an allowed URI scheme. Uploaded/generated files use durable object-storage URIs, never process-local paths.
- A Term’s Institution must be linked to its Course and Instructor.
- A Term’s Academic Calendar must belong to its selected Institution.
- If a Course has one Institution, Term creation may auto-select it; with multiple Institutions the UI and API require an explicit selection.
- Course short-ID allocation increments `Instructor.nextCourseSerial` in the same transaction.
- `currentVersionId` must refer to a version of the same identity.
- Published versions are immutable. Corrections create another revision.
- Learning Module version snapshots may contain only Topic versions whose identities belong to that Learning Module and Course at publication time.
- Coverage and AssessmentTopic must use Topic versions from the same Course as the Term.
- Coverage under a Session attached to a different Learning Module version is allowed with a planning warning. This is the replacement for v1’s cross-association question: it represents a deliberate scheduling spillover, not shared Topic ownership.
- Cross-Course Topic prerequisites and cycles fail.
- Cross-Course Term cloning fails.
- Removing a `TermLearningModule` with Sessions fails by default. A separate “detach Sessions, then remove adoption” operation may set their offering reference to null.
- Hard removal fails while any historical version, Term, Coverage, assessment, clone provenance, or Artifact references the target.

### Institution and calendar ownership

The Institution owns the canonical Academic Calendar because holidays and official term boundaries are shared facts, not personal Instructor data.

Instructor customization is a sparse overlay:

1. Start with the selected institution calendar.
2. Apply that Instructor’s additions, replacements, and suppressions.
3. Apply the Term meeting pattern.
4. Materialize course-specific `CalendarSlot` records.
5. Let the Instructor make explicitly labeled Term-specific adjustments.

This avoids copying the same university calendar for every Instructor while still supporting departmental closures, religious observance, travel, or other personal exceptions. Calendar materialization records provenance so an institutional calendar revision can show a preview before changing an existing Term.

### Course identity

- `title` and `number` are nonblank.
- Either may be marked as a placeholder.
- Placeholder generation can suggest “Untitled course” and “1XX,” but the Instructor may provide better placeholder text.
- `shortId` is system-assigned and displayed as `001`, `002`, and so on. It is stable, unique only within one Instructor’s workspace, and never treated as a catalog number.
- Course labels should normally be `042 · DS 1XX · Data Science Foundations`, omitting or marking placeholder components as appropriate.
- Titles and numbers are deliberately not unique.

### Archive versus hard removal

Archive is the ordinary lifecycle action:

- Set `archivedAt`.
- Hide the item from default lists and pickers.
- Preserve URLs, versions, Terms, exports, and history.
- Permit restoration by clearing `archivedAt`.

Hard removal is a separate destructive command:

- Never offered as the primary delete action.
- Requires a destructive confirmation including the exact title/short ID.
- Runs an impact preview first.
- Allowed only for an unreferenced leaf or for an explicitly selected unused graph.
- Never cascades through delivered Terms or published curriculum history.
- Emits an audit event before physical deletion.
- If references exist, the answer is archive, detach, or remove the dependent records explicitly—not an implicit cascade.

## 3. Updated reasoning

### Topic cardinality

The v1 many-to-many argument is retracted.

A Topic now describes one coherent scope within one Learning Module. If substantially deeper treatment is needed, it becomes another Topic—such as “Probability” and “Advanced Probability.” Topic flow is still important, but it flows through Sessions and Terms, not across Learning Modules.

This has useful consequences:

- Learning Module composition is understandable without a cross-link graph.
- Topic order belongs to the Learning Module version snapshot.
- The coverage matrix defaults to the Topic versions in adopted Learning Module versions.
- Historical Terms retain both the precise Topic prose and its Learning Module placement.
- Cross-Learning-Module scheduling is an exceptional warning, not the organizing model.

Suggested replacement for design principle #5:

> **Topics flow through Sessions in the Term.** A Course is not a flat list of Sessions. Each Topic belongs to one Learning Module, but its introduced, practiced, and assessed progression may span multiple Sessions in that Learning Module’s offering. Sessions are the dated nodes through which the Topic flows, and Coverage levels show its I → P → A progression. If a Session is canceled, the workspace should show exactly which Topic progressions lose unique coverage and where. Scheduling a Topic in another Learning Module’s Session is permitted as an explicit, warned exception; it does not change the Topic’s ownership.

Principle #7 remains relevant, but “generic” does not require every relationship to be maximally flexible. Different Courses can define different Topic boundaries while retaining a simple, legible hierarchy.

### Historical delivery

A historical Term must not silently inherit today’s prose.

- `TermLearningModule` pins a `LearningModuleVersion`.
- That version pins an ordered set of `TopicVersion` records.
- Coverage and assessments pin those Topic versions.
- Updating current curriculum does not change past Terms.
- A current Term may explicitly adopt a newer Learning Module version through a reviewed upgrade operation showing added, removed, and changed Topics.

### Cloning

Learning Module or Topic cloning across Courses:

- Copy current content into new identity records and revision `1`.
- Rewrite ownership to the destination Course.
- Allocate destination stable codes.
- Clone selected Artifacts as new references to the same external URI or copied generated/uploaded objects according to an explicit material-copy option.
- Do not keep `clonedFromId` or any live relationship. Audit logs may record the action operationally, but the curriculum model does not expose ancestry or synchronize later edits.

Course cloning uses the same fork semantics but is lower priority.

Term cloning:

- Source and target remain in the same Course.
- Create a new Term with selected Institution, Academic Calendar, and meeting pattern.
- Reuse the exact pinned Learning Module and Topic versions unless the Instructor explicitly chooses “upgrade to current revisions.”
- Generate target CalendarSlots from the target calendar.
- Map source scheduled class meetings to target class meetings by ordinal and meeting role, not by adding a fixed number of days.
- Shift Session dates and assessment due dates relative to mapped meetings.
- Show an unresolved-date report when holidays, breaks, changed meeting frequency, or a shorter target Term prevent a one-to-one mapping.
- Apply only after a what-if preview.

## 4. Five distinct import/export flows

### Blackboard research findings

Anthology documents that Ultra imports course content in bulk from compressed ZIP or IMSCC packages. Imported content appears at the end of the content list; enrollment, discussion activity, and grades are excluded. It does not document selecting one Learning Module from a package during upload. [Anthology: Import Course Packages](https://help.anthology.com/blackboard/instructor/en/course-and-content-management/reuse-content/import-course-packages.html)

Anthology describes Blackboard’s native course package as a ZIP following the IMS Content Packaging specification with Blackboard-specific extensions. It warns that editing or unpacking Blackboard-produced packages can produce unstable results. [Anthology: Export and Import Courses](https://help.anthology.com/blackboard/administrator/en/courses-and-organizations/create-courses/export%2C-archive%2C-and-restore-courses/export-and-import-courses.html)

Ultra’s export workflow exports all course content, alongside such supported elements as rubrics, calendar events, discussions, and gradebook configuration. Imported content is hidden initially. [Anthology: Export and Archive Courses](https://help.anthology.com/blackboard/instructor/en/course-and-content-management/reuse-content/export-and-archive-courses.html)

Blackboard does support copying an individual Learning Module between Courses already present in the same Blackboard environment. That is a Blackboard-side copy operation, not evidence of a standalone Learning Module package format. [Anthology: Copy Content from Other Courses](https://help.anthology.com/blackboard/instructor/en/course-and-content-management/reuse-content/copy-content-from-other-courses.html)

Common Cartridge provides a portable manifest, hierarchy, web content, web links, associated content, and assessments. The version matters to compatibility. [1EdTech Common Cartridge primer](https://www.1edtech.org/standards/cc/cc/primeronCCConformance), [1EdTech Common Cartridge overview](https://www.1edtech.org/standards/cc)

Ultra can convert Word `.docx`, PDF, and PowerPoint files into Blackboard Documents, with a warning that converted content should be reviewed. [Anthology: Documents](https://help.anthology.com/Blackboard/Instructor/en/course-and-content-management/add-content/documents.html)

### Shared package architecture

Implement a `CoursePackageCodec` with explicit profiles:

```ts
interface CoursePackageCodec {
  exportPackage(input: PackageExportInput): Promise<PackageResult>;
  inspectPackage(bytes: Uint8Array): Promise<PackageInspection>;
  importPackage(
    bytes: Uint8Array,
    decisions: PackageImportDecisions,
  ): Promise<PackageImportPreview>;
}

type PackageProfile =
  | "course-planner-lossless"
  | "blackboard-compatible";

type PackageScope =
  | { kind: "course"; courseId: string; termId?: string }
  | { kind: "learning-module"; termLearningModuleId: string };
```

Both profiles use the same package graph and IMS-style ZIP writer. The lossless profile adds namespaced course-planner metadata containing stable IDs, revisions, Topic alignment, source URIs, planning notes, and institution/calendar context. The Blackboard profile includes only tested interoperable projections.

Do not claim arbitrary Blackboard-native round-trip support. Course-planner must import:

- Its own lossless packages.
- The supported Common Cartridge subset.
- A deliberately limited set of Blackboard fixtures established through compatibility testing.

Unknown Blackboard extensions are reported, not guessed.

### 1. Course creation import: syllabus → AI starter plan

Interface:

```ts
interface CourseCreationImporter {
  analyze(input: {
    syllabus: ImportSource;
    instructorId: string;
    institutionId?: string;
    academicCalendarId?: string;
  }): Promise<CourseCreationAnalysis>;

  clarify(
    analysisId: string,
    answers: {
      meetingDays: string[];
      meetingTimes?: string[];
      firstMeeting?: string;
      sessionTypes?: string[];
      excludedDates?: string[];
    },
  ): Promise<CourseCreationDraft>;

  apply(
    draftId: string,
    selections: CourseCreationSelections,
  ): Promise<CourseCreationResult>;
}
```

Flow:

1. Upload a syllabus or provide a URI.
2. Extract proposed Course title/number, Learning Modules, Topics, assessments, policies, dates, and meeting clues.
3. Cross-reference the selected Academic Calendar.
4. Ask the Instructor to confirm institution, meeting days/pattern, first meeting, lab/lecture structure, and ambiguous dates.
5. Produce an editable diff-style draft.
6. Create revision-1 curriculum and a first Term only after confirmation.

This depends on real AI and therefore Phase 9. `MockAiPlanner` may support static UX fixtures but must be labeled “sample extraction”; it must not masquerade as syllabus understanding. Design the interfaces and review UI now, but do not advertise functional syllabus extraction until a real provider is integrated.

`ImportSource` supports either uploaded bytes or URI, addressing remote syllabi.

### 2. Course-planner round-trip import

Purpose: restore, duplicate, or transfer a course-planner Course.

- Accept the lossless package profile.
- Validate checksums, schema version, IDs, revision graph, and Artifact URIs.
- Present choices: create a new independent Course, merge newer revisions into the same Course, or cancel.
- Default to creating an independent fork when ownership or identity does not match.
- Never silently overwrite published revisions.
- Re-importing into the same Course is idempotent by package object ID and revision hash.
- Blackboard-compatible packages can be imported, but they are necessarily lossy and enter through a mapping preview.

### 3. Course-level export → Blackboard

Output: `.imscc`/ZIP using a tested Common Cartridge version and conservative feature subset.

Projection:

- Course/Term title → package metadata.
- Adopted Learning Module versions → top-level organized containers.
- Student-facing Learning Module descriptions → HTML content items.
- Sessions → ordered child content/documents.
- External Artifact URIs → web-link resources.
- Uploaded/generated Artifact files → packaged web content or file resources.
- Assignments/projects → supported assignment representation only after Blackboard fixture validation; otherwise HTML/document plus attached files.
- Topic metadata and Instructor-only notes stay out of student-facing content unless explicitly selected.
- Dates are included only where the selected cartridge/Blackboard fixture demonstrates reliable behavior.
- Everything imports hidden/unavailable by default.

Compatibility strategy:

- Maintain anonymized Blackboard-exported fixture packages for every supported target configuration.
- Inspect manifests and resource types without modifying the fixtures.
- Generate minimal packages from the standards-based writer.
- Import them into a Blackboard sandbox and capture import logs.
- Version the compatibility profile, such as `blackboard-ultra-2026.04`.
- Block export for an untested profile rather than emitting a package likely to fail.

Course-planner’s internal model remains richer than the Blackboard projection. Export therefore produces a report of omitted or downgraded data.

### 4. Learning Module-level export → Blackboard

No researched Anthology documentation establishes a standalone Learning Module course-package import. Ultra documents bulk package import and separately documents individual Learning Module copying between existing Blackboard Courses.

Therefore v2 defines this as:

> A minimal course package whose organization contains exactly one selected Learning Module and its selected descendants.

It uses the same package writer and compatibility profile as Course export, with one Learning Module root. The UI must call it “Learning Module package (experimental until validated),” not imply an Anthology-defined Learning Module package format.

Acceptance requires a Blackboard sandbox test proving that:

- The minimal package imports through “Import Course Content.”
- It creates one coherent Learning Module rather than loose top-level items.
- Ordering, descriptions, links, files, and visibility survive.
- Repeated imports have understood naming/duplication behavior.

If Blackboard does not preserve the container, the supported fallback is a minimal package containing one folder/content hierarchy, clearly disclosed in the export preview.

### 5. Single content item → `.docx`

The existing DS100 marker workflow confirms this use case. Productize it as a reusable renderer rather than a Learning-Module-overview-only exporter:

```ts
interface SingleContentItemExporter {
  exportDocx(input: {
    source:
      | { kind: "learning-module-description"; versionId: string }
      | { kind: "assessment-instructions"; assessmentId: string }
      | { kind: "session-description"; sessionId: string };
    templateId?: string;
  }): Promise<ExportResult>;
}
```

The application should store student-facing content separately from Instructor notes (`studentDescription`, `studentInstructions`) rather than requiring comment delimiters internally. The importer for existing markdown can recognize:

- `<!-- BLACKBOARD ULTRA CONTENT - COPY FROM HERE -->`
- `<!-- END BLACKBOARD CONTENT -->`

The exporter then renders the selected content through a common Markdown/structured-content → DOCX pipeline. Later assignment and project instructions use the same renderer and template mechanism.

This remains compatible with Ultra’s current ability to upload or convert `.docx`, while correctly warning the Instructor to review Blackboard’s conversion.

## 5. Updated implementation plan

### Chunk 1 — Schema baseline, identity, Institutions, and calendars

- Replace current Prisma ownership with Course ownership.
- Add Institution, memberships, CourseInstitution, Academic Calendar, events, overrides, and Term selection.
- Add Course short-ID allocation and placeholder fields.
- Rewrite seed and exemplar generation.
- Add constraint and allocator concurrency tests.

Acceptance:

- Course short IDs are unique per Instructor.
- Term Institution is always valid for Course and Instructor.
- Multiple-Institution Courses require explicit Term selection.
- Academic Calendar and CalendarSlot are visibly distinct.
- No migration compatibility layer is added.

### Chunk 2 — Curriculum revision subsystem

- Add Learning Module/Topic identities and version tables.
- Implement draft/publish/revise/current-version services.
- Add Learning Module version Topic snapshots.
- Make published versions immutable.
- Add revision comparison and upgrade preview domain logic.

Acceptance:

- Historical Terms do not change after current curriculum edits.
- Concurrent revision creation cannot duplicate revision numbers.
- Moving a Topic creates revised snapshots without rewriting history.
- Coverage gaps can be calculated from pinned versions.

### Chunk 3 — Term offerings, Sessions, and cloning

- Add `TermLearningModule`.
- Make Session offering attachment nullable only for deliberate detachment.
- Rewrite Term cloning with target-calendar date mapping.
- Add what-if preview and unresolved-date report.
- Keep cross-Course Term cloning blocked.
- Add independent Topic/Learning Module clone services.

Acceptance:

- Dates shift to actual target class days.
- Holidays and differing meeting counts produce explicit conflicts.
- Source and clone pin the intended curriculum versions.
- Cross-Course curriculum copies share no domain relationship afterward.

### Chunk 4 — Topics, coverage, assessments, and planning rules

- Rename Skill-facing domain objects and APIs to Topic.
- Point Coverage and AssessmentTopic at TopicVersion.
- Update I→P→A ordering and cancellation impact.
- Add the out-of-offering warning.
- Default matrices to pinned Topics in adopted Learning Modules; retain “all Course Topics.”

Acceptance:

- Canceled Sessions remain excluded from coverage health.
- Pinned uncovered Topics remain visible.
- Cross-Course versions fail.
- A warned scheduling spillover remains possible.

### Chunk 5 — Archive/removal and Artifact/material subsystem

- Add archive/restore actions and default filters.
- Add guarded hard-removal impact previews.
- Replace local-only Artifact fields with URI/source metadata.
- Add Topic-version Artifact parenting.
- Replace Session UUID arrays with relational prior-art links.
- Add URI validation, access status, broken-link reporting, and material-copy policies.

Acceptance:

- Google Slides and other remote resources can be attached without pretending they are local files.
- Generated and uploaded files use durable URIs.
- Hard removal cannot erase delivered history.
- Archived records remain resolvable and restorable.

### Chunk 6 — REST contracts and application services

Canonical routes:

- `/api/institutions`
- `/api/academic-calendars`
- `/api/courses`
- `/api/courses/[id]/institutions`
- `/api/courses/[id]/learning-modules`
- `/api/learning-modules/[id]`
- `/api/learning-modules/[id]/versions`
- `/api/courses/[id]/topics`
- `/api/topics/[id]`
- `/api/topics/[id]/versions`
- `/api/terms/[id]/learning-modules`
- `/api/term-learning-modules/[id]`
- top-level item detail routes for Sessions, Coverage, assessments, and Artifacts

Nested collections remain canonical; top-level detail routes remain available, resolving v1’s route question.

Acceptance:

- Authenticated ownership is checked end to end.
- Revision expected-version tokens prevent lost updates.
- Archive and hard removal are separate endpoints/actions.
- No old route aliases remain.

### Chunk 7 — Course and Term workspace UI

- Course-first homepage and multi-Institution indicators.
- Course creation with title/number placeholder controls and generated short ID.
- Institution and Academic Calendar selection during Term creation.
- Revision history, compare, restore-as-new-revision, and offering-upgrade UI.
- Learning Module adoption/reordering and lightweight offering notes.
- Unattached Session recovery panel.
- Updated Topic flow and coverage matrix.

Acceptance:

- Current versus historical revision context is always visible.
- A historical Term never accidentally opens current prose as delivered content.
- Adopted Learning Modules with no Sessions and class days with no Sessions remain prominent gaps.

### Chunk 8 — Syllabus import interface and round-trip packages

- Add `ImportSource`, upload/URI intake, scan status, preview, and conflict decisions.
- Build Phase-9-ready course creation import interfaces.
- Build course-planner lossless package codec.
- Import supported Common Cartridge structures through a mapping preview.
- Add package schema versions, checksums, and idempotency.

Acceptance:

- Mock AI fixtures are clearly labeled.
- Own-package import is lossless and idempotent.
- Unsupported package resources are reported before apply.
- Imports never silently replace published revisions.

### Chunk 9 — Blackboard interoperability

- Build standards-based package projection.
- Establish Blackboard-exported fixtures and sandbox test matrix.
- Implement Course and minimal Learning Module package exports.
- Produce downgrade/omission reports.
- Productize generic single-content-item DOCX export.

Acceptance:

- Course packages import successfully into each declared supported profile.
- Minimal Learning Module behavior is empirically recorded.
- DOCX output matches the student-facing block and excludes Instructor notes.
- Unsupported Blackboard features fail clearly.

### Chunk 10 — Documentation, historical versions, and integrated verification

- Rewrite current architecture, principles, assumptions, roadmap, README, and API documentation.
- Create a docs/prompts version index.
- Mark each historical item current, superseded, archived, or draft.
- Link predecessors/successors and show terminology/schema era.
- Preserve original historical files; corrections are new versions or annotations.
- Run unit, route, type, lint, build, seeded E2E, package validation, and Blackboard sandbox suites.

## 6. Updated breakage inventory

### Database and seeds

- Instructor→Term becomes Instructor→Course→Term.
- `Term.courseCode`, `Module`, Skill, `AssessmentSkill`, `isGlobal`, and raw prerequisite UUID arrays disappear.
- `LearningModuleTopic` proposed in v1 does not ship.
- Learning Module and Topic prose moves into version tables.
- Coverage and assessments change from identity references to Topic-version references.
- Session ownership changes to optional `TermLearningModule`.
- Calendar `holidays` JSON is superseded by Academic Calendar events and overlays.
- Artifact `filename`/`template` assumptions are replaced by URI/source/generator metadata.
- Seed and exemplar IDs must be rebuilt.

### Domain rules

- Every query must distinguish identity, current version, and delivered version.
- Coverage health must load pinned Topic versions.
- Revision publication, comparison, upgrade, and immutability are new.
- Term clone mapping becomes calendar-aware.
- Topic flow can no longer aggregate one Topic across multiple Learning Modules.
- Hard removal needs graph/reference analysis.

### API/client contracts

- All Skill and old Learning Module route names/types change.
- Mutation payloads require revision concurrency fields.
- Term creation gains Institution and Academic Calendar.
- Course creation gains short ID output and placeholder fields.
- Artifact creation requires URI/source type.
- Import becomes job/preview/apply rather than direct JSON insertion.
- Exports gain package profile, scope, and compatibility report.

### UI

- Course selection precedes Term context.
- Multi-Institution Courses require visible Term institution context.
- Curriculum pages need current/revision/history modes.
- Historical Term links must open pinned content.
- Topic browser is Course-scoped and grouped by one Learning Module.
- Archived items need “include archived” and restore controls.
- Hard removal requires impact and typed confirmation.
- Artifact links need remote/open/download distinctions and broken-link states.
- Import UI splits into syllabus creation, package import, and Topic-material intake.

### Import/export

- Existing structure JSON and Skill CSV import cease to be the main product concept.
- Syllabus extraction depends on Phase 9 real AI.
- Course-planner round trip needs canonical lossless metadata.
- Blackboard packages are a tested projection, not a dump of database rows.
- Learning Module package export remains experimental until sandbox validation.
- DOCX export becomes content-item-generic.
- Package imports need ZIP safety: size limits, path traversal prevention, decompression limits, MIME sniffing, and XML entity protection.

### Other remote-material gaps found

The audit found several local/internal assumptions beyond Artifact:

- `Session.priorArt` is an array of internal Session UUIDs, while exemplar prose references filesystem directories and files. The relational replacement handles internal provenance; external prior art should be represented by Artifacts.
- Exemplar “existing materials,” slides, and verification resources are unstructured markdown paths. These should become Topic-, Session-, or Learning-Module-version Artifacts.
- The current import UI only accepts browser-local files via `FileReader`. All new import flows should accept either upload or URI.
- The Academic Calendar has source URLs in reference documents but no persisted source/provenance model. `AcademicCalendar.sourceUri` and event source URIs close that gap.
- Export results currently exist only as in-memory filename/content pairs. Persisted generated exports should receive durable object-storage URIs if retained; one-off downloads do not need Artifact records.
- Assessment rubrics are inline JSON. This is not necessarily a defect, but externally maintained rubrics should be attachable as Assessment Artifacts.
- No other live schema field was found that clearly represents a material while requiring a local filename.

### Documentation

- Current docs must use Course, Learning Module, Topic, offering, revision, Institution, and Academic Calendar terminology.
- Principle #5 must be replaced as above.
- Principle #6 should distinguish institution calendar truth, Instructor overlays, Term CalendarSlots, and Sessions.
- Historical prompts remain untouched in substance and appear in a version index.
- The v1 plan should be listed as superseded by this v2, with a concise change summary.
- A `/docs/versions` index can mirror the Read the Docs idea without building a runtime documentation service:
  - version/era label;
  - status;
  - date;
  - applicable schema revision;
  - predecessor/successor;
  - terminology warning;
  - link to the preserved document.
- Curriculum and docs share the same conceptual rule—published history is immutable and corrections create another revision—but they do not need to share database tables.

## 7. Resolved in this round

- Institution does not own Course.
- Instructor can be linked to multiple Institutions.
- Academic Calendar is institution-owned with Instructor overlays.
- Every Term selects one Institution and Academic Calendar; selection may be automatic only when unambiguous.
- Curriculum definitions are revisioned immediately.
- Historical Terms pin delivered versions.
- Topic belongs to one Learning Module.
- Cross-Learning-Module scheduling becomes a warning, not shared Topic ownership.
- `LearningModuleTopic` is removed.
- Title and display number are nonblank with independent placeholder flags.
- Short Course ID is system-generated and unique per Instructor.
- Term cloning across Courses remains blocked.
- Term cloning shifts dates against the target calendar.
- Topic and Learning Module cross-Course copying creates independent forks.
- Course cloning is allowed later with the same fork semantics.
- Archive is the normal removal experience; guarded hard removal remains separately available.
- Nested collection routes plus top-level detail routes are canonical.
- Learning Module adoption removal fails while Sessions remain attached; explicit detachment is available.
- Coverage matrix defaults to Topics in adopted pinned Learning Module versions, with “all Course Topics.”
- Offering notes ship in the first UI pass.
- Learning Module exports support both Course curriculum and Term-specific contexts, always labeling the Term.
- Historical docs/prompts get a version-history index.
- The five import/export workflows are separate concepts.
- Single-content DOCX export is generalized beyond Learning Module descriptions.
- Blackboard Learning Module package support is not assumed; it is a minimal-package experiment requiring validation.

## 8. Decisions requiring operator sign-off

1. **Three-digit short-ID capacity.**  
   Recommendation: display IDs as three digits while allocating monotonically; after `999`, display `1000` rather than recycling IDs. Strictly limiting the field to three digits creates an unnecessary lifetime cap.

2. **Course number blankness.**  
   Recommendation: follow the operator’s form sketch and require a nonblank display number, using `numberIsPlaceholder=true` for values such as `1XX` or `TBD`. The later phrase “optional number field” conflicts slightly with “never blank”; this design chooses never blank.

3. **Institution catalog governance.**  
   Recommendation: permit Instructor-created Institutions initially, with canonicalization/merge left to administration later. Requiring a centrally curated Institution catalog would add operational work before multi-Institution planning is useful.

4. **Academic Calendar publication policy.**  
   Recommendation: once a calendar is used by a Term, changes publish a new calendar version and existing Terms receive an upgrade preview. Never silently rewrite materialized CalendarSlots.

5. **Blackboard target baseline.**  
   Recommendation: support one explicitly tested Blackboard Ultra SaaS profile first, using a conservative Common Cartridge subset. The operator must identify the actual Blackboard environment/version and provide sandbox import access or import logs before declaring Course or Learning Module package export production-ready.

6. **Remote Artifact access model.**  
   Recommendation: v1 of remote resources stores URI, type, title, and optional metadata only. OAuth-backed Google/OneDrive inspection, permission validation, and link refresh should be a later connector phase; the initial UI should warn that course-planner cannot guarantee student access.
