import { retired } from "../redesign-stub";

const MESSAGE =
  "Module/Skill routes are retired by the Course/LearningModule/Topic redesign. " +
  "Use /api/courses/[id]/learning-modules and /api/terms/[id]/learning-modules instead.";

export async function GET() {
  return retired(MESSAGE);
}

export async function POST() {
  return retired(MESSAGE);
}
