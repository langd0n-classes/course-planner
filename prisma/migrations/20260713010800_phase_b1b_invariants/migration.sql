ALTER TABLE "sessions"
ADD COLUMN "calendar_slot_id" UUID,
ADD COLUMN "schedule_override_label" TEXT;

UPDATE "sessions" AS s
SET "calendar_slot_id" = cs."id"
FROM "calendar_slots" AS cs
WHERE s."term_id" = cs."term_id"
  AND s."date" = cs."date"
  AND cs."slot_type" = 'class_day'
  AND s."date" IS NOT NULL;

UPDATE "sessions"
SET "schedule_override_label" = 'Legacy schedule override'
WHERE "date" IS NOT NULL
  AND "calendar_slot_id" IS NULL
  AND "schedule_override_label" IS NULL;

CREATE INDEX "sessions_calendar_slot_id_idx" ON "sessions"("calendar_slot_id");

ALTER TABLE "sessions"
ADD CONSTRAINT "sessions_calendar_slot_id_fkey"
FOREIGN KEY ("calendar_slot_id") REFERENCES "calendar_slots"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
