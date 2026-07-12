import { retired } from "../../../redesign-stub";

const MESSAGE =
  "The old artifact export route (session/assessment/module-based generation) " +
  "is retired. Artifact export against the redesigned schema is not yet " +
  "implemented; see /api/artifacts/[id].";

export async function GET() {
  return retired(MESSAGE);
}
