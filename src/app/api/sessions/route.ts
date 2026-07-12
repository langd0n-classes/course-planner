import { retired } from "../redesign-stub";

const MESSAGE =
  "The bare /api/sessions list route is retired; it was Module-scoped. " +
  "Use /api/terms/[id]/sessions instead.";

export async function GET() {
  return retired(MESSAGE);
}

export async function POST() {
  return retired(MESSAGE);
}
