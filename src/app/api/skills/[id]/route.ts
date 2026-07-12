import { retired } from "../../redesign-stub";

const MESSAGE =
  "Skill routes are retired by the Course/LearningModule/Topic redesign. " +
  "Use /api/topics/[id] instead.";

export async function GET() {
  return retired(MESSAGE);
}

export async function PATCH() {
  return retired(MESSAGE);
}

export async function DELETE() {
  return retired(MESSAGE);
}
