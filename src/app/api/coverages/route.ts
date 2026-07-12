import { retired } from "../redesign-stub";

const MESSAGE =
  "The bare /api/coverages list route is retired; it was Skill-scoped. " +
  "Use /api/sessions/[id]/coverages instead.";

export async function GET() {
  return retired(MESSAGE);
}

export async function POST() {
  return retired(MESSAGE);
}
