import { ExemplarImportService, genericDemoExemplarSnapshot } from "./exemplar-import-service";
import { createAcademicCalendarVersion, previewTermCalendar, applyTermCalendar } from "./academic-calendar-service";
import { createAcademicCalendar, createInstitution } from "./course-service";
import { DomainInvariantError } from "./errors";
import { adoptLearningModuleForTerm } from "./offering-service";
import { applyTermActivityAdoption, previewTermActivityAdoption } from "./term-activity-service";
import { createTerm } from "./term-service";
import type { RedesignDb, RedesignTx } from "./types";

const DEMO_KEY = "generic-demo-v1";

export function demoSemester(today: Date) {
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const year = day.getUTCFullYear();
  const candidates = [
    { season: "Spring" as const, year, startDate: new Date(Date.UTC(year, 0, 15)), endDate: new Date(Date.UTC(year, 4, 5)) },
    { season: "Fall" as const, year, startDate: new Date(Date.UTC(year, 8, 1)), endDate: new Date(Date.UTC(year, 11, 15)) },
    { season: "Spring" as const, year: year + 1, startDate: new Date(Date.UTC(year + 1, 0, 15)), endDate: new Date(Date.UTC(year + 1, 4, 5)) },
  ];
  const semester = candidates.find((candidate) => day <= candidate.endDate)!;
  return {
    ...semester,
    name: `${semester.season} ${semester.year}`,
    code: `${semester.season === "Fall" ? "FA" : "SP"}${String(semester.year).slice(-2)}`,
    academicYear: semester.season === "Fall"
      ? `${semester.year}-${semester.year + 1}`
      : `${semester.year - 1}-${semester.year}`,
    inProgress: day >= semester.startDate,
  };
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
    const existing = await tx.course.findUnique({
      where: { instructorId_demoKey: { instructorId, demoKey: DEMO_KEY } },
      select: { id: true },
    });
    if (existing) return { courseId: existing.id, created: false };

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

    const nestedDb: RedesignDb = { $transaction: async (fn) => fn(tx) };
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

    // A dedicated demo Institution keeps calendar and membership writes scoped
    // to this Instructor even when their ordinary Institution is shared.
    const institution = await createInstitution(nestedDb, {
      instructorId,
      name: `Demo Institution (${instructorId})`,
    });
    await tx.courseInstitution.create({ data: { courseId: course.id, institutionId: institution.id } });
    const semester = demoSemester(today);
    const calendar = await createAcademicCalendar(nestedDb, {
      instructorId,
      institutionId: institution.id,
      name: `${semester.name} Demo Calendar`,
      academicYear: semester.academicYear,
    });
    const { version } = await createAcademicCalendarVersion(nestedDb, {
      instructorId,
      academicCalendarId: calendar.id,
      name: calendar.name,
      academicYear: semester.academicYear,
    });
    const term = await createTerm(nestedDb, {
      instructorId,
      courseId: course.id,
      institutionId: institution.id,
      academicCalendarId: calendar.id,
      code: semester.code,
      name: semester.name,
      startDate: semester.startDate,
      endDate: semester.endDate,
      meetingPattern: { roles: [{ roleKey: "lecture", label: "Class Meeting", sessionType: "lecture", days: ["monday", "wednesday", "friday"] }] },
    });
    await tx.term.update({
      where: { id: term.id },
      data: { academicCalendarVersionId: version.id, status: semester.inProgress ? "active" : "planned" },
    });

    const meetingType = await tx.courseActivityTypeVersion.findFirst({
      where: { courseId: course.id, activityTypeVersion: { activityType: { behaviorFamily: "meeting" } } },
      select: { activityTypeVersionId: true },
    });
    if (!meetingType) throw new DomainInvariantError("Demo Course has no meeting Activity Type");
    const meetingPatterns = [{
      activityTypeVersionId: meetingType.activityTypeVersionId,
      label: "Class Meeting",
      daysOfWeek: ["monday", "wednesday", "friday"],
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

    const modules = await tx.learningModule.findMany({
      where: { courseId: course.id },
      select: { id: true, currentVersionId: true },
      orderBy: { stableCode: "asc" },
    });
    const learningModuleVersionSelections = [];
    for (const [index, module] of modules.entries()) {
      if (!module.currentVersionId) throw new DomainInvariantError("Demo Learning Module has no current version");
      const offering = await adoptLearningModuleForTerm(nestedDb, {
        instructorId, termId: term.id, learningModuleId: module.id,
        learningModuleVersionId: module.currentVersionId, sequence: index + 1,
      });
      learningModuleVersionSelections.push({
        termLearningModuleId: offering.id, learningModuleVersionId: module.currentVersionId,
      });
    }
    const adoption = { instructorId, termId: term.id, learningModuleVersionSelections, crossCuttingSelections: [] };
    const adoptionPreview = await previewTermActivityAdoption(nestedDb, adoption);
    await applyTermActivityAdoption(nestedDb, {
      ...adoption,
      previewToken: adoptionPreview.previewToken,
      expectedCurrentActivityCount: adoptionPreview.expectedCurrentActivityCount,
    });
    return { courseId: course.id, created: true };
  }, { timeout: 300_000, maxWait: 30_000 });
}
