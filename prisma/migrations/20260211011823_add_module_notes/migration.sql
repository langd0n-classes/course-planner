-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('lecture', 'lab');

-- CreateEnum
CREATE TYPE "CoverageLevel" AS ENUM ('introduced', 'practiced', 'assessed');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('gaie', 'assignment', 'exam', 'project');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('scheduled', 'canceled', 'moved');

-- CreateEnum
CREATE TYPE "SlotType" AS ENUM ('class_day', 'holiday', 'finals', 'break_day');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('notebook', 'handout', 'slides', 'ta_key', 'other');

-- CreateEnum
CREATE TYPE "ParentType" AS ENUM ('session', 'assessment', 'module');

-- CreateTable
CREATE TABLE "instructors" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terms" (
    "id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "course_code" TEXT NOT NULL,
    "meeting_pattern" JSONB,
    "holidays" JSONB,
    "cloned_from_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL,
    "term_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "learning_objectives" TEXT[],
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "prerequisites" UUID[],
    "is_global" BOOLEAN NOT NULL DEFAULT true,
    "term_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "session_type" "SessionType" NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE,
    "description" TEXT,
    "format" TEXT,
    "prior_art" UUID[],
    "notes" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'scheduled',
    "canceled_at" TIMESTAMP(3),
    "canceled_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
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
    "session_id" UUID,
    "due_date" DATE,
    "rubric" JSONB,
    "progression_stage" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_skills" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,

    CONSTRAINT "assessment_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_slots" (
    "id" UUID NOT NULL,
    "term_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "day_of_week" TEXT NOT NULL,
    "slot_type" "SlotType" NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" UUID NOT NULL,
    "parent_type" "ParentType" NOT NULL,
    "session_id" UUID,
    "assessment_id" UUID,
    "module_id" UUID,
    "artifact_type" "ArtifactType" NOT NULL,
    "filename" TEXT NOT NULL,
    "template" TEXT,
    "generated_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instructors_email_key" ON "instructors"("email");

-- CreateIndex
CREATE UNIQUE INDEX "coverages_session_id_skill_id_level_key" ON "coverages"("session_id", "skill_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_skills_assessment_id_skill_id_key" ON "assessment_skills"("assessment_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_slots_term_id_date_key" ON "calendar_slots"("term_id", "date");

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms" ADD CONSTRAINT "terms_cloned_from_id_fkey" FOREIGN KEY ("cloned_from_id") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverages" ADD CONSTRAINT "coverages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverages" ADD CONSTRAINT "coverages_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_skills" ADD CONSTRAINT "assessment_skills_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_skills" ADD CONSTRAINT "assessment_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_slots" ADD CONSTRAINT "calendar_slots_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
