import { retired } from "../../../redesign-stub";

const MESSAGE =
  "The ad-hoc calendar import route is retired. Institution/AcademicCalendar " +
  "materialization (see /api/academic-calendars) supersedes it.";

export async function POST() {
  return retired(MESSAGE);
}
