/*
  Warnings:

  - Changed the type of `assessment_type` on the `assessments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TermStatus" AS ENUM ('planned', 'active', 'closed');

-- CreateEnum
CREATE TYPE "InstructionalCapacity" AS ENUM ('normal', 'reduced_engagement', 'recovery', 'assessment_period');

-- CreateEnum
CREATE TYPE "CapacitySource" AS ENUM ('baseline', 'heuristic', 'instructor_override');

-- CreateEnum
CREATE TYPE "InstructionalMode" AS ENUM ('standard', 'recovery', 'review', 'buffer', 'assessment', 'other');

-- AlterTable
ALTER TABLE "assessments" DROP COLUMN "assessment_type",
ADD COLUMN     "assessment_type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "calendar_slots" ADD COLUMN     "capacity_reason" TEXT,
ADD COLUMN     "capacity_source" "CapacitySource" NOT NULL DEFAULT 'baseline',
ADD COLUMN     "instructional_capacity" "InstructionalCapacity" NOT NULL DEFAULT 'normal';

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "instructional_mode" "InstructionalMode" NOT NULL DEFAULT 'standard';

-- AlterTable
ALTER TABLE "terms" ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "status" "TermStatus" NOT NULL DEFAULT 'planned';

-- DropEnum
DROP TYPE "AssessmentType";
