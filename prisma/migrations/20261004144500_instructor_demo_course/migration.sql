ALTER TABLE "courses" ADD COLUMN "demo_key" TEXT;

CREATE UNIQUE INDEX "courses_instructor_id_demo_key_key" ON "courses"("instructor_id", "demo_key");
