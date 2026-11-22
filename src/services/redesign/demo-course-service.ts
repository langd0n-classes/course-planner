import { seedDemoEffort } from "./demo-effort";
import { ExemplarImportService, genericDemoExemplarSnapshot } from "./exemplar-import-service";
import { createAcademicCalendarVersion, previewTermCalendar, applyTermCalendar } from "./academic-calendar-service";
import { createAcademicCalendar, createInstitution } from "./course-service";
import { DomainInvariantError } from "./errors";
import { adoptLearningModuleForTerm } from "./offering-service";
import { applyTermActivityAdoption, previewTermActivityAdoption } from "./term-activity-service";
import { createTerm } from "./term-service";
import type { RedesignDb, RedesignTx } from "./types";

const DEMO_KEY = "generic-demo-v1";

const DAY_MS = 86_400_000;
const MEETING_DAYS = ["monday", "wednesday", "friday"];

export type DemoSemester = {
  season: "Spring" | "Fall";
  year: number;
  name: string;
  code: string;
  academicYear: string;
  startDate: Date;
  endDate: Date;
  inProgress: boolean;
};

/** The first date on or after `from` that falls on `weekday` (0 = Sunday). */
function onOrAfter(from: Date, weekday: number) {
  return new Date(from.getTime() + ((weekday - from.getUTCDay() + 7) % 7) * DAY_MS);
}

// The Demo Institution is not a real one, so its dates come from weekday rules
// that resemble a common North American semester, not from any registrar.
// Spring classes begin on the Tuesday after the third Monday of January. Fall
// classes begin on the first Wednesday of September. Classes end on the Friday
// of the fifteenth calendar week.
function semesterDates(season: "Spring" | "Fall", year: number) {
  const startDate = season === "Spring"
    ? new Date(onOrAfter(new Date(Date.UTC(year, 0, 15)), 1).getTime() + DAY_MS)
    : onOrAfter(new Date(Date.UTC(year, 8, 1)), 3);
  const endDate = onOrAfter(new Date(startDate.getTime() + 14 * 7 * DAY_MS), 5);
  return { startDate, endDate };
}

/**
 * The demo's two Terms on `today`: the semester in progress, or the next one
 * to begin when none is, followed by the semester after it.
 */
export function demoSemesters(today: Date): [DemoSemester, DemoSemester] {
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const year = day.getUTCFullYear();
  const candidates = [
    { season: "Spring" as const, year },
    { season: "Fall" as const, year },
    { season: "Spring" as const, year: year + 1 },
    { season: "Fall" as const, year: year + 1 },
  ].map((candidate) => ({ ...candidate, ...semesterDates(candidate.season, candidate.year) }));
  const first = candidates.findIndex((candidate) => day <= candidate.endDate);
  const [current, next] = candidates.slice(first, first + 2).map((semester) => ({
    ...semester,
    name: `${semester.season} ${semester.year}`,
    code: `${semester.season === "Fall" ? "FA" : "SP"}${String(semester.year).slice(-2)}`,
    academicYear: semester.season === "Fall"
      ? `${semester.year}-${semester.year + 1}`
      : `${semester.year - 1}-${semester.year}`,
    inProgress: day >= semester.startDate,
  }));
  return [current, next];
}

type DemoTermContext = {
  tx: RedesignTx;
  nestedDb: RedesignDb;
  instructorId: string;
  courseId: string;
  institutionId: string;
};

/**
 * Creates the Term for `semester` unless the Course already has a Term with
 * that code. Returns the new Term's id, or null when the Term exists.
 */
async function ensureDemoTerm(context: DemoTermContext, semester: DemoSemester): Promise<string | null> {
  const { tx, nestedDb, instructorId, courseId, institutionId } = context;
  const existing = await tx.term.findUnique({
    where: { courseId_code: { courseId, code: semester.code } },
    select: { id: true },
  });
  if (existing) return null;

  // One Academic Calendar serves both semesters of an academic year.
  let calendar = await tx.academicCalendar.findFirst({
    where: { institutionId, academicYear: semester.academicYear },
    orderBy: { version: "desc" },
    select: { id: true, name: true },
  });
  let version = calendar && await tx.academicCalendarVersion.findFirst({
    where: { academicCalendarId: calendar.id },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  if (!calendar) {
    calendar = await createAcademicCalendar(nestedDb, {
      instructorId,
      institutionId,
      name: `Demo Calendar ${semester.academicYear}`,
      academicYear: semester.academicYear,
    });
  }
  if (!version) {
    ({ version } = await createAcademicCalendarVersion(nestedDb, {
      instructorId,
      academicCalendarId: calendar.id,
      name: calendar.name,
      academicYear: semester.academicYear,
    }));
  }

  const term = await createTerm(nestedDb, {
    instructorId,
    courseId,
    institutionId,
    academicCalendarId: calendar.id,
    code: semester.code,
    name: semester.name,
    startDate: semester.startDate,
    endDate: semester.endDate,
    meetingPattern: { roles: [{ roleKey: "lecture", label: "Class Meeting", sessionType: "lecture", days: MEETING_DAYS }] },
  });
  await tx.term.update({
    where: { id: term.id },
    data: { academicCalendarVersionId: version.id, status: semester.inProgress ? "active" : "planned" },
  });

  const meetingType = await tx.courseActivityTypeVersion.findFirst({
    where: { courseId, activityTypeVersion: { activityType: { behaviorFamily: "meeting" } } },
    select: { activityTypeVersionId: true },
  });
  if (!meetingType) throw new DomainInvariantError("Demo Course has no meeting Activity Type");
  const meetingPatterns = [{
    activityTypeVersionId: meetingType.activityTypeVersionId,
    label: "Class Meeting",
    daysOfWeek: MEETING_DAYS,
    startTimeLocal: "10:00",
    endTimeLocal: "10:50",
    timeZone: "UTC",
    startsOn: semester.startDate.toISOString().slice(0, 10),
    endsOn: semester.endDate.toISOString().slice(0, 10),
  }];
  const calendarPreview = await previewTermCalendar(nestedDb, { instructorId, termId: term.id, meetingPatterns });
  if (calendarPreview.conflicts.length > 0) throw new DomainInvariantError("Demo Term calendar has conflicts");
  await applyTermCalendar(nestedDb, {
    instructorId, termId: term.id, meetingPatterns,
    previewToken: calendarPreview.previewToken,
    expectedCurrentCalendarSlotCount: calendarPreview.expectedCurrentCalendarSlotCount,
  });
  return term.id;
}

/**
 * Adopts the Course's Learning Modules, Activities, and undated template milestones into a new Term.
 * A new demo Course requires a current version on every module. An existing
 * Course can hold the instructor's own draft-only modules; those are skipped.
 */
async function adoptDemoCourseContent(context: DemoTermContext, termId: string, requireEveryModule: boolean) {
  const { tx, nestedDb, instructorId, courseId } = context;
  const modules: Array<{ id: string; currentVersionId: string | null }> = await tx.learningModule.findMany({
    where: { courseId },
    select: { id: true, currentVersionId: true },
    orderBy: { stableCode: "asc" },
  });
  const learningModuleVersionSelections = [];
  let sequence = 0;
  for (const learningModule of modules) {
    if (!learningModule.currentVersionId) {
      if (requireEveryModule) throw new DomainInvariantError("Demo Learning Module has no current version");
      continue;
    }
    sequence += 1;
    const offering = await adoptLearningModuleForTerm(nestedDb, {
      instructorId, termId, learningModuleId: learningModule.id,
      learningModuleVersionId: learningModule.currentVersionId, sequence,
    });
    learningModuleVersionSelections.push({
      termLearningModuleId: offering.id, learningModuleVersionId: learningModule.currentVersionId,
    });
  }
  if (learningModuleVersionSelections.length === 0) return;
  const adoption = { instructorId, termId, learningModuleVersionSelections, crossCuttingSelections: [] };
  const adoptionPreview = await previewTermActivityAdoption(nestedDb, adoption);
  await applyTermActivityAdoption(nestedDb, {
    ...adoption,
    previewToken: adoptionPreview.previewToken,
    expectedCurrentActivityCount: adoptionPreview.expectedCurrentActivityCount,
  });
}

/**
 * Gives a demo Course the Terms that are current and next on `today`. A Term
 * that the Course already has, matched by code, is left as it is. Runs inside
 * the caller's transaction.
 */
export async function ensureDemoTerms(
  tx: RedesignTx,
  input: { instructorId: string; courseId: string; institutionId: string; today: Date; requireEveryModule: boolean },
): Promise<void> {
  const nestedDb: RedesignDb = { $transaction: async (fn) => fn(tx) };
  const context: DemoTermContext = {
    tx, nestedDb, instructorId: input.instructorId, courseId: input.courseId, institutionId: input.institutionId,
  };
  const [current, next] = demoSemesters(input.today);
  // The current Term is populated so pacing views have content. The next Term
  // has its calendar only, so adoption is still there for the instructor to do.
  const currentTermId = await ensureDemoTerm(context, current);
  if (currentTermId) await adoptDemoCourseContent(context, currentTermId, input.requireEveryModule);
  await ensureDemoTerm(context, next);
}

export async function loadDemoCourse(
  db: RedesignDb,
  instructorId: string,
  importer: Pick<ExemplarImportService, "apply"> = new ExemplarImportService(),
  today: Date = new Date(),
): Promise<{ courseId: string; created: boolean }> {
  return db.$transaction(async (tx: RedesignTx) => {
    // Serialize demo loads for this Instructor. The transaction also rolls back
    // the new Course if its exemplar import fails.
    await tx.$queryRaw`SELECT id FROM instructors WHERE id = ${instructorId}::uuid FOR UPDATE`;
    const nestedDb: RedesignDb = { $transaction: async (fn) => fn(tx) };
    const institutionName = `Demo Institution (${instructorId})`;
    const existing = await tx.course.findUnique({
      where: { instructorId_demoKey: { instructorId, demoKey: DEMO_KEY } },
      select: { id: true },
    });

    let courseId: string;
    let institutionId: string;
    if (existing) {
      // A repeat load adds the current and next Term when time has moved past
      // the Terms of the first load. It changes nothing else in the Course.
      const link = await tx.courseInstitution.findFirst({
        where: { courseId: existing.id, institution: { name: institutionName } },
        select: { institutionId: true },
      });
      if (!link) return { courseId: existing.id, created: false };
      courseId = existing.id;
      institutionId = link.institutionId;
    } else {
      const instructor = await tx.instructor.update({
        where: { id: instructorId },
        data: { nextCourseSerial: { increment: 1 } },
        select: { nextCourseSerial: true },
      });
      const course = await tx.course.create({
        data: {
          instructorId,
          demoKey: DEMO_KEY,
          shortId: (instructor.nextCourseSerial - 1).toString().padStart(3, "0"),
          title: genericDemoExemplarSnapshot.course.title,
          number: genericDemoExemplarSnapshot.course.number,
          description: genericDemoExemplarSnapshot.course.description,
        },
      });
      const imported = await importer.apply(
        nestedDb,
        {
          instructorId,
          courseId: course.id,
          snapshot: genericDemoExemplarSnapshot,
        },
      );
      if (imported.ambiguities.length > 0) {
        throw new DomainInvariantError("Demo Course import contains ambiguities");
      }

      await seedDemoEffort(tx, course.id);

      // A dedicated demo Institution keeps calendar and membership writes scoped
      // to this Instructor even when their ordinary Institution is shared.
      const institution = await createInstitution(nestedDb, { instructorId, name: institutionName });
      await tx.courseInstitution.create({ data: { courseId: course.id, institutionId: institution.id } });
      courseId = course.id;
      institutionId = institution.id;
    }

    await ensureDemoTerms(tx, { instructorId, courseId, institutionId, today, requireEveryModule: !existing });
    return { courseId, created: !existing };
  }, { timeout: 300_000, maxWait: 30_000 });
}
