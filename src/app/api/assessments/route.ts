import { retired } from "../redesign-stub";

const MESSAGE =
  "The bare /api/assessments list route is retired; it was Skill-scoped. " +
  "Use /api/terms/[id]/assessments instead.";

export async function GET() {
  return retired(MESSAGE);
}

export async function POST() {
  return retired(MESSAGE);
}
