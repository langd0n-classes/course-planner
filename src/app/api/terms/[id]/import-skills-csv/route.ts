import { retired } from "../../../redesign-stub";

const MESSAGE =
  "The Skill CSV import route is retired by the Course/LearningModule/Topic " +
  "redesign. Topics are authored via /api/courses/[id]/topics and " +
  "/api/topics/[id]/versions.";

export async function POST() {
  return retired(MESSAGE);
}
