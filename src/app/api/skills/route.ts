import { retired } from "../redesign-stub";

const MESSAGE =
  "Skill routes are retired by the Course/LearningModule/Topic redesign. " +
  "Use /api/courses/[id]/topics and /api/topics/[id]/versions instead.";

export async function GET() {
  return retired(MESSAGE);
}

export async function POST() {
  return retired(MESSAGE);
}
