CREATE TYPE "ActivityBehaviorFamily" AS ENUM ('meeting', 'coursework', 'assessment');
CREATE TYPE "MilestoneRole" AS ENUM ('release', 'work', 'phase_release', 'review', 'due');
CREATE TYPE "AcademicCalendarPeriodKind" AS ENUM ('instructional', 'no_instruction', 'special_schedule');
CREATE TYPE "TermMilestoneAnchorPolicy" AS ENUM ('follow_activity', 'fixed_instant', 'standalone');
CREATE TYPE "TermCalendarExceptionAction" AS ENUM ('cancel', 'add', 'replace', 'modify');

ALTER TYPE "ArtifactParentType" ADD VALUE 'activity_version';
ALTER TYPE "ArtifactParentType" ADD VALUE 'term_activity_revision';

ALTER TABLE "academic_calendars"
ADD COLUMN "current_version_id" UUID;

ALTER TABLE "academic_calendar_events"
ADD COLUMN "academic_calendar_version_id" UUID;

ALTER TABLE "terms"
ADD COLUMN "academic_calendar_version_id" UUID;

ALTER TABLE "artifacts"
ADD COLUMN "activity_version_id" UUID;

ALTER TABLE "artifacts"
ADD COLUMN "term_activity_revision_id" UUID;

CREATE TABLE "academic_calendar_versions" (
  "id" UUID NOT NULL,
  "academic_calendar_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "academic_year" TEXT NOT NULL,
  "source_uri" TEXT,
  "published_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "academic_calendar_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_calendar_periods" (
  "id" UUID NOT NULL,
  "academic_calendar_version_id" UUID NOT NULL,
  "kind" "AcademicCalendarPeriodKind" NOT NULL,
  "label" TEXT NOT NULL,
  "starts_on" DATE NOT NULL,
  "ends_on" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "academic_calendar_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_types" (
  "id" UUID NOT NULL,
  "instructor_id" UUID NOT NULL,
  "current_version_id" UUID,
  "behavior_family" "ActivityBehaviorFamily" NOT NULL,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "activity_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_type_versions" (
  "id" UUID NOT NULL,
  "activity_type_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "change_summary" TEXT,
  "created_by_instructor_id" UUID NOT NULL,
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "activity_type_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "course_activity_type_versions" (
  "course_id" UUID NOT NULL,
  "activity_type_version_id" UUID NOT NULL,
  "enabled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "course_activity_type_versions_pkey" PRIMARY KEY ("course_id", "activity_type_version_id")
);

CREATE TABLE "activities" (
  "id" UUID NOT NULL,
  "course_id" UUID NOT NULL,
  "current_version_id" UUID,
  "stable_code" TEXT NOT NULL,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_versions" (
  "id" UUID NOT NULL,
  "activity_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "activity_type_version_id" UUID NOT NULL,
  "change_summary" TEXT,
  "created_by_instructor_id" UUID NOT NULL,
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "activity_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meeting_activity_versions" (
  "activity_version_id" UUID NOT NULL,
  "default_duration_minutes" INTEGER,
  "modality" TEXT,
  "preparation_notes" TEXT,
  "authoring_notes" TEXT,

  CONSTRAINT "meeting_activity_versions_pkey" PRIMARY KEY ("activity_version_id")
);

CREATE TABLE "coursework_activity_versions" (
  "activity_version_id" UUID NOT NULL,
  "submission_policy" TEXT,
  "release_policy" TEXT,
  "authoring_notes" TEXT,

  CONSTRAINT "coursework_activity_versions_pkey" PRIMARY KEY ("activity_version_id")
);

CREATE TABLE "assessment_activity_versions" (
  "activity_version_id" UUID NOT NULL,
  "modality" TEXT,
  "authoring_notes" TEXT,

  CONSTRAINT "assessment_activity_versions_pkey" PRIMARY KEY ("activity_version_id")
);

CREATE TABLE "learning_module_version_activities" (
  "id" UUID NOT NULL,
  "learning_module_version_id" UUID NOT NULL,
  "activity_version_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "learning_module_version_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_version_learning_module_scopes" (
  "id" UUID NOT NULL,
  "activity_version_id" UUID NOT NULL,
  "learning_module_id" UUID NOT NULL,
  "emphasis" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "activity_version_learning_module_scopes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_version_topic_actions" (
  "id" UUID NOT NULL,
  "activity_version_id" UUID NOT NULL,
  "topic_version_id" UUID NOT NULL,
  "action" "CoverageLevel" NOT NULL,
  "notes" TEXT,
  "provenance" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "activity_version_topic_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_topic_scopes" (
  "id" UUID NOT NULL,
  "activity_id" UUID NOT NULL,
  "topic_id" UUID NOT NULL,
  "notes" TEXT,
  "provenance" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "activity_topic_scopes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_version_milestone_templates" (
  "id" UUID NOT NULL,
  "activity_version_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "role" "MilestoneRole" NOT NULL,
  "label" TEXT NOT NULL,
  "linked_activity_id" UUID,
  "relative_days" INTEGER,
  "default_time" TEXT,
  "time_zone" TEXT,
  "notes" TEXT,
  "provenance" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "activity_version_milestone_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "term_activities" (
  "id" UUID NOT NULL,
  "term_id" UUID NOT NULL,
  "course_id" UUID NOT NULL,
  "activity_id" UUID NOT NULL,
  "planned_activity_version_id" UUID NOT NULL,
  "activity_type_version_id" UUID NOT NULL,
  "adopted_label" TEXT NOT NULL,
  "term_learning_module_id" UUID,
  "ordinal" INTEGER,
  "lifecycle_state" TEXT,
  "planned_revision_id" UUID,
  "delivered_revision_id" UUID,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "term_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "term_activity_revisions" (
  "id" UUID NOT NULL,
  "term_activity_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "base_activity_version_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "change_reason" TEXT,
  "created_by_instructor_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "term_activity_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "term_meeting_activity_revisions" (
  "term_activity_revision_id" UUID NOT NULL,
  "calendar_slot_id" UUID,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "status" TEXT,
  "modality" TEXT,
  "override_reason" TEXT,
  "override_evidence" JSONB,

  CONSTRAINT "term_meeting_activity_revisions_pkey" PRIMARY KEY ("term_activity_revision_id")
);

CREATE TABLE "term_coursework_activity_revisions" (
  "term_activity_revision_id" UUID NOT NULL,
  "lifecycle_state" TEXT,
  "delivery_notes" TEXT,

  CONSTRAINT "term_coursework_activity_revisions_pkey" PRIMARY KEY ("term_activity_revision_id")
);

CREATE TABLE "term_assessment_activity_revisions" (
  "term_activity_revision_id" UUID NOT NULL,
  "lifecycle_state" TEXT,
  "modality" TEXT,
  "delivery_notes" TEXT,

  CONSTRAINT "term_assessment_activity_revisions_pkey" PRIMARY KEY ("term_activity_revision_id")
);

CREATE TABLE "term_activity_revision_topic_actions" (
  "id" UUID NOT NULL,
  "term_activity_revision_id" UUID NOT NULL,
  "topic_version_id" UUID NOT NULL,
  "action" "CoverageLevel" NOT NULL,
  "notes" TEXT,
  "provenance" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "term_activity_revision_topic_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "term_activity_milestones" (
  "id" UUID NOT NULL,
  "term_activity_revision_id" UUID NOT NULL,
  "source_template_id" UUID,
  "role" "MilestoneRole" NOT NULL,
  "label" TEXT NOT NULL,
  "linked_term_activity_id" UUID,
  "occurs_at" TIMESTAMP(3),
  "time_zone" TEXT,
  "anchor_policy" "TermMilestoneAnchorPolicy" NOT NULL,
  "notes" TEXT,
  "provenance" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "term_activity_milestones_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "term_activity_milestones_anchor_policy_check" CHECK (
    ("anchor_policy" = 'follow_activity' AND "linked_term_activity_id" IS NOT NULL)
    OR ("anchor_policy" = 'fixed_instant' AND "occurs_at" IS NOT NULL)
    OR ("anchor_policy" = 'standalone' AND "occurs_at" IS NOT NULL AND "linked_term_activity_id" IS NULL)
  )
);

CREATE TABLE "term_meeting_patterns" (
  "id" UUID NOT NULL,
  "term_id" UUID NOT NULL,
  "activity_type_version_id" UUID NOT NULL,
  "label" TEXT,
  "days_of_week" TEXT[],
  "start_time_local" TEXT NOT NULL,
  "end_time_local" TEXT,
  "time_zone" TEXT NOT NULL,
  "starts_on" DATE NOT NULL,
  "ends_on" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "term_meeting_patterns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "term_calendar_exceptions" (
  "id" UUID NOT NULL,
  "term_id" UUID NOT NULL,
  "action" "TermCalendarExceptionAction" NOT NULL,
  "activity_type_version_id" UUID,
  "calendar_slot_id" UUID,
  "target_date" DATE,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "label" TEXT,
  "reason" TEXT,
  "provenance" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "term_calendar_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_calendar_versions_academic_calendar_id_version_key"
ON "academic_calendar_versions"("academic_calendar_id", "version");

CREATE UNIQUE INDEX "academic_calendar_versions_id_academic_calendar_id_key"
ON "academic_calendar_versions"("id", "academic_calendar_id");

CREATE INDEX "calendar_periods_version_start_idx"
ON "academic_calendar_periods"("academic_calendar_version_id", "starts_on");

CREATE UNIQUE INDEX "academic_calendars_current_version_id_key"
ON "academic_calendars"("current_version_id");

CREATE UNIQUE INDEX "activity_types_current_version_id_key"
ON "activity_types"("current_version_id");

CREATE UNIQUE INDEX "activity_types_id_instructor_id_key"
ON "activity_types"("id", "instructor_id");

CREATE INDEX "activity_types_instructor_id_behavior_family_idx"
ON "activity_types"("instructor_id", "behavior_family");

CREATE UNIQUE INDEX "activity_type_versions_activity_type_id_revision_key"
ON "activity_type_versions"("activity_type_id", "revision");

CREATE UNIQUE INDEX "activity_type_versions_id_activity_type_id_key"
ON "activity_type_versions"("id", "activity_type_id");

CREATE UNIQUE INDEX "activities_current_version_id_key"
ON "activities"("current_version_id");

CREATE UNIQUE INDEX "activities_course_id_stable_code_key"
ON "activities"("course_id", "stable_code");

CREATE UNIQUE INDEX "activities_id_course_id_key"
ON "activities"("id", "course_id");

CREATE UNIQUE INDEX "activity_versions_activity_id_revision_key"
ON "activity_versions"("activity_id", "revision");

CREATE UNIQUE INDEX "activity_versions_id_activity_id_key"
ON "activity_versions"("id", "activity_id");

CREATE INDEX "activity_versions_activity_type_version_id_idx"
ON "activity_versions"("activity_type_version_id");

CREATE INDEX "artifacts_activity_version_idx"
ON "artifacts"("activity_version_id");

CREATE INDEX "artifacts_term_revision_idx"
ON "artifacts"("term_activity_revision_id");

CREATE UNIQUE INDEX "lm_version_activities_version_activity_key"
ON "learning_module_version_activities"("learning_module_version_id", "activity_version_id");

CREATE UNIQUE INDEX "lm_version_activities_version_sequence_key"
ON "learning_module_version_activities"("learning_module_version_id", "sequence");

CREATE INDEX "learning_module_version_activities_activity_version_id_idx"
ON "learning_module_version_activities"("activity_version_id");

CREATE UNIQUE INDEX "activity_lm_scopes_version_module_key"
ON "activity_version_learning_module_scopes"("activity_version_id", "learning_module_id");

CREATE UNIQUE INDEX "activity_topic_actions_version_topic_action_key"
ON "activity_version_topic_actions"("activity_version_id", "topic_version_id", "action");

CREATE INDEX "activity_version_topic_actions_topic_version_id_idx"
ON "activity_version_topic_actions"("topic_version_id");

CREATE UNIQUE INDEX "activity_topic_scopes_activity_id_topic_id_key"
ON "activity_topic_scopes"("activity_id", "topic_id");

CREATE UNIQUE INDEX "activity_milestones_version_sequence_key"
ON "activity_version_milestone_templates"("activity_version_id", "sequence");

CREATE INDEX "activity_version_milestone_templates_linked_activity_id_idx"
ON "activity_version_milestone_templates"("linked_activity_id");

CREATE UNIQUE INDEX "term_activities_term_id_activity_id_key"
ON "term_activities"("term_id", "activity_id");

CREATE UNIQUE INDEX "term_activities_planned_revision_id_key"
ON "term_activities"("planned_revision_id");

CREATE UNIQUE INDEX "term_activities_delivered_revision_id_key"
ON "term_activities"("delivered_revision_id");

CREATE INDEX "term_activities_term_id_activity_type_version_id_ordinal_idx"
ON "term_activities"("term_id", "activity_type_version_id", "ordinal");

CREATE INDEX "term_activities_term_learning_module_id_ordinal_idx"
ON "term_activities"("term_learning_module_id", "ordinal");

CREATE UNIQUE INDEX "term_activity_revisions_term_activity_id_revision_key"
ON "term_activity_revisions"("term_activity_id", "revision");

CREATE INDEX "term_meeting_activity_revisions_calendar_slot_id_idx"
ON "term_meeting_activity_revisions"("calendar_slot_id");

CREATE UNIQUE INDEX "term_revision_topic_action_key"
ON "term_activity_revision_topic_actions"("term_activity_revision_id", "topic_version_id", "action");

CREATE INDEX "term_activity_revision_topic_actions_topic_version_id_idx"
ON "term_activity_revision_topic_actions"("topic_version_id");

CREATE INDEX "term_activity_milestones_linked_term_activity_id_idx"
ON "term_activity_milestones"("linked_term_activity_id");

CREATE INDEX "term_activity_milestones_occurs_at_idx"
ON "term_activity_milestones"("occurs_at");

CREATE INDEX "term_meeting_patterns_type_start_idx"
ON "term_meeting_patterns"("term_id", "activity_type_version_id", "starts_on");

CREATE INDEX "term_calendar_exceptions_term_id_target_date_idx"
ON "term_calendar_exceptions"("term_id", "target_date");

CREATE INDEX "term_calendar_exceptions_calendar_slot_id_idx"
ON "term_calendar_exceptions"("calendar_slot_id");

CREATE INDEX "calendar_events_version_start_idx"
ON "academic_calendar_events"("academic_calendar_version_id", "starts_on");

ALTER TABLE "academic_calendar_versions"
ADD CONSTRAINT "academic_calendar_versions_academic_calendar_id_fkey"
FOREIGN KEY ("academic_calendar_id") REFERENCES "academic_calendars"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "academic_calendar_periods"
ADD CONSTRAINT "academic_calendar_periods_academic_calendar_version_id_fkey"
FOREIGN KEY ("academic_calendar_version_id") REFERENCES "academic_calendar_versions"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "activity_types"
ADD CONSTRAINT "activity_types_instructor_id_fkey"
FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "activity_type_versions"
ADD CONSTRAINT "activity_type_versions_activity_type_id_fkey"
FOREIGN KEY ("activity_type_id") REFERENCES "activity_types"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "activity_type_versions"
ADD CONSTRAINT "activity_type_versions_created_by_instructor_id_fkey"
FOREIGN KEY ("created_by_instructor_id") REFERENCES "instructors"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "course_activity_type_versions"
ADD CONSTRAINT "course_activity_type_versions_course_id_fkey"
FOREIGN KEY ("course_id") REFERENCES "courses"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "course_activity_type_versions"
ADD CONSTRAINT "course_activity_type_versions_activity_type_version_id_fkey"
FOREIGN KEY ("activity_type_version_id") REFERENCES "activity_type_versions"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "activities"
ADD CONSTRAINT "activities_course_id_fkey"
FOREIGN KEY ("course_id") REFERENCES "courses"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "activity_versions"
ADD CONSTRAINT "activity_versions_activity_id_fkey"
FOREIGN KEY ("activity_id") REFERENCES "activities"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "activity_versions"
ADD CONSTRAINT "activity_versions_activity_type_version_id_fkey"
FOREIGN KEY ("activity_type_version_id") REFERENCES "activity_type_versions"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "activity_versions"
ADD CONSTRAINT "activity_versions_created_by_instructor_id_fkey"
FOREIGN KEY ("created_by_instructor_id") REFERENCES "instructors"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "meeting_activity_versions"
ADD CONSTRAINT "meeting_activity_versions_activity_version_id_fkey"
FOREIGN KEY ("activity_version_id") REFERENCES "activity_versions"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "coursework_activity_versions"
ADD CONSTRAINT "coursework_activity_versions_activity_version_id_fkey"
FOREIGN KEY ("activity_version_id") REFERENCES "activity_versions"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "assessment_activity_versions"
ADD CONSTRAINT "assessment_activity_versions_activity_version_id_fkey"
FOREIGN KEY ("activity_version_id") REFERENCES "activity_versions"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "learning_module_version_activities"
ADD CONSTRAINT "lm_version_activities_version_fkey"
FOREIGN KEY ("learning_module_version_id") REFERENCES "learning_module_versions"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "learning_module_version_activities"
ADD CONSTRAINT "learning_module_version_activities_activity_version_id_fkey"
FOREIGN KEY ("activity_version_id") REFERENCES "activity_versions"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "activity_version_learning_module_scopes"
ADD CONSTRAINT "activity_lm_scopes_version_fkey"
FOREIGN KEY ("activity_version_id") REFERENCES "activity_versions"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "activity_version_learning_module_scopes"
ADD CONSTRAINT "activity_version_learning_module_scopes_learning_module_id_fkey"
FOREIGN KEY ("learning_module_id") REFERENCES "learning_modules"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "activity_version_topic_actions"
ADD CONSTRAINT "activity_version_topic_actions_activity_version_id_fkey"
FOREIGN KEY ("activity_version_id") REFERENCES "activity_versions"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "activity_version_topic_actions"
ADD CONSTRAINT "activity_version_topic_actions_topic_version_id_fkey"
FOREIGN KEY ("topic_version_id") REFERENCES "topic_versions"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "activity_topic_scopes"
ADD CONSTRAINT "activity_topic_scopes_activity_id_fkey"
FOREIGN KEY ("activity_id") REFERENCES "activities"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "activity_topic_scopes"
ADD CONSTRAINT "activity_topic_scopes_topic_id_fkey"
FOREIGN KEY ("topic_id") REFERENCES "topics"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "activity_version_milestone_templates"
ADD CONSTRAINT "activity_version_milestone_templates_activity_version_id_fkey"
FOREIGN KEY ("activity_version_id") REFERENCES "activity_versions"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "activity_version_milestone_templates"
ADD CONSTRAINT "activity_version_milestone_templates_linked_activity_id_fkey"
FOREIGN KEY ("linked_activity_id") REFERENCES "activities"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "term_activities"
ADD CONSTRAINT "term_activities_term_id_course_id_fkey"
FOREIGN KEY ("term_id", "course_id") REFERENCES "terms"("id", "course_id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "term_activities"
ADD CONSTRAINT "term_activities_activity_id_course_id_fkey"
FOREIGN KEY ("activity_id", "course_id") REFERENCES "activities"("id", "course_id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "term_activities"
ADD CONSTRAINT "term_activities_planned_activity_version_id_activity_id_fkey"
FOREIGN KEY ("planned_activity_version_id", "activity_id") REFERENCES "activity_versions"("id", "activity_id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "term_activities"
ADD CONSTRAINT "term_activities_activity_type_version_id_fkey"
FOREIGN KEY ("activity_type_version_id") REFERENCES "activity_type_versions"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "term_activities"
ADD CONSTRAINT "term_activities_term_learning_module_id_term_id_fkey"
FOREIGN KEY ("term_learning_module_id", "term_id") REFERENCES "term_learning_modules"("id", "term_id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "term_activity_revisions"
ADD CONSTRAINT "term_activity_revisions_term_activity_id_fkey"
FOREIGN KEY ("term_activity_id") REFERENCES "term_activities"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "term_activity_revisions"
ADD CONSTRAINT "term_activity_revisions_base_activity_version_id_fkey"
FOREIGN KEY ("base_activity_version_id") REFERENCES "activity_versions"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "term_activity_revisions"
ADD CONSTRAINT "term_activity_revisions_created_by_instructor_id_fkey"
FOREIGN KEY ("created_by_instructor_id") REFERENCES "instructors"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "term_meeting_activity_revisions"
ADD CONSTRAINT "term_meeting_activity_revisions_term_activity_revision_id_fkey"
FOREIGN KEY ("term_activity_revision_id") REFERENCES "term_activity_revisions"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "term_meeting_activity_revisions"
ADD CONSTRAINT "term_meeting_activity_revisions_calendar_slot_id_fkey"
FOREIGN KEY ("calendar_slot_id") REFERENCES "calendar_slots"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "term_coursework_activity_revisions"
ADD CONSTRAINT "term_coursework_revisions_revision_fkey"
FOREIGN KEY ("term_activity_revision_id") REFERENCES "term_activity_revisions"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "term_assessment_activity_revisions"
ADD CONSTRAINT "term_assessment_revisions_revision_fkey"
FOREIGN KEY ("term_activity_revision_id") REFERENCES "term_activity_revisions"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "term_activity_revision_topic_actions"
ADD CONSTRAINT "term_revision_topic_actions_revision_fkey"
FOREIGN KEY ("term_activity_revision_id") REFERENCES "term_activity_revisions"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "term_activity_revision_topic_actions"
ADD CONSTRAINT "term_activity_revision_topic_actions_topic_version_id_fkey"
FOREIGN KEY ("topic_version_id") REFERENCES "topic_versions"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "term_activity_milestones"
ADD CONSTRAINT "term_activity_milestones_term_activity_revision_id_fkey"
FOREIGN KEY ("term_activity_revision_id") REFERENCES "term_activity_revisions"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "term_activity_milestones"
ADD CONSTRAINT "term_activity_milestones_source_template_id_fkey"
FOREIGN KEY ("source_template_id") REFERENCES "activity_version_milestone_templates"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "term_activity_milestones"
ADD CONSTRAINT "term_activity_milestones_linked_term_activity_id_fkey"
FOREIGN KEY ("linked_term_activity_id") REFERENCES "term_activities"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "term_meeting_patterns"
ADD CONSTRAINT "term_meeting_patterns_term_id_fkey"
FOREIGN KEY ("term_id") REFERENCES "terms"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "term_meeting_patterns"
ADD CONSTRAINT "term_meeting_patterns_activity_type_version_id_fkey"
FOREIGN KEY ("activity_type_version_id") REFERENCES "activity_type_versions"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "term_calendar_exceptions"
ADD CONSTRAINT "term_calendar_exceptions_term_id_fkey"
FOREIGN KEY ("term_id") REFERENCES "terms"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "term_calendar_exceptions"
ADD CONSTRAINT "term_calendar_exceptions_activity_type_version_id_fkey"
FOREIGN KEY ("activity_type_version_id") REFERENCES "activity_type_versions"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "term_calendar_exceptions"
ADD CONSTRAINT "term_calendar_exceptions_calendar_slot_id_fkey"
FOREIGN KEY ("calendar_slot_id") REFERENCES "calendar_slots"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "academic_calendars"
ADD CONSTRAINT "academic_calendars_current_version_id_fkey"
FOREIGN KEY ("current_version_id") REFERENCES "academic_calendar_versions"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "academic_calendar_events"
ADD CONSTRAINT "calendar_event_version_fkey"
FOREIGN KEY ("academic_calendar_version_id", "academic_calendar_id")
REFERENCES "academic_calendar_versions"("id", "academic_calendar_id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "activity_types"
ADD CONSTRAINT "activity_types_current_version_id_fkey"
FOREIGN KEY ("current_version_id") REFERENCES "activity_type_versions"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "activities"
ADD CONSTRAINT "activities_current_version_id_fkey"
FOREIGN KEY ("current_version_id") REFERENCES "activity_versions"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "term_activities"
ADD CONSTRAINT "term_activities_planned_revision_id_fkey"
FOREIGN KEY ("planned_revision_id") REFERENCES "term_activity_revisions"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "term_activities"
ADD CONSTRAINT "term_activities_delivered_revision_id_fkey"
FOREIGN KEY ("delivered_revision_id") REFERENCES "term_activity_revisions"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "artifacts"
ADD CONSTRAINT "artifacts_activity_version_fkey"
FOREIGN KEY ("activity_version_id") REFERENCES "activity_versions"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "artifacts"
ADD CONSTRAINT "artifacts_term_revision_fkey"
FOREIGN KEY ("term_activity_revision_id") REFERENCES "term_activity_revisions"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "terms"
ADD CONSTRAINT "terms_academic_calendar_version_id_academic_calendar_id_fkey"
FOREIGN KEY ("academic_calendar_version_id", "academic_calendar_id")
REFERENCES "academic_calendar_versions"("id", "academic_calendar_id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
