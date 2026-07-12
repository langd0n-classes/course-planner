-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('term_start', 'term_end', 'holiday', 'break_day', 'reading_day', 'finals_start', 'finals_end', 'other');

-- CreateEnum
CREATE TYPE "CalendarOverrideAction" AS ENUM ('add', 'replace', 'suppress');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('lecture', 'lab');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('scheduled', 'canceled', 'moved');

-- CreateEnum
CREATE TYPE "CoverageLevel" AS ENUM ('introduced', 'practiced', 'assessed');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('gaie', 'assignment', 'exam', 'project');

-- CreateEnum
CREATE TYPE "SlotType" AS ENUM ('class_day', 'holiday', 'finals', 'break_day');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('notebook', 'handout', 'slides', 'instructions', 'dataset', 'reading', 'video', 'link', 'ta_key', 'other');

-- CreateEnum
CREATE TYPE "ArtifactSourceType" AS ENUM ('external_uri', 'uploaded_file', 'generated_file');

-- CreateEnum
CREATE TYPE "ArtifactParentType" AS ENUM ('learning_module_version', 'topic_version', 'session', 'assessment');

-- CreateTable
CREATE TABLE "instructors" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "next_course_serial" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "canonical_uri" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_institutions" (
    "instructor_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'active',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructor_institutions_pkey" PRIMARY KEY ("instructor_id","institution_id")
);

-- CreateTable
CREATE TABLE "academic_calendars" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "academic_year" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source_uri" TEXT,
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_calendar_events" (
    "id" UUID NOT NULL,
    "academic_calendar_id" UUID NOT NULL,
    "event_type" "CalendarEventType" NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "source_uri" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_calendar_overrides" (
    "id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "academic_calendar_id" UUID NOT NULL,
    "academic_calendar_event_id" UUID,
    "action" "CalendarOverrideAction" NOT NULL,
    "event_type" "CalendarEventType",
    "starts_on" DATE,
    "ends_on" DATE,
    "label" TEXT,
    "reason" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructor_calendar_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "short_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_is_placeholder" BOOLEAN NOT NULL DEFAULT false,
    "number" TEXT NOT NULL,
    "number_is_placeholder" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_institutions" (
    "course_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_institutions_pkey" PRIMARY KEY ("course_id","institution_id")
);

-- CreateTable
CREATE TABLE "learning_modules" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "current_version_id" UUID,
    "stable_code" TEXT NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_module_versions" (
    "id" UUID NOT NULL,
    "learning_module_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "student_description" TEXT,
    "learning_objectives" TEXT[],
    "notes" TEXT,
    "default_sequence" INTEGER,
    "change_summary" TEXT,
    "created_by_instructor_id" UUID NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_module_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "learning_module_id" UUID,
    "current_version_id" UUID,
    "stable_code" TEXT NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_versions" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "change_summary" TEXT,
    "created_by_instructor_id" UUID NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_module_version_topics" (
    "learning_module_version_id" UUID NOT NULL,
    "topic_version_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "learning_module_version_topics_pkey" PRIMARY KEY ("learning_module_version_id","topic_version_id")
);

-- CreateTable
CREATE TABLE "topic_prerequisites" (
    "topic_id" UUID NOT NULL,
    "prerequisite_topic_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,

    CONSTRAINT "topic_prerequisites_pkey" PRIMARY KEY ("topic_id","prerequisite_topic_id")
);

-- CreateTable
CREATE TABLE "terms" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "academic_calendar_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "meeting_pattern" JSONB,
    "cloned_from_id" UUID,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "term_learning_modules" (
    "id" UUID NOT NULL,
    "term_id" UUID NOT NULL,
    "learning_module_id" UUID NOT NULL,
    "learning_module_version_id" UUID NOT NULL,
    "delivered_learning_module_version_id" UUID,
    "course_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "term_learning_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "term_id" UUID NOT NULL,
    "term_learning_module_id" UUID,
    "sequence" INTEGER NOT NULL,
    "session_type" "SessionType" NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE,
    "description" TEXT,
    "format" TEXT,
    "notes" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'scheduled',
    "canceled_at" TIMESTAMP(3),
    "canceled_reason" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_prior_art" (
    "session_id" UUID NOT NULL,
    "source_session_id" UUID NOT NULL,
    "note" TEXT,

    CONSTRAINT "session_prior_art_pkey" PRIMARY KEY ("session_id","source_session_id")
);

-- CreateTable
CREATE TABLE "coverages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "topic_version_id" UUID NOT NULL,
    "level" "CoverageLevel" NOT NULL,
    "notes" TEXT,
    "redistributed_from" UUID,
    "redistributed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coverages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL,
    "term_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assessment_type" "AssessmentType" NOT NULL,
    "description" TEXT,
    "student_instructions" TEXT,
    "session_id" UUID,
    "due_date" DATE,
    "rubric" JSONB,
    "progression_stage" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_topics" (
    "assessment_id" UUID NOT NULL,
    "topic_version_id" UUID NOT NULL,

    CONSTRAINT "assessment_topics_pkey" PRIMARY KEY ("assessment_id","topic_version_id")
);

-- CreateTable
CREATE TABLE "calendar_slots" (
    "id" UUID NOT NULL,
    "term_id" UUID NOT NULL,
    "academic_calendar_event_id" UUID,
    "date" DATE NOT NULL,
    "slot_type" "SlotType" NOT NULL,
    "label" TEXT,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" UUID NOT NULL,
    "parent_type" "ArtifactParentType" NOT NULL,
    "learning_module_version_id" UUID,
    "topic_version_id" UUID,
    "session_id" UUID,
    "assessment_id" UUID,
    "artifact_type" "ArtifactType" NOT NULL,
    "source_type" "ArtifactSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "filename" TEXT,
    "mime_type" TEXT,
    "generator_key" TEXT,
    "generated_at" TIMESTAMP(3),
    "metadata" JSONB,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instructors_email_key" ON "instructors"("email");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_name_key" ON "institutions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "academic_calendars_institution_id_academic_year_version_key" ON "academic_calendars"("institution_id", "academic_year", "version");

-- CreateIndex
CREATE UNIQUE INDEX "academic_calendars_id_institution_id_key" ON "academic_calendars"("id", "institution_id");

-- CreateIndex
CREATE INDEX "academic_calendar_events_academic_calendar_id_starts_on_idx" ON "academic_calendar_events"("academic_calendar_id", "starts_on");

-- CreateIndex
CREATE INDEX "instructor_calendar_overrides_instructor_id_academic_calend_idx" ON "instructor_calendar_overrides"("instructor_id", "academic_calendar_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_instructor_id_short_id_key" ON "courses"("instructor_id", "short_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_id_instructor_id_key" ON "courses"("id", "instructor_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_modules_current_version_id_key" ON "learning_modules"("current_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_modules_course_id_stable_code_key" ON "learning_modules"("course_id", "stable_code");

-- CreateIndex
CREATE UNIQUE INDEX "learning_modules_id_course_id_key" ON "learning_modules"("id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_module_versions_learning_module_id_revision_key" ON "learning_module_versions"("learning_module_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "learning_module_versions_id_learning_module_id_key" ON "learning_module_versions"("id", "learning_module_id");

-- CreateIndex
CREATE UNIQUE INDEX "topics_current_version_id_key" ON "topics"("current_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "topics_course_id_stable_code_key" ON "topics"("course_id", "stable_code");

-- CreateIndex
CREATE UNIQUE INDEX "topics_id_course_id_key" ON "topics"("id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "topic_versions_topic_id_revision_key" ON "topic_versions"("topic_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "topic_versions_id_topic_id_key" ON "topic_versions"("id", "topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_module_version_topics_learning_module_version_id_s_key" ON "learning_module_version_topics"("learning_module_version_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "terms_course_id_code_key" ON "terms"("course_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "terms_id_course_id_key" ON "terms"("id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "term_learning_modules_term_id_learning_module_id_key" ON "term_learning_modules"("term_id", "learning_module_id");

-- CreateIndex
CREATE UNIQUE INDEX "term_learning_modules_term_id_sequence_key" ON "term_learning_modules"("term_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "term_learning_modules_id_term_id_key" ON "term_learning_modules"("id", "term_id");

-- CreateIndex
CREATE INDEX "sessions_term_learning_module_id_sequence_idx" ON "sessions"("term_learning_module_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_term_id_code_key" ON "sessions"("term_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "coverages_session_id_topic_version_id_level_key" ON "coverages"("session_id", "topic_version_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_term_id_code_key" ON "assessments"("term_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_slots_term_id_date_key" ON "calendar_slots"("term_id", "date");

-- CreateIndex
CREATE INDEX "artifacts_learning_module_version_id_idx" ON "artifacts"("learning_module_version_id");

-- CreateIndex
CREATE INDEX "artifacts_topic_version_id_idx" ON "artifacts"("topic_version_id");

-- CreateIndex
CREATE INDEX "artifacts_session_id_idx" ON "artifacts"("session_id");

-- CreateIndex
CREATE INDEX "artifacts_assessment_id_idx" ON "artifacts"("assessment_id");

-- AddForeignKey
ALTER TABLE "instructor_institutions" ADD CONSTRAINT "instructor_institutions_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_institutions" ADD CONSTRAINT "instructor_institutions_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_calendars" ADD CONSTRAINT "academic_calendars_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_calendar_events" ADD CONSTRAINT "academic_calendar_events_academic_calendar_id_fkey" FOREIGN KEY ("academic_calendar_id") REFERENCES "academic_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_calendar_overrides" ADD CONSTRAINT "instructor_calendar_overrides_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_calendar_overrides" ADD CONSTRAINT "instructor_calendar_overrides_academic_calendar_id_fkey" FOREIGN KEY ("academic_calendar_id") REFERENCES "academic_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_calendar_overrides" ADD CONSTRAINT "instructor_calendar_overrides_academic_calendar_event_id_fkey" FOREIGN KEY ("academic_calendar_event_id") REFERENCES "academic_calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_institutions" ADD CONSTRAINT "course_institutions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_institutions" ADD CONSTRAINT "course_institutions_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_modules" ADD CONSTRAINT "learning_modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_modules" ADD CONSTRAINT "learning_modules_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "learning_module_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_module_versions" ADD CONSTRAINT "learning_module_versions_learning_module_id_fkey" FOREIGN KEY ("learning_module_id") REFERENCES "learning_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_module_versions" ADD CONSTRAINT "learning_module_versions_created_by_instructor_id_fkey" FOREIGN KEY ("created_by_instructor_id") REFERENCES "instructors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_learning_module_id_course_id_fkey" FOREIGN KEY ("learning_module_id", "course_id") REFERENCES "learning_modules"("id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "topic_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_versions" ADD CONSTRAINT "topic_versions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_versions" ADD CONSTRAINT "topic_versions_created_by_instructor_id_fkey" FOREIGN KEY ("created_by_instructor_id") REFERENCES "instructors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_module_version_topics" ADD CONSTRAINT "learning_module_version_topics_learning_module_version_id_fkey" FOREIGN KEY ("learning_module_version_id") REFERENCES "learning_module_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_module_version_topics" ADD CONSTRAINT "learning_module_version_topics_topic_version_id_fkey" FOREIGN KEY ("topic_version_id") REFERENCES "topic_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_prerequisites" ADD CONSTRAINT "topic_prerequisites_topic_id_course_id_fkey" FOREIGN KEY ("topic_id", "course_id") REFERENCES "topics"("id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_prerequisites" ADD CONSTRAINT "topic_prerequisites_prerequisite_topic_id_course_id_fkey" FOREIGN KEY ("prerequisite_topic_id", "course_id") REFERENCES "topics"("id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_academic_calendar_id_institution_id_fkey" FOREIGN KEY ("academic_calendar_id", "institution_id") REFERENCES "academic_calendars"("id", "institution_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_cloned_from_id_course_id_fkey" FOREIGN KEY ("cloned_from_id", "course_id") REFERENCES "terms"("id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "term_learning_modules" ADD CONSTRAINT "term_learning_modules_term_id_course_id_fkey" FOREIGN KEY ("term_id", "course_id") REFERENCES "terms"("id", "course_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "term_learning_modules" ADD CONSTRAINT "term_learning_modules_learning_module_id_course_id_fkey" FOREIGN KEY ("learning_module_id", "course_id") REFERENCES "learning_modules"("id", "course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "term_learning_modules" ADD CONSTRAINT "term_learning_modules_learning_module_version_id_learning__fkey" FOREIGN KEY ("learning_module_version_id", "learning_module_id") REFERENCES "learning_module_versions"("id", "learning_module_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "term_learning_modules" ADD CONSTRAINT "term_learning_modules_delivered_learning_module_version_id_fkey" FOREIGN KEY ("delivered_learning_module_version_id", "learning_module_id") REFERENCES "learning_module_versions"("id", "learning_module_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_term_learning_module_id_term_id_fkey" FOREIGN KEY ("term_learning_module_id", "term_id") REFERENCES "term_learning_modules"("id", "term_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_prior_art" ADD CONSTRAINT "session_prior_art_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_prior_art" ADD CONSTRAINT "session_prior_art_source_session_id_fkey" FOREIGN KEY ("source_session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverages" ADD CONSTRAINT "coverages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverages" ADD CONSTRAINT "coverages_topic_version_id_fkey" FOREIGN KEY ("topic_version_id") REFERENCES "topic_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_topics" ADD CONSTRAINT "assessment_topics_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_topics" ADD CONSTRAINT "assessment_topics_topic_version_id_fkey" FOREIGN KEY ("topic_version_id") REFERENCES "topic_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_slots" ADD CONSTRAINT "calendar_slots_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_slots" ADD CONSTRAINT "calendar_slots_academic_calendar_event_id_fkey" FOREIGN KEY ("academic_calendar_event_id") REFERENCES "academic_calendar_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_learning_module_version_id_fkey" FOREIGN KEY ("learning_module_version_id") REFERENCES "learning_module_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_topic_version_id_fkey" FOREIGN KEY ("topic_version_id") REFERENCES "topic_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
