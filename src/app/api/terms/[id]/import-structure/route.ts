import { retired } from "../../../redesign-stub";

const MESSAGE =
  "The Module/Skill JSON structure import route is retired by the " +
  "Course/LearningModule/Topic redesign. There is no direct replacement yet; " +
  "Phase B will define curriculum import against the new schema.";

export async function POST() {
  return retired(MESSAGE);
}
