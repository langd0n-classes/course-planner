CREATE TYPE "EffortScale" AS ENUM ('student', 'grading');

CREATE TABLE "course_effort_sizes" (
  "id" UUID NOT NULL,
  "course_id" UUID NOT NULL,
  "scale" "EffortScale" NOT NULL,
  "label" TEXT NOT NULL,
  "min_minutes" INTEGER NOT NULL,
  "max_minutes" INTEGER NOT NULL,
  "sequence" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "course_effort_sizes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "course_effort_sizes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "course_effort_sizes_range_check" CHECK ("min_minutes" >= 1 AND "max_minutes" >= "min_minutes" AND "max_minutes" <= 60000),
  CONSTRAINT "course_effort_sizes_label_check" CHECK ("label" = btrim("label") AND length("label") > 0)
);
CREATE UNIQUE INDEX "course_effort_sizes_course_id_scale_label_key" ON "course_effort_sizes"("course_id", "scale", "label");

CREATE TABLE "course_effort_part_kinds" (
  "id" UUID NOT NULL,
  "course_id" UUID NOT NULL,
  "label" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "course_effort_part_kinds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "course_effort_part_kinds_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "course_effort_part_kinds_label_check" CHECK ("label" = btrim("label") AND length("label") > 0)
);
CREATE UNIQUE INDEX "course_effort_part_kinds_course_id_label_key" ON "course_effort_part_kinds"("course_id", "label");

CREATE TABLE "activity_version_effort_parts" (
  "id" UUID NOT NULL,
  "activity_version_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "part_kind_id" UUID,
  "min_minutes" INTEGER NOT NULL,
  "max_minutes" INTEGER NOT NULL,
  "note" TEXT,
  CONSTRAINT "activity_version_effort_parts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_version_effort_parts_activity_version_id_fkey" FOREIGN KEY ("activity_version_id") REFERENCES "activity_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "activity_version_effort_parts_part_kind_id_fkey" FOREIGN KEY ("part_kind_id") REFERENCES "course_effort_part_kinds"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "activity_version_effort_parts_range_check" CHECK ("min_minutes" >= 1 AND "max_minutes" >= "min_minutes" AND "max_minutes" <= 60000),
  CONSTRAINT "activity_version_effort_parts_sequence_check" CHECK ("sequence" >= 0),
  CONSTRAINT "activity_version_effort_parts_label_check" CHECK ("label" = btrim("label") AND length("label") > 0)
);
CREATE UNIQUE INDEX "activity_version_effort_parts_activity_version_id_sequence_key" ON "activity_version_effort_parts"("activity_version_id", "sequence");

ALTER TABLE "coursework_activity_versions"
  ADD COLUMN "effort_min_minutes" INTEGER,
  ADD COLUMN "effort_max_minutes" INTEGER,
  ADD CONSTRAINT "coursework_activity_versions_effort_check" CHECK (
    ("effort_min_minutes" IS NULL AND "effort_max_minutes" IS NULL) OR
    ("effort_min_minutes" IS NOT NULL AND "effort_max_minutes" IS NOT NULL AND
     "effort_min_minutes" >= 1 AND "effort_max_minutes" >= "effort_min_minutes" AND "effort_max_minutes" <= 60000)
  );

ALTER TABLE "assessment_activity_versions"
  ADD COLUMN "effort_min_minutes" INTEGER,
  ADD COLUMN "effort_max_minutes" INTEGER,
  ADD CONSTRAINT "assessment_activity_versions_effort_check" CHECK (
    ("effort_min_minutes" IS NULL AND "effort_max_minutes" IS NULL) OR
    ("effort_min_minutes" IS NOT NULL AND "effort_max_minutes" IS NOT NULL AND
     "effort_min_minutes" >= 1 AND "effort_max_minutes" >= "effort_min_minutes" AND "effort_max_minutes" <= 60000)
  );

ALTER TABLE "term_coursework_activity_revisions"
  ADD COLUMN "effort_min_minutes" INTEGER,
  ADD COLUMN "effort_max_minutes" INTEGER,
  ADD CONSTRAINT "term_coursework_activity_revisions_effort_check" CHECK (
    ("effort_min_minutes" IS NULL AND "effort_max_minutes" IS NULL) OR
    ("effort_min_minutes" IS NOT NULL AND "effort_max_minutes" IS NOT NULL AND
     "effort_min_minutes" >= 1 AND "effort_max_minutes" >= "effort_min_minutes" AND "effort_max_minutes" <= 60000)
  );

ALTER TABLE "term_assessment_activity_revisions"
  ADD COLUMN "effort_min_minutes" INTEGER,
  ADD COLUMN "effort_max_minutes" INTEGER,
  ADD CONSTRAINT "term_assessment_activity_revisions_effort_check" CHECK (
    ("effort_min_minutes" IS NULL AND "effort_max_minutes" IS NULL) OR
    ("effort_min_minutes" IS NOT NULL AND "effort_max_minutes" IS NOT NULL AND
     "effort_min_minutes" >= 1 AND "effort_max_minutes" >= "effort_min_minutes" AND "effort_max_minutes" <= 60000)
  );
