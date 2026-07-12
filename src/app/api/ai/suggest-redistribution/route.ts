import { retired } from "../../redesign-stub";

const MESSAGE =
  "The Module/Skill-era AI redistribution suggestion route is retired. Mock " +
  "AI planning against the redesigned schema is out of scope for Phase A.1.";

export async function POST() {
  return retired(MESSAGE);
}
